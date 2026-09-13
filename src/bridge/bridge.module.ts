import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CaptureModule } from 'src/capture/capture.module';
import { DiscordModule } from 'src/discord/discord.module';
import { WhatsappModule } from 'src/whatsapp/whatsapp.module';
import { SpeechModule } from 'src/speech/speech.module';
import { ChatModule } from 'src/chat/chat.module';
import { BridgeService } from './bridge.service';

@Module({
  imports: [PrismaModule, CaptureModule, DiscordModule, WhatsappModule, SpeechModule, ChatModule],
  providers: [BridgeService],
  exports: [BridgeService],
})
export class BridgeModule {}
