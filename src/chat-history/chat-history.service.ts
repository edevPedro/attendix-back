import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ChatHistoryService {
  constructor(private readonly prismaService: PrismaService) {}

  async findByUserId(userId: string) {
    return this.prismaService.chatHistory.findMany({
      where: { userId: parseInt(userId, 10) }, 
    });
  }

  async createChatHistory(data: { userId: string; message: string }) {
    return this.prismaService.chatHistory.create({
      data: {
        userId: parseInt(data.userId, 10), 
        message: data.message,
      },
    });
  }
}
