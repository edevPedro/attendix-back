import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get(':userId')
  async getChat(@Param('userId') userId: string) {
    const chat = await this.chatService.getCachedChat(parseInt(userId, 10));

    if (!chat) {
      return { message: 'Nenhuma conversa encontrada para este usuário.' };
    }

    return { chat: JSON.parse(chat.message) };
  }

  @Post(':userId')
  async addMessage(
    @Param('userId') userId: string,
    @Body() body: { message: string; sender: 'user' | 'attendent' }
  ) {
    if (!body.message) {
      return { error: 'A mensagem não pode estar vazia.' };
    }

    await this.chatService.addMessageToChat(parseInt(userId, 10), body.message, body.sender);
    return { message: 'Mensagem adicionada com sucesso!' };
  }
}
