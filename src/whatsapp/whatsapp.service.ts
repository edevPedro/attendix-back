import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter } from 'events';
import { join } from 'path';
import QRCode from 'qrcode';
import * as qrcodeTerminal from 'qrcode-terminal';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaptureService } from 'src/capture/capture.service';
import { extFromMime, saveMedia } from 'src/common/media-store';
import { loadBaileys, BaileysRuntime } from './baileys.loader';
import { chatKind, normalizeJid, shouldIgnoreJid } from './jid';
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

@Injectable()
export class WhatsappService extends EventEmitter implements OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);
  private baileys: BaileysRuntime | null = null;
  private sock: any = null;
  private reconnecting = false;
  private groupCache = new Map<string, any>();
  status: {
    connection: string;
    qr: string | null;
    qrDataUrl: string | null;
    me: any;
  } = { connection: 'close', qr: null, qrDataUrl: null, me: null };

  constructor(
    private readonly prisma: PrismaService,
    private readonly capture: CaptureService,
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

  getSocket() {
    return this.sock;
  }

  async connect() {
    this.baileys = await loadBaileys();
    const { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = this.baileys;
    const authDir = join(process.cwd(), 'auth_info_baileys');
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners();
      } catch {
        /* ignore */
      }
    }

    this.sock = makeWASocket({
      auth: state,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      emitOwnEvents: true,
      browser: Browsers?.ubuntu?.('Chrome') || ['Attendix', 'Chrome', '1.0'],
      shouldSyncHistoryMessage: (msg: { syncType?: number | null }) =>
        MINIMAL_HISTORY.has(Number(msg?.syncType ?? -1)),
      getMessage: async (key: any) => {
        const id = waMessageId(key);
        const stored = await this.prisma.message.findUnique({ where: { waMessageId: id } });
        if (stored?.rawJson && typeof stored.rawJson === 'object') {
          return stored.rawJson as any;
        }
        if (stored?.body) {
          return { conversation: stored.body };
        }
        return { conversation: '' };
      },
      cachedGroupMetadata: async (jid: string) => this.groupCache.get(jid),
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('groups.update', (updates: any[]) => {
      for (const update of updates || []) {
        if (update?.id) {
          const prev = this.groupCache.get(update.id) || {};
          this.groupCache.set(update.id, { ...prev, ...update });
        }
      }
    });

    this.sock.ev.on('groups.upsert', (groups: any[]) => {
      for (const group of groups || []) {
        if (group?.id) {
          this.groupCache.set(group.id, group);
        }
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
        this.emit('connection', this.status);
      }
      if (connection) {
        this.status.connection = connection;
      }
      if (connection === 'open') {
        this.status.qr = null;
        this.status.qrDataUrl = null;
        this.status.me = this.sock.user;
        this.logger.log(`WhatsApp conectado: ${JSON.stringify(this.sock.user)}`);
        this.emit('connection', this.status);
      }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        this.logger.warn(`WhatsApp fechou (code=${code}). Relogar=${!loggedOut}`);
        this.status.me = null;
        this.emit('connection', this.status);
        if (!loggedOut && !this.reconnecting) {
          this.reconnecting = true;
          setTimeout(() => {
            this.reconnecting = false;
            this.connect().catch((err) => this.logger.error(err));
          }, 3000);
        }
      }
    });

    this.sock.ev.on('contacts.upsert', async (contacts: any[]) => {
      for (const contact of contacts || []) {
        const jid = normalizeJid(contact.id || contact.jid);
        if (shouldIgnoreJid(jid)) continue;
        await this.capture.upsertCatalog(jid, contact.notify || contact.name || contact.verifiedName);
      }
    });

    this.sock.ev.on('chats.upsert', async (chats: any[]) => {
      for (const chat of chats || []) {
        const jid = normalizeJid(chat.id);
        if (shouldIgnoreJid(jid)) continue;
        await this.capture.upsertCatalog(jid, chat.name || chat.subject);
      }
    });

    this.sock.ev.on('messaging-history.set', async (event: any) => {
      const chats = event?.chats || [];
      for (const chat of chats) {
        const jid = normalizeJid(chat.id);
        if (shouldIgnoreJid(jid)) continue;
        await this.capture.upsertCatalog(jid, chat.name || chat.subject);
      }
    });

    this.sock.ev.on('messages.upsert', async (event: { messages?: any[]; type?: string }) => {
      if (isHistoryUpsert(event.type)) {
        return;
      }
      if (event.type && event.type !== 'notify' && event.type !== 'append') {
        return;
      }
      if (event.type === 'append') {
        return;
      }
      for (const m of event.messages || []) {
        try {
          await this.handleIncoming(m);
        } catch (err) {
          this.logger.error('Erro ao processar mensagem inbound', err as Error);
        }
      }
    });
  }

  private async handleIncoming(m: any) {
    const remote = normalizeJid(m?.key?.remoteJid);
    if (shouldIgnoreJid(remote) || !m?.message) {
      return;
    }
    await this.capture.upsertCatalog(remote, m.pushName);
    if (!this.capture.isAllowed(remote)) {
      return;
    }

    const inner = unwrapMessage(m.message);
    const type = extractType(m.message);
    const text = extractText(m.message);
    if (type === 'unknown' && !text) {
      return;
    }
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
        const ext = extFromMime(mime, type === 'audio' ? 'ogg' : type === 'image' ? 'jpg' : 'bin');
        inbound.mediaPath = await saveMedia(buffer, ext);
        inbound.mediaMime = mime;
      } catch (err) {
        this.logger.warn(`Falha ao baixar mídia de ${remote}: ${(err as Error).message}`);
      }
    }

    this.emit('inbound', inbound);
  }

  async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.sock?.requestPairingCode) {
      throw new Error('Socket WhatsApp indisponível');
    }
    const digits = phoneNumber.replace(/\D/g, '');
    return this.sock.requestPairingCode(digits);
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
    return this.sock.sendMessage(jid, {
      audio,
      ptt,
      mimetype: 'audio/ogg; codecs=opus',
    });
  }

  async sendFile(jid: string, document: Buffer, fileName: string, mimetype?: string) {
    if (!this.sock) throw new Error('WhatsApp não conectado');
    return this.sock.sendMessage(jid, { document, fileName, mimetype });
  }

  chatKindOf(jid: string) {
    return chatKind(jid);
  }
}
