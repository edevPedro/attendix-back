import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { waMessageId, WaKey } from 'src/whatsapp/message-extract';

@Injectable()
export class MessageStore {
  constructor(private readonly prisma: PrismaService) {}

  async findByWaId(id: string) {
    if (!id) return null;
    return this.prisma.message.findUnique({ where: { waMessageId: id } });
  }

  async findByDiscordId(id: string) {
    if (!id) return null;
    return this.prisma.message.findFirst({ where: { discordMessageId: id } });
  }

  async protoForRetry(key: WaKey): Promise<Record<string, unknown> | { conversation: string }> {
    const stored = await this.findByWaId(waMessageId(key));
    if (stored?.rawJson && typeof stored.rawJson === 'object' && !Array.isArray(stored.rawJson)) {
      return stored.rawJson as Record<string, unknown>;
    }
    return { conversation: stored?.body || ' ' };
  }

  async record(data: Prisma.MessageCreateInput) {
    if (data.waMessageId) {
      return this.prisma.message.upsert({
        where: { waMessageId: data.waMessageId },
        create: data,
        update: {
          discordMessageId: data.discordMessageId ?? undefined,
          transcript: data.transcript ?? undefined,
          mediaPath: data.mediaPath ?? undefined,
          body: data.body ?? undefined,
          rawJson: data.rawJson ?? undefined,
        },
      });
    }
    return this.prisma.message.create({ data });
  }
}
