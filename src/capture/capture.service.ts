import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { chatKind, normalizeJid } from 'src/whatsapp/jid';
import { isCaptureEnabled } from './capture.policy';

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
      const rows = await this.prisma.allowedChat.findMany({
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
    if (!jid) {
      return;
    }
    const kind = chatKind(jid);
    if (kind === 'other') {
      return;
    }
    const display = name?.trim() || jid;
    await this.prisma.chatCatalog.upsert({
      where: { jid },
      create: { jid, name: display === jid ? jid : display, kind, lastSeen: new Date() },
      update: {
        lastSeen: new Date(),
        ...(name?.trim() && name.trim() !== jid ? { name: name.trim(), kind } : { kind }),
      },
    });
  }

  async listCatalog() {
    const [catalog, allowed] = await Promise.all([
      this.prisma.chatCatalog.findMany({ orderBy: { lastSeen: 'desc' } }),
      this.prisma.allowedChat.findMany(),
    ]);
    const byJid = new Map(allowed.map((row) => [row.jid, row]));
    const rows = catalog.map((chat) => {
      const allow = byJid.get(chat.jid);
      return {
        jid: chat.jid,
        name: allow?.name || chat.name,
        kind: chat.kind,
        lastSeen: chat.lastSeen,
        enabled: allow?.enabled === true,
        discordChannelId: allow?.discordChannelId ?? null,
        sendAsAudio: allow?.sendAsAudio === true,
      };
    });
    for (const allow of allowed) {
      if (rows.some((row) => row.jid === allow.jid)) continue;
      rows.unshift({
        jid: allow.jid,
        name: allow.name,
        kind: allow.kind,
        lastSeen: allow.updatedAt,
        enabled: allow.enabled,
        discordChannelId: allow.discordChannelId ?? null,
        sendAsAudio: allow.sendAsAudio,
      });
    }
    return rows;
  }

  async listBindings() {
    return this.prisma.allowedChat.findMany({
      where: { enabled: true },
    });
  }

  async getAllowed(jidRaw: string) {
    return this.prisma.allowedChat.findUnique({
      where: { jid: normalizeJid(jidRaw) },
    });
  }

  async setAllowed(input: {
    jid: string;
    name: string;
    kind: string;
    enabled: boolean;
    discordChannelId?: string | null;
    sendAsAudio?: boolean;
  }) {
    const jid = normalizeJid(input.jid);
    const row = await this.prisma.allowedChat.upsert({
      where: { jid },
      create: {
        jid,
        name: input.name,
        kind: input.kind,
        enabled: input.enabled,
        discordChannelId: input.discordChannelId ?? null,
        sendAsAudio: input.sendAsAudio ?? false,
      },
      update: {
        name: input.name,
        kind: input.kind,
        enabled: input.enabled,
        discordChannelId: input.discordChannelId ?? null,
        sendAsAudio: input.sendAsAudio ?? undefined,
      },
    });
    await this.refresh();
    return row;
  }

  async jidsForDiscordChannel(channelId: string): Promise<string[]> {
    const rows = await this.prisma.allowedChat.findMany({
      where: { enabled: true, discordChannelId: channelId },
      select: { jid: true },
    });
    return rows.map((row) => row.jid);
  }

  async sendAsAudioForChannel(channelId: string): Promise<boolean> {
    const list = await this.prisma.broadcastList.findUnique({
      where: { discordChannelId: channelId },
    });
    if (list) {
      return list.sendAsAudio;
    }
    const chats = await this.prisma.allowedChat.findMany({
      where: { enabled: true, discordChannelId: channelId },
    });
    return chats.length === 1 ? chats[0].sendAsAudio : false;
  }
}
