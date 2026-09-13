import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CaptureService } from 'src/capture/capture.service';
import { DiscordService, DiscordInbound } from 'src/discord/discord.service';
import { WhatsappService, WaInbound } from 'src/whatsapp/whatsapp.service';
import { SpeechService } from 'src/speech/speech.service';
import { inboundPrefix, resolveFanoutJids } from 'src/capture/capture.policy';
import { extFromMime, saveMedia } from 'src/common/media-store';
import { normalizeJid } from 'src/whatsapp/jid';
import { waMessageId } from 'src/whatsapp/message-extract';
import { MessageStore } from 'src/gateway/message-store';

type OutFile = { buffer: Buffer; name: string; mime?: string; mediaPath?: string };

@Injectable()
export class BridgeService implements OnModuleInit {
  private readonly logger = new Logger(BridgeService.name);

  constructor(
    private readonly capture: CaptureService,
    private readonly discord: DiscordService,
    private readonly whatsapp: WhatsappService,
    private readonly speech: SpeechService,
    private readonly messages: MessageStore,
  ) {}

  onModuleInit() {
    this.whatsapp.on('inbound', (msg: WaInbound) => {
      this.fromWhatsApp(msg).catch((err) => this.logger.error(err));
    });
    this.discord.on('inbound', (msg: DiscordInbound) => {
      this.fromDiscord(msg).catch((err) => this.logger.error(err));
    });
  }

  async fromWhatsApp(msg: WaInbound) {
    if (!this.capture.isAllowed(msg.jid)) return;
    if (msg.waMessageId && (await this.messages.findByWaId(msg.waMessageId))) {
      return;
    }

    const allowed = await this.capture.getAllowed(msg.jid);
    const display = msg.name || allowed?.name || msg.jid;
    const bindings = await this.capture.listBindings();
    const sameChannel = resolveFanoutJids(allowed?.discordChannelId || '', bindings);
    const prefix = inboundPrefix(sameChannel.length, display);

    const saved = await this.messages.record({
      jid: msg.jid,
      direction: msg.fromMe ? 'out' : 'in',
      type: msg.type,
      body: msg.text,
      mediaPath: msg.mediaPath,
      waMessageId: msg.waMessageId || undefined,
      rawJson: msg.raw ?? undefined,
    });
    if (saved.discordMessageId) {
      return;
    }

    let transcript: string | null = null;
    if (msg.type === 'audio' && msg.mediaPath) {
      transcript = await this.speech.transcribe(msg.mediaPath);
    }

    const body = [prefix.trim(), msg.text, transcript ? `_Transcrição:_ ${transcript}` : null]
      .filter(Boolean)
      .join('\n');

    let discordMessageId: string | null = null;
    if (allowed?.discordChannelId) {
      discordMessageId = await this.discord.postInbound({
        channelId: allowed.discordChannelId,
        body,
        files: msg.mediaPath ? [msg.mediaPath] : undefined,
      });
    }

    if (saved.waMessageId) {
      await this.messages.record({
        jid: saved.jid,
        direction: saved.direction,
        type: saved.type,
        waMessageId: saved.waMessageId,
        transcript,
        discordMessageId,
        body: msg.text || transcript,
        mediaPath: msg.mediaPath,
        rawJson: msg.raw ?? undefined,
      });
    }
  }

  async fromDiscord(msg: DiscordInbound) {
    const bindings = await this.capture.listBindings();
    const jids = resolveFanoutJids(msg.channelId, bindings);
    if (!jids.length) return;

    const sendAsAudio =
      (await this.capture.sendAsAudioForChannel(msg.channelId)) ||
      msg.content.trim().toLowerCase().startsWith('!tts ');
    const text = msg.content.replace(/^!tts\s+/i, '').trim();

    const files: OutFile[] = [];
    for (const att of msg.attachments) {
      const res = await fetch(att.url);
      const buf = Buffer.from(await res.arrayBuffer());
      const mime = att.contentType || undefined;
      const mediaPath = await saveMedia(buf, extFromMime(mime, att.name.split('.').pop() || 'bin'));
      files.push({ buffer: buf, name: att.name, mime, mediaPath });
    }

    for (const jid of jids) {
      try {
        await this.deliverToWhatsApp(jid, text, files, sendAsAudio, msg.messageId);
      } catch (err) {
        this.logger.error(`Falha ao enviar para ${jid}`, err as Error);
      }
    }
  }

  async sendFromFront(data: { to: string; message?: string }) {
    const jid = normalizeJid(data.to);
    if (!this.capture.isAllowed(jid)) {
      throw new Error('Chat não está na allowlist');
    }
    await this.deliverToWhatsApp(jid, data.message || '', [], false, undefined);
  }

  private async deliverToWhatsApp(
    jid: string,
    text: string,
    files: OutFile[],
    sendAsAudio: boolean,
    discordMessageId?: string,
  ) {
    const images = files.filter((f) => f.mime?.startsWith('image/'));
    const audios = files.filter((f) => f.mime?.startsWith('audio/'));
    const others = files.filter((f) => !f.mime?.startsWith('image/') && !f.mime?.startsWith('audio/'));

    for (const img of images) {
      const sent = await this.whatsapp.sendImage(jid, img.buffer, text || undefined);
      await this.storeOut(jid, 'image', text, discordMessageId, sent, img.mediaPath);
    }
    for (const audio of audios) {
      const sent = await this.whatsapp.sendAudio(jid, audio.buffer, true);
      await this.storeOut(jid, 'audio', text, discordMessageId, sent, audio.mediaPath);
    }
    for (const file of others) {
      const sent = await this.whatsapp.sendFile(jid, file.buffer, file.name, file.mime);
      await this.storeOut(jid, 'file', text, discordMessageId, sent, file.mediaPath);
    }

    if (!files.length && text) {
      if (sendAsAudio) {
        const ogg = await this.speech.synthesize(text);
        if (ogg) {
          const sent = await this.whatsapp.sendAudio(jid, ogg, true);
          await this.storeOut(jid, 'audio', text, discordMessageId, sent);
          return;
        }
      }
      const sent = await this.whatsapp.sendText(jid, text);
      await this.storeOut(jid, 'text', text, discordMessageId, sent);
    }
  }

  private async storeOut(
    jid: string,
    type: string,
    body: string,
    discordMessageId: string | undefined,
    sent?: { key?: { id?: string; remoteJid?: string | null; participant?: string | null } },
    mediaPath?: string,
  ) {
    await this.messages.record({
      jid,
      direction: 'out',
      type,
      body: body || null,
      discordMessageId,
      mediaPath,
      waMessageId: sent?.key ? waMessageId(sent.key) || undefined : undefined,
    });
  }
}
