import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AdminGuard } from 'src/auth/admin.guard';

@Controller('chat')
@UseGuards(AdminGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get(':userId')
  async getChat(@Param('userId') userId: string) {
    return this.chatService.findOne(userId);
  }
}
