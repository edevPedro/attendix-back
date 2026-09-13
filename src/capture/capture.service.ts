import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { chatKind, normalizeJid } from 'src/whatsapp/jid';
import { ChannelBinding, isCaptureEnabled, resolveFanoutJids, routedChannelId } from './capture.policy';

@Injectable()
export class CaptureService {
  private readonly logger = new Logger(CaptureService.name);
  private enabled = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.refresh();
  }

  async refresh() {
    try {
      const rows = await this.prisma.waChat.findMany({
        where: { enabled: true },
        select: { jid: true },
      });
      this.enabled = new Set(rows.map((row) => row.jid));
      this.logger.log(`Allowlist loaded: ${this.enabled.size} chat(s)`);
    } catch (err) {
      this.logger.warn(`Allowlist não carregada (DB?): ${(err as Error).message}`);
      this.enabled = new Set();
      setTimeout(() => this.refresh().catch(() => undefined), 15_000);
    }
  }

  isAllowed(jid: string): boolean {
    return isCaptureEnabled(this.enabled, normalizeJid(jid));
  }

  enabledCount(): number {
    return this.enabled.size;
  }

  async upsertCatalog(jidRaw: string, name?: string | null) {
    const jid = normalizeJid(jidRaw);
    const kind = chatKind(jid);
    if (!jid || kind === 'other') return;
    const label = name?.trim();
    await this.prisma.waChat.upsert({
      where: { jid },
      create: { jid, name: label || jid, kind, enabled: false, lastSeen: new Date() },
      update: {
        lastSeen: new Date(),
        kind,
        ...(label && label !== jid ? { name: label } : {}),
      },
    });
  }

  async listCatalog() {
    const chats = await this.prisma.waChat.findMany({
      include: { list: true },
      orderBy: { lastSeen: 'desc' },
    });
    return chats.map((chat) => ({
      jid: chat.jid,
      name: chat.name,
      kind: chat.kind,
      lastSeen: chat.lastSeen,
      enabled: chat.enabled,
      discordChannelId: routedChannelId({
        jid: chat.jid,
        enabled: chat.enabled,
        discordChannelId: chat.discordChannelId,
        listChannelId: chat.list?.discordChannelId ?? null,
      }),
      sendAsAudio: chat.list ? chat.list.sendAsAudio : chat.sendAsAudio,
      listId: chat.listId,
      listName: chat.list?.name ?? null,
    }));
  }

  async bindings(): Promise<ChannelBinding[]> {
    const chats = await this.prisma.waChat.findMany({
      where: { enabled: true },
      include: { list: true },
    });
    return chats.map((chat) => ({
      jid: chat.jid,
      enabled: chat.enabled,
      discordChannelId: chat.discordChannelId,
      listChannelId: chat.list?.discordChannelId ?? null,
    }));
  }

  async jidsForChannel(channelId: string): Promise<string[]> {
    return resolveFanoutJids(channelId, await this.bindings());
  }

  async getChat(jidRaw: string) {
    return this.prisma.waChat.findUnique({
      where: { jid: normalizeJid(jidRaw) },
      include: { list: true },
    });
  }

  async saveChat(input: {
    jid: string;
    name?: string;
    kind?: string;
    enabled?: boolean;
    discordChannelId?: string | null;
    sendAsAudio?: boolean;
    listId?: number | null;
  }) {
    const jid = normalizeJid(input.jid);
    const kind = input.kind || chatKind(jid);
    const name = input.name?.trim() || jid;
    const listId = input.listId === undefined ? undefined : input.listId;
    const discordChannelId =
      listId ? null : input.discordChannelId === undefined ? undefined : input.discordChannelId;

    const row = await this.prisma.waChat.upsert({
      where: { jid },
      create: {
        jid,
        name,
        kind,
        enabled: input.enabled ?? false,
        discordChannelId: listId ? null : (input.discordChannelId ?? null),
        sendAsAudio: input.sendAsAudio ?? false,
        listId: listId ?? null,
        lastSeen: new Date(),
      },
      update: {
        name: input.name === undefined ? undefined : name,
        kind: input.kind === undefined ? undefined : kind,
        enabled: input.enabled,
        discordChannelId,
        sendAsAudio: input.sendAsAudio,
        listId,
      },
    });
    await this.refresh();
    return this.getChat(jid);
  }

  async sendAsAudioForChannel(channelId: string): Promise<boolean> {
    const list = await this.prisma.broadcastList.findUnique({
      where: { discordChannelId: channelId },
    });
    if (list) return list.sendAsAudio;
    const chats = await this.prisma.waChat.findMany({
      where: { enabled: true, discordChannelId: channelId, listId: null },
    });
    return chats.length === 1 ? chats[0].sendAsAudio : false;
  }
}
