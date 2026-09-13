import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { CaptureModule } from './capture/capture.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { DiscordModule } from './discord/discord.module';
import { SpeechModule } from './speech/speech.module';
import { BridgeModule } from './bridge/bridge.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CaptureModule,
    WhatsappModule,
    DiscordModule,
    SpeechModule,
    BridgeModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
