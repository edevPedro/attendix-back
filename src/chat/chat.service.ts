import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll() {
    return this.prismaService.chat.findMany();
  }

  async createChat(data: { userId: string; attendentId: string; message: string }) {
    return this.prismaService.chat.create({
      data: {
        userId: parseInt(data.userId, 10),
        attendentId: parseInt(data.attendentId, 10),
        message: data.message
      }
    });
  }

  async findOne(id: string) {
    return this.prismaService.chat.findUnique({
      where: { id: parseInt(id, 10) },
    });
  }
}
