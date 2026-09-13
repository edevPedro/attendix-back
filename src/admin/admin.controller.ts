import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from 'src/auth/admin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('whatsapp/status')
  whatsappStatus() {
    return this.admin.whatsappStatus();
  }

  @Post('whatsapp/pair')
  pair(@Body() body: { phoneNumber?: string }) {
    return this.admin.pair(body.phoneNumber || '');
  }

  @Get('discord/status')
  discordStatus() {
    return this.admin.discordStatus();
  }

  @Get('chats/catalog')
  catalog() {
    return this.admin.catalog();
  }

  @Patch('chats/:jid')
  patchChat(
    @Param('jid') jid: string,
    @Body()
    body: {
      enabled?: boolean;
      discordChannelId?: string | null;
      broadcastListId?: number | null;
      sendAsAudio?: boolean;
      name?: string;
    },
  ) {
    return this.admin.patchChat(decodeURIComponent(jid), body);
  }

  @Get('broadcasts')
  broadcasts() {
    return this.admin.listBroadcasts();
  }

  @Post('broadcasts')
  createBroadcast(@Body() body: { name: string; jids?: string[]; sendAsAudio?: boolean }) {
    return this.admin.createBroadcast(body);
  }

  @Post('broadcasts/:id/members')
  addMember(@Param('id') id: string, @Body() body: { jid: string }) {
    return this.admin.addBroadcastMember(Number(id), body.jid);
  }

  @Delete('broadcasts/:id/members/:jid')
  removeMember(@Param('id') id: string, @Param('jid') jid: string) {
    return this.admin.removeBroadcastMember(Number(id), decodeURIComponent(jid));
  }

  @Get('inbox/:jid')
  inbox(@Param('jid') jid: string) {
    return this.admin.inbox(decodeURIComponent(jid));
  }

  @Post('inbox/:jid/reply')
  reply(@Param('jid') jid: string, @Body() body: { message?: string }) {
    return this.admin.reply(decodeURIComponent(jid), body.message || '');
  }
}
