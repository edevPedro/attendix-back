import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ChatHistoryService } from './chat-history.service';

@Controller('chat-history')
export class ChatHistoryController {
  constructor(private readonly chatHistoryService: ChatHistoryService) {}

  @Get(':userId')
  async findByUserId(@Param('userId') userId: string) {
    return this.chatHistoryService.findByUserId(userId);
  }

  @Post()
  async createChatHistory(@Body() data: { userId: string; message: string }) {
    return this.chatHistoryService.createChatHistory(data);
  }
}
