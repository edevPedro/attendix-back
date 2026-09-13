import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CaptureModule } from 'src/capture/capture.module';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [PrismaModule, CaptureModule],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
