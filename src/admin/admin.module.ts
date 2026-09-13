import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CaptureModule } from 'src/capture/capture.module';
import { DiscordModule } from 'src/discord/discord.module';
import { WhatsappModule } from 'src/whatsapp/whatsapp.module';
import { BridgeModule } from 'src/bridge/bridge.module';
import { AuthModule } from 'src/auth/auth.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { MediaController } from './media.controller';

@Module({
  imports: [PrismaModule, CaptureModule, DiscordModule, WhatsappModule, BridgeModule, AuthModule],
  controllers: [AdminController, MediaController],
  providers: [AdminService],
})
export class AdminModule {}
