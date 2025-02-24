import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { createClient } from 'redis';
import { timestamp } from 'rxjs';


@Injectable()
export class ChatService {
  private redisClient;

  constructor(private readonly prismaService: PrismaService) {
    this.redisClient = createClient();
    this.redisClient.connect().catch(console.error);
  }

  async getCachedChat(userId: number) {
    const chatKey = `chat:${userId}`;
    console.log('get')
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const cachedChat = await Promise.race([
        this.redisClient.get(chatKey),
        new Promise((_, reject) => {
          controller.signal.addEventListener('abort', () => reject(new Error('Redis timeout')));
        }),
      ]);
      console.log('gettado')
      return cachedChat ? JSON.parse(cachedChat) : null;
    } catch (error) {
      console.error('Redis cache error:', error);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  async cacheChat(userId: number, chat: any) {
    const chatKey = `chat:${userId}`;
    await this.redisClient.set(chatKey, JSON.stringify(chat), { EX: 28800 });
  }

  async getOrCreateChat(userId: number, message: string) {
    let chat = await this.getCachedChat(userId);
  
    if (!chat) {
      const initialMessage = {
        messages: [{ 
          id: Date.now(), 
          sender: 'user', 
          text: message, 
          timestamp: new Date().toISOString() 
        }]
      };
  
      chat = await this.prismaService.chat.create({
        data: { userId, message: JSON.stringify(initialMessage) },
      });
  
      await this.cacheChat(userId, chat);
    }
  
    return chat;
  }

  async addMessageToChat(userId: number, message: string, sender: 'user' | 'attendent') {
    let chat = await this.getOrCreateChat(userId, message);
    
    const chatData = JSON.parse(chat.message);
    chatData.messages.push({
      id: Date.now(),
      sender,
      text: message,
      timestamp: new Date().toISOString()
    });
  
    const updatedChat = await this.prismaService.chat.update({
      where: { id: chat.id },
      data: { message: JSON.stringify(chatData) },
    });
  
    await this.cacheChat(userId, updatedChat);
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
