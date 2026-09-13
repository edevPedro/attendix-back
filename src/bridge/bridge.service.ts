import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaptureService } from 'src/capture/capture.service';
import { DiscordService, DiscordInbound } from 'src/discord/discord.service';
import { WhatsappService, WaInbound } from 'src/whatsapp/whatsapp.service';
import { SpeechService } from 'src/speech/speech.service';
import { inboundPrefix } from 'src/capture/capture.policy';
import { extFromMime, saveMedia } from 'src/common/media-store';
import { chatKind, normalizeJid } from 'src/whatsapp/jid';
import { ChatGateway } from 'src/chat/chat.gateway';

@Injectable()
export class BridgeService implements OnModuleInit {
  private readonly logger = new Logger(BridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly capture: CaptureService,
    private readonly discord: DiscordService,
    private readonly whatsapp: WhatsappService,
    private readonly speech: SpeechService,
    private readonly chatGateway: ChatGateway,
  ) {}

  onModuleInit() {
    this.whatsapp.on('inbound', (msg: WaInbound) => {
      this.fromWhatsApp(msg).catch((err) => this.logger.error(err));
    });
    this.discord.on('inbound', (msg: DiscordInbound) => {
      this.fromDiscord(msg).catch((err) => this.logger.error(err));
    });
    this.chatGateway.on('fromFront', (data: { to: string; message?: string }) => {
      this.sendFromFront(data).catch((err) => this.logger.warn(String(err)));
    });
  }

  async fromWhatsApp(msg: WaInbound) {
    if (!this.capture.isAllowed(msg.jid)) {
      return;
    }
    let transcript: string | null = null;
    if (msg.type === 'audio' && msg.mediaPath) {
      transcript = await this.speech.transcribe(msg.mediaPath);
    }
    const allowed = await this.capture.getAllowed(msg.jid);
    const display = msg.name || allowed?.name || msg.jid;
    const bindings = await this.capture.listBindings();
    const sameChannel = bindings.filter((b) => b.discordChannelId && b.discordChannelId === allowed?.discordChannelId);
    const prefix = inboundPrefix(sameChannel.length, display);
    const bodyParts = [
      prefix.trim(),
      msg.text,
      transcript ? `_Transcrição:_ ${transcript}` : null,
    ].filter(Boolean);
    const body = bodyParts.join('\n');

    let discordMessageId: string | null = null;
    if (allowed?.discordChannelId) {
      discordMessageId = await this.discord.postInbound({
        channelId: allowed.discordChannelId,
        body,
        files: msg.mediaPath ? [msg.mediaPath] : undefined,
      });
    }

    await this.prisma.message.create({
      data: {
        jid: msg.jid,
        direction: msg.fromMe ? 'out' : 'in',
        type: msg.type,
        body: msg.text || transcript,
        mediaPath: msg.mediaPath,
        transcript,
        discordMessageId,
        waMessageId: msg.waMessageId,
        rawJson: msg.raw ?? undefined,
      },
    });

    this.chatGateway.emitToFront({
      from: msg.jid,
      name: display,
      type: msg.type,
      message: msg.text,
      transcript,
      time: msg.timestamp,
      mediaPath: msg.mediaPath,
    });
  }

  async fromDiscord(msg: DiscordInbound) {
    const jids = await this.capture.jidsForDiscordChannel(msg.channelId);
    if (!jids.length) {
      return;
    }
    const sendAsAudio =
      (await this.capture.sendAsAudioForChannel(msg.channelId)) ||
      msg.content.trim().toLowerCase().startsWith('!tts ');
    const text = msg.content.replace(/^!tts\s+/i, '').trim();

    const files: Array<{ buffer: Buffer; name: string; mime?: string }> = [];
    for (const att of msg.attachments) {
      const res = await fetch(att.url);
      const buf = Buffer.from(await res.arrayBuffer());
      const mime = att.contentType || undefined;
      const ext = extFromMime(mime, att.name.split('.').pop() || 'bin');
      const path = await saveMedia(buf, ext);
      files.push({ buffer: buf, name: att.name, mime });
      void path;
    }

    for (const jid of jids) {
      try {
        await this.deliverToWhatsApp(jid, text, files, sendAsAudio, msg.messageId);
      } catch (err) {
        this.logger.error(`Falha ao enviar para ${jid}`, err as Error);
      }
    }
  }

  async sendFromFront(data: { to: string; message?: string; type?: string }) {
    const jid = normalizeJid(data.to);
    if (!this.capture.isAllowed(jid)) {
      throw new Error('Chat não está na allowlist');
    }
    await this.deliverToWhatsApp(jid, data.message || '', [], false, undefined);
  }

  private async deliverToWhatsApp(
    jid: string,
    text: string,
    files: Array<{ buffer: Buffer; name: string; mime?: string }>,
    sendAsAudio: boolean,
    discordMessageId?: string,
  ) {
    let lastWaId: string | undefined;
    const images = files.filter((f) => f.mime?.startsWith('image/'));
    const audios = files.filter((f) => f.mime?.startsWith('audio/'));
    const others = files.filter((f) => !f.mime?.startsWith('image/') && !f.mime?.startsWith('audio/'));

    for (const img of images) {
      const sent = await this.whatsapp.sendImage(jid, img.buffer, text || undefined);
      lastWaId = sent?.key?.id;
      await this.storeOut(jid, 'image', text, discordMessageId, lastWaId);
    }
    for (const audio of audios) {
      const sent = await this.whatsapp.sendAudio(jid, audio.buffer, true);
      lastWaId = sent?.key?.id;
      await this.storeOut(jid, 'audio', text, discordMessageId, lastWaId);
    }
    for (const file of others) {
      const sent = await this.whatsapp.sendFile(jid, file.buffer, file.name, file.mime);
      lastWaId = sent?.key?.id;
      await this.storeOut(jid, 'file', text, discordMessageId, lastWaId);
    }

    if (!files.length && text) {
      if (sendAsAudio) {
        const ogg = await this.speech.synthesize(text);
        if (ogg) {
          const sent = await this.whatsapp.sendAudio(jid, ogg, true);
          lastWaId = sent?.key?.id;
          await this.storeOut(jid, 'audio', text, discordMessageId, lastWaId);
          return;
        }
      }
      const sent = await this.whatsapp.sendText(jid, text);
      lastWaId = sent?.key?.id;
      await this.storeOut(jid, 'text', text, discordMessageId, lastWaId);
    }
  }

  private async storeOut(
    jid: string,
    type: string,
    body: string,
    discordMessageId?: string,
    waId?: string,
  ) {
    await this.prisma.message.create({
      data: {
        jid,
        direction: 'out',
        type,
        body: body || null,
        discordMessageId,
        waMessageId: waId ? `${jid}__${waId}` : undefined,
      },
    });
  }

  kind(jid: string) {
    return chatKind(jid);
  }
}
