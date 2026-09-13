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
    return this.whatsapp.status;
  }

  discordStatus() {
    return this.discord.status();
  }

  async ready() {
    return {
      database: await this.prisma.ping(),
      whatsapp: this.whatsapp.status,
      discord: this.discord.status(),
      allowlist: this.capture.enabledCount(),
    };
  }

  async pair(phoneNumber: string) {
    if (!phoneNumber) {
      throw new BadRequestException('phoneNumber é obrigatório');
    }
    try {
      const code = await this.whatsapp.requestPairingCode(phoneNumber);
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
    await this.prisma.chatCatalog.upsert({
      where: { jid },
      create: { jid, name: body.name?.trim() || jid, kind: chatKind(jid) },
      update: { name: body.name?.trim() || undefined },
    });
    return this.patchChat(jid, {
      enabled: body.enabled ?? false,
      name: body.name,
      sendAsAudio: body.sendAsAudio,
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
    const catalog = await this.prisma.chatCatalog.findUnique({ where: { jid } });
    const existing = await this.prisma.allowedChat.findUnique({ where: { jid } });
    const name = body.name || catalog?.name || existing?.name || jid;
    const kind = catalog?.kind || existing?.kind || chatKind(jid);
    const enabled = body.enabled ?? existing?.enabled ?? false;

    let discordChannelId =
      body.discordChannelId === undefined ? existing?.discordChannelId ?? null : body.discordChannelId;

    if (body.broadcastListId) {
      const list = await this.prisma.broadcastList.findUnique({
        where: { id: body.broadcastListId },
      });
      if (!list) {
        throw new NotFoundException('Lista de transmissão não encontrada');
      }
      discordChannelId = list.discordChannelId;
      await this.prisma.broadcastMember.upsert({
        where: { listId_jid: { listId: list.id, jid } },
        create: { listId: list.id, jid },
        update: {},
      });
    }

    if (enabled && !discordChannelId && this.discord.ready) {
      discordChannelId = await this.discord.createChatChannel(name, jid);
    }

    return this.capture.setAllowed({
      jid,
      name,
      kind,
      enabled,
      discordChannelId,
      sendAsAudio: body.sendAsAudio,
    });
  }

  async createBroadcast(body: { name: string; jids?: string[]; sendAsAudio?: boolean }) {
    if (!body.name?.trim()) {
      throw new BadRequestException('name é obrigatório');
    }
    if (!this.discord.ready) {
      throw new BadRequestException('Discord precisa estar conectado para criar o canal da lista');
    }
    const channelId = await this.discord.createChatChannel(body.name, `list-${Date.now()}`);
    const list = await this.prisma.broadcastList.create({
      data: {
        name: body.name.trim(),
        discordChannelId: channelId,
        sendAsAudio: body.sendAsAudio ?? false,
      },
    });
    for (const raw of body.jids || []) {
      await this.addBroadcastMember(list.id, raw);
    }
    return this.getBroadcast(list.id);
  }

  async addBroadcastMember(listId: number, jidRaw: string) {
    const list = await this.prisma.broadcastList.findUnique({ where: { id: listId } });
    if (!list) {
      throw new NotFoundException('Lista não encontrada');
    }
    const jid = normalizeJid(jidRaw);
    const catalog = await this.prisma.chatCatalog.findUnique({ where: { jid } });
    await this.prisma.broadcastMember.upsert({
      where: { listId_jid: { listId, jid } },
      create: { listId, jid },
      update: {},
    });
    await this.capture.setAllowed({
      jid,
      name: catalog?.name || jid,
      kind: catalog?.kind || chatKind(jid),
      enabled: true,
      discordChannelId: list.discordChannelId,
    });
    return this.getBroadcast(listId);
  }

  async removeBroadcastMember(listId: number, jidRaw: string) {
    const jid = normalizeJid(jidRaw);
    const list = await this.prisma.broadcastList.findUnique({ where: { id: listId } });
    await this.prisma.broadcastMember.deleteMany({ where: { listId, jid } });
    const remaining = await this.prisma.broadcastMember.findMany({ where: { jid } });
    const current = await this.capture.getAllowed(jid);
    if (current) {
      let nextChannel: string | null = current.discordChannelId;
      if (remaining.length > 0) {
        const other = await this.prisma.broadcastList.findUnique({ where: { id: remaining[0].listId } });
        nextChannel = other?.discordChannelId ?? null;
      } else if (list && current.discordChannelId === list.discordChannelId) {
        nextChannel = null;
      }
      if (nextChannel !== current.discordChannelId) {
        await this.capture.setAllowed({
          jid,
          name: current.name,
          kind: current.kind,
          enabled: current.enabled,
          discordChannelId: nextChannel,
          sendAsAudio: current.sendAsAudio,
        });
      }
    }
    return this.getBroadcast(listId);
  }

  async listBroadcasts() {
    return this.prisma.broadcastList.findMany({
      include: { members: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBroadcast(id: number) {
    const list = await this.prisma.broadcastList.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!list) {
      throw new NotFoundException('Lista não encontrada');
    }
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
    });
  }

  async reply(jidRaw: string, message: string) {
    if (!message.trim()) {
      throw new BadRequestException('message é obrigatório');
    }
    await this.bridge.sendFromFront({ to: jidRaw, message });
    return { ok: true };
  }
}
