import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter } from 'events';
import { join } from 'path';
import { rm } from 'fs/promises';
import QRCode from 'qrcode';
import * as qrcodeTerminal from 'qrcode-terminal';
import { CaptureService } from 'src/capture/capture.service';
import { MessageStore } from 'src/gateway/message-store';
import { extFromMime, saveMedia } from 'src/common/media-store';
import { loadBaileys, BaileysRuntime } from './baileys.loader';
import { normalizeJid, shouldIgnoreJid } from './jid';
import { extractText, extractType, isHistoryUpsert, unwrapMessage, waMessageId } from './message-extract';

export type WaInbound = {
  jid: string;
  participant?: string;
  name?: string;
  fromMe: boolean;
  waMessageId: string;
  timestamp: number;
  type: 'text' | 'image' | 'audio' | 'file' | 'unknown';
  text?: string;
  mediaPath?: string;
  mediaMime?: string;
  raw: any;
};

const MINIMAL_HISTORY = new Set([0, 4, 5]);
const AUTH_DIR = join(process.cwd(), 'auth_info_baileys');

@Injectable()
export class WhatsappService extends EventEmitter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);
  private baileys: BaileysRuntime | null = null;
  private sock: any = null;
  private connecting: Promise<void> | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private groupCache = new Map<string, any>();
  status: {
    connection: string;
    qr: string | null;
    qrDataUrl: string | null;
    me: any;
  } = { connection: 'close', qr: null, qrDataUrl: null, me: null };

  constructor(
    private readonly capture: CaptureService,
    private readonly messages: MessageStore,
  ) {
    super();
    this.setMaxListeners(50);
  }

  async onModuleInit() {
    try {
      await this.connect();
    } catch (err) {
      this.logger.error('Falha ao iniciar WhatsApp', err as Error);
    }
  }

  async onModuleDestroy() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    await this.dropSocket();
  }

  async connect(): Promise<void> {
    if (this.connecting) {
      return this.connecting;
    }
    this.connecting = this.openSocket().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async dropSocket() {
    const sock = this.sock;
    this.sock = null;
    if (!sock) return;
    try {
      sock.ev.removeAllListeners();
    } catch {
      /* ignore */
    }
    try {
      sock.end?.(undefined);
    } catch {
      /* ignore */
    }
  }

  private scheduleReconnect(ms: number) {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((err) => this.logger.error(err));
    }, ms);
  }

  private async openSocket() {
    this.baileys = await loadBaileys();
    const { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = this.baileys;
    await this.dropSocket();
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    this.sock = makeWASocket({
      auth: state,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      emitOwnEvents: false,
      browser: Browsers.ubuntu('Chrome'),
      shouldSyncHistoryMessage: (msg: { syncType?: number | null }) =>
        MINIMAL_HISTORY.has(Number(msg?.syncType ?? -1)),
      getMessage: async (key: any) => this.messages.protoForRetry(key),
      cachedGroupMetadata: async (jid: string) => this.groupCache.get(jid),
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('groups.update', (updates: any[]) => {
      for (const update of updates || []) {
        if (update?.id) {
          this.groupCache.set(update.id, { ...(this.groupCache.get(update.id) || {}), ...update });
        }
      }
    });

    this.sock.ev.on('groups.upsert', (groups: any[]) => {
      for (const group of groups || []) {
        if (group?.id) this.groupCache.set(group.id, group);
      }
    });

    this.sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        this.status.qr = qr;
        this.status.qrDataUrl = await QRCode.toDataURL(qr);
        try {
          qrcodeTerminal.generate(qr, { small: true });
        } catch {
          /* optional */
        }
      }
      if (connection) this.status.connection = connection;
      if (connection === 'open') {
        this.status.qr = null;
        this.status.qrDataUrl = null;
        this.status.me = this.sock.user;
        this.logger.log(`WhatsApp conectado`);
      }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        this.status.me = null;
        this.logger.warn(`WhatsApp fechou (code=${code})`);
        await this.dropSocket();
        if (loggedOut) {
          await rm(AUTH_DIR, { recursive: true, force: true }).catch(() => undefined);
        }
        this.scheduleReconnect(loggedOut ? 1000 : 3000);
      }
    });

    this.sock.ev.on('contacts.upsert', (contacts: any[]) => {
      void this.indexChats(
        (contacts || []).map((c) => ({
          jid: c.id || c.jid,
          name: c.notify || c.name || c.verifiedName,
        })),
      );
    });

    this.sock.ev.on('chats.upsert', (chats: any[]) => {
      void this.indexChats((chats || []).map((c) => ({ jid: c.id, name: c.name || c.subject })));
    });

    this.sock.ev.on('messaging-history.set', (event: any) => {
      const chats = event?.chats || [];
      void this.indexChats(chats.map((c: any) => ({ jid: c.id, name: c.name || c.subject })));
    });

    this.sock.ev.on('messages.upsert', async (event: { messages?: any[]; type?: string }) => {
      if (isHistoryUpsert(event.type) || event.type === 'append') return;
      if (event.type && event.type !== 'notify') return;
      for (const m of event.messages || []) {
        try {
          await this.handleIncoming(m);
        } catch (err) {
          this.logger.error('Erro ao processar mensagem inbound', err as Error);
        }
      }
    });
  }

  private async indexChats(rows: Array<{ jid?: string; name?: string }>) {
    for (const row of rows) {
      const jid = normalizeJid(row.jid);
      if (shouldIgnoreJid(jid)) continue;
      await this.capture.upsertCatalog(jid, row.name).catch((err) => {
        this.logger.warn(`catalog: ${(err as Error).message}`);
      });
    }
  }

  private async handleIncoming(m: any) {
    const remote = normalizeJid(m?.key?.remoteJid);
    if (shouldIgnoreJid(remote) || !m?.message) return;
    await this.capture.upsertCatalog(remote, m.pushName).catch(() => undefined);
    if (!this.capture.isAllowed(remote)) return;

    const inner = unwrapMessage(m.message);
    const type = extractType(m.message);
    const text = extractText(m.message);
    if (type === 'unknown' && !text) return;

    const inbound: WaInbound = {
      jid: remote,
      participant: m.key?.participant ? normalizeJid(m.key.participant) : undefined,
      name: m.pushName,
      fromMe: Boolean(m.key?.fromMe),
      waMessageId: waMessageId(m.key),
      timestamp: Number(m.messageTimestamp || Date.now() / 1000),
      type,
      text,
      raw: inner,
    };

    if (type === 'image' || type === 'audio' || type === 'file') {
      try {
        const buffer: Buffer = await this.baileys!.downloadMediaMessage(
          m,
          'buffer',
          {},
          { reuploadRequest: this.sock.updateMediaMessage, logger: undefined },
        );
        const mime =
          inner?.imageMessage?.mimetype ||
          inner?.audioMessage?.mimetype ||
          inner?.videoMessage?.mimetype ||
          inner?.documentMessage?.mimetype ||
          inner?.stickerMessage?.mimetype;
        inbound.mediaPath = await saveMedia(
          buffer,
          extFromMime(mime, type === 'audio' ? 'ogg' : type === 'image' ? 'jpg' : 'bin'),
        );
        inbound.mediaMime = mime;
      } catch (err) {
        this.logger.warn(`Falha ao baixar mídia de ${remote}: ${(err as Error).message}`);
      }
    }

    this.emit('inbound', inbound);
  }

  isOpen() {
    return this.status.connection === 'open' && Boolean(this.sock);
  }

  async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.sock?.requestPairingCode) throw new Error('Socket WhatsApp indisponível');
    return this.sock.requestPairingCode(phoneNumber.replace(/\D/g, ''));
  }

  async sendText(jid: string, text: string) {
    if (!this.sock) throw new Error('WhatsApp não conectado');
    return this.sock.sendMessage(jid, { text });
  }

  async sendImage(jid: string, image: Buffer, caption?: string) {
    if (!this.sock) throw new Error('WhatsApp não conectado');
    return this.sock.sendMessage(jid, { image, caption });
  }

  async sendAudio(jid: string, audio: Buffer, ptt = true) {
    if (!this.sock) throw new Error('WhatsApp não conectado');
    return this.sock.sendMessage(jid, { audio, ptt, mimetype: 'audio/ogg; codecs=opus' });
  }

  async sendFile(jid: string, document: Buffer, fileName: string, mimetype?: string) {
    if (!this.sock) throw new Error('WhatsApp não conectado');
    return this.sock.sendMessage(jid, { document, fileName, mimetype });
  }
}
