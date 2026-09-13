import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'events';
import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  TextChannel,
} from 'discord.js';
import { createReadStream } from 'fs';
import { basename } from 'path';
import { sanitizeChannelName } from 'src/whatsapp/jid';

export type DiscordInbound = {
  channelId: string;
  messageId: string;
  content: string;
  attachments: Array<{ name: string; url: string; contentType?: string | null }>;
};

@Injectable()
export class DiscordService extends EventEmitter implements OnModuleInit {
  private readonly logger = new Logger(DiscordService.name);
  private client: Client | null = null;
  ready = false;

  constructor(private readonly config: ConfigService) {
    super();
  }

  status() {
    return {
      configured: Boolean(this.config.get('DISCORD_TOKEN')),
      ready: this.ready,
      user: this.client?.user?.tag || null,
    };
  }

  async onModuleInit() {
    const token = this.config.get<string>('DISCORD_TOKEN');
    if (!token) {
      this.logger.warn('DISCORD_TOKEN ausente — gateway Discord desligado');
      return;
    }
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel],
    });
    this.client.on(Events.ClientReady, () => {
      this.ready = true;
      this.logger.log(`Discord conectado como ${this.client?.user?.tag}`);
    });
    this.client.on(Events.MessageCreate, async (message) => {
      if (!message.guild || message.author.bot) {
        return;
      }
      if (this.client?.user && message.author.id === this.client.user.id) {
        return;
      }
      const inbound: DiscordInbound = {
        channelId: message.channelId,
        messageId: message.id,
        content: message.content || '',
        attachments: [...message.attachments.values()].map((att) => ({
          name: att.name,
          url: att.url,
          contentType: att.contentType,
        })),
      };
      this.emit('inbound', inbound);
    });
    try {
      await this.client.login(token);
    } catch (err) {
      this.logger.error('Falha ao autenticar no Discord', err as Error);
    }
  }

  async createChatChannel(name: string, jid: string): Promise<string> {
    const guild = await this.requireGuild();
    const categoryId = this.config.get<string>('DISCORD_CATEGORY_ID');
    const channel = await guild.channels.create({
      name: sanitizeChannelName(name, jid),
      type: ChannelType.GuildText,
      parent: categoryId || undefined,
      topic: `WhatsApp ${jid}`,
    });
    return channel.id;
  }

  async postInbound(opts: {
    channelId: string;
    body: string;
    files?: string[];
  }): Promise<string | null> {
    const channel = await this.getTextChannel(opts.channelId);
    if (!channel) return null;
    const files = (opts.files || []).map((file) => ({
      attachment: createReadStream(file),
      name: basename(file),
    }));
    const sent = await channel.send({
      content: opts.body?.slice(0, 2000) || (files.length ? undefined : '(mídia)'),
      files: files.length ? files : undefined,
    });
    return sent.id;
  }

  private async getTextChannel(id: string): Promise<TextChannel | null> {
    if (!this.client || !this.ready) return null;
    const ch = await this.client.channels.fetch(id).catch(() => null);
    if (!ch || !ch.isTextBased() || ch.isDMBased()) return null;
    return ch as TextChannel;
  }

  private async requireGuild() {
    if (!this.client || !this.ready) {
      throw new Error('Discord não está pronto');
    }
    const guildId = this.config.get<string>('DISCORD_GUILD_ID');
    if (!guildId) {
      throw new Error('DISCORD_GUILD_ID não configurado');
    }
    const guild = await this.client.guilds.fetch(guildId);
    return guild;
  }
}
