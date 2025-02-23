import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  async findAll() {
    return this.chatService.findAll();
  }

  @Post()
  async createChat(@Body() data: { userId: string; attendentId: string; message: string }) {
    return this.chatService.createChat(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.chatService.findOne(id);
  }
}
