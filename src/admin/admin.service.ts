import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaptureService } from 'src/capture/capture.service';
import { DiscordService } from 'src/discord/discord.service';
import { WhatsappService } from 'src/whatsapp/whatsapp.service';
import { BridgeService } from 'src/bridge/bridge.service';
import { asBool } from 'src/common/bool';
import { chatKind, normalizeJid } from 'src/whatsapp/jid';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capture: CaptureService,
    private readonly discord: DiscordService,
    private readonly whatsapp: WhatsappService,
    private readonly bridge: BridgeService,
  ) {}

  whatsappStatus() {
    return this.whatsapp.publicStatus();
  }

  discordStatus() {
    return this.discord.status();
  }

  async ready() {
    return {
      database: await this.prisma.ping(),
      whatsapp: this.whatsapp.publicStatus(),
      discord: this.discord.status(),
      allowlist: this.capture.enabledCount(),
    };
  }

  async pair(phoneNumber: string) {
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) {
      throw new BadRequestException('phoneNumber deve ser DDI+número (10–15 dígitos)');
    }
    try {
      const code = await this.whatsapp.requestPairingCode(digits);
      return { code };
    } catch (err) {
      throw new ServiceUnavailableException((err as Error).message);
    }
  }

  async addChat(body: { jid: string; name?: string; enabled?: boolean; sendAsAudio?: boolean }) {
    if (!body.jid?.trim()) {
      throw new BadRequestException('jid é obrigatório');
    }
    const jid = normalizeJid(body.jid.trim());
    if (chatKind(jid) === 'other') {
      throw new BadRequestException('JID inválido. Use número@s.whatsapp.net ou grupo@g.us');
    }
    return this.patchChat(jid, {
      enabled: asBool(body.enabled, false),
      name: body.name,
      sendAsAudio: asBool(body.sendAsAudio),
    });
  }

  catalog() {
    return this.capture.listCatalog();
  }

  async patchChat(
    jidRaw: string,
    body: {
      enabled?: boolean;
      discordChannelId?: string | null;
      broadcastListId?: number | null;
      sendAsAudio?: boolean;
      name?: string;
    },
  ) {
    const jid = normalizeJid(jidRaw);
    const existing = await this.capture.getChat(jid);
    const name = body.name?.trim() || existing?.name || jid;
    const kind = existing?.kind || chatKind(jid);
    const enabled = asBool(body.enabled, existing?.enabled ?? false) ?? false;
    const sendAsAudio = asBool(body.sendAsAudio);
    const listId =
      body.broadcastListId === undefined ? existing?.listId ?? null : body.broadcastListId;

    if (listId) {
      const list = await this.prisma.broadcastList.findUnique({ where: { id: listId } });
      if (!list) throw new NotFoundException('Lista de transmissão não encontrada');
      return this.capture.saveChat({
        jid,
        name,
        kind,
        enabled,
        listId,
        discordChannelId: null,
        sendAsAudio,
      });
    }

    let discordChannelId =
      body.discordChannelId === undefined ? existing?.discordChannelId ?? null : body.discordChannelId;

    if (enabled && !discordChannelId && this.discord.ready) {
      discordChannelId = await this.discord.createChatChannel(name, jid);
    }

    return this.capture.saveChat({
      jid,
      name,
      kind,
      enabled,
      listId: null,
      discordChannelId,
      sendAsAudio,
    });
  }

  async createBroadcast(body: { name: string; jids?: string[]; sendAsAudio?: boolean }) {
    if (!body.name?.trim()) {
      throw new BadRequestException('name é obrigatório');
    }
    const jids = (body.jids || []).map((j) => normalizeJid(j)).filter(Boolean);
    for (const jid of jids) {
      if (chatKind(jid) === 'other') {
        throw new BadRequestException(`JID inválido: ${jid}`);
      }
    }
    if (!this.discord.ready) {
      throw new BadRequestException('Discord precisa estar conectado para criar o canal da lista');
    }
    const channelId = await this.discord.createChatChannel(body.name, `list-${Date.now()}`);
    const list = await this.prisma.broadcastList.create({
      data: {
        name: body.name.trim(),
        discordChannelId: channelId,
        sendAsAudio: asBool(body.sendAsAudio, false) ?? false,
      },
    });
    for (const raw of jids) {
      await this.addBroadcastMember(list.id, raw);
    }
    return this.getBroadcast(list.id);
  }

  async addBroadcastMember(listId: number, jidRaw: string) {
    const list = await this.prisma.broadcastList.findUnique({ where: { id: listId } });
    if (!list) throw new NotFoundException('Lista não encontrada');
    const jid = normalizeJid(jidRaw);
    if (chatKind(jid) === 'other') {
      throw new BadRequestException('JID inválido');
    }
    const existing = await this.capture.getChat(jid);
    await this.capture.saveChat({
      jid,
      name: existing?.name || jid,
      kind: existing?.kind || chatKind(jid),
      enabled: true,
      listId,
      discordChannelId: null,
    });
    return this.getBroadcast(listId);
  }

  async removeBroadcastMember(listId: number, jidRaw: string) {
    const jid = normalizeJid(jidRaw);
    const current = await this.capture.getChat(jid);
    if (current?.listId === listId) {
      await this.capture.saveChat({
        jid,
        listId: null,
        discordChannelId: null,
      });
    }
    return this.getBroadcast(listId);
  }

  listBroadcasts() {
    return this.prisma.broadcastList.findMany({
      include: { chats: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBroadcast(id: number) {
    const list = await this.prisma.broadcastList.findUnique({
      where: { id },
      include: { chats: true },
    });
    if (!list) throw new NotFoundException('Lista não encontrada');
    return list;
  }

  async inbox(jidRaw: string) {
    const jid = normalizeJid(jidRaw);
    if (!this.capture.isAllowed(jid)) {
      throw new ForbiddenException('Chat não habilitado para captura');
    }
    return this.prisma.message.findMany({
      where: { jid },
      orderBy: { createdAt: 'asc' },
      take: 500,
      select: {
        id: true,
        jid: true,
        direction: true,
        type: true,
        body: true,
        mediaPath: true,
        transcript: true,
        createdAt: true,
      },
    });
  }

  async reply(jidRaw: string, message: string) {
    if (!message.trim()) {
      throw new BadRequestException('message é obrigatório');
    }
    if (!this.whatsapp.isOpen()) {
      throw new ServiceUnavailableException('WhatsApp não está conectado');
    }
    try {
      await this.bridge.sendFromFront({ to: jidRaw, message });
      return { ok: true };
    } catch (err) {
      const text = (err as Error).message || '';
      if (text.includes('allowlist')) throw new ForbiddenException(text);
      throw new ServiceUnavailableException(text || 'Falha ao enviar');
    }
  }

  async deleteBroadcast(id: number) {
    const list = await this.prisma.broadcastList.findUnique({ where: { id } });
    if (!list) throw new NotFoundException('Lista não encontrada');
    await this.prisma.waChat.updateMany({
      where: { listId: id },
      data: { listId: null, discordChannelId: null },
    });
    await this.prisma.broadcastList.delete({ where: { id } });
    await this.capture.refresh();
    return { ok: true };
  }
}
