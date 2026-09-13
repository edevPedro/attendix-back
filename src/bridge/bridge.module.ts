import { Module } from '@nestjs/common';
import { CaptureModule } from 'src/capture/capture.module';
import { DiscordModule } from 'src/discord/discord.module';
import { WhatsappModule } from 'src/whatsapp/whatsapp.module';
import { SpeechModule } from 'src/speech/speech.module';
import { GatewayStoreModule } from 'src/gateway/gateway-store.module';
import { BridgeService } from './bridge.service';

@Module({
  imports: [CaptureModule, DiscordModule, WhatsappModule, SpeechModule, GatewayStoreModule],
  providers: [BridgeService],
  exports: [BridgeService],
})
export class BridgeModule {}
