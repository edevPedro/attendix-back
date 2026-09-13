import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class ChatService {
  private redisClient: RedisClientType | null = null;
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly prismaService: PrismaService) {
    const url = process.env.REDIS_URL;
    if (url) {
      this.redisClient = createClient({ url });
      this.redisClient.connect().catch((err) => this.logger.warn(`Redis: ${err.message}`));
    }
  }

  async findOne(id: string) {
    return this.prismaService.chat.findUnique({
      where: { id: parseInt(id, 10) },
    });
  }

  async findAll() {
    return this.prismaService.chat.findMany();
  }
}
