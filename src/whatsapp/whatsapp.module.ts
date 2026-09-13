import { Module } from '@nestjs/common';
import { CaptureModule } from 'src/capture/capture.module';
import { GatewayStoreModule } from 'src/gateway/gateway-store.module';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [CaptureModule, GatewayStoreModule],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
