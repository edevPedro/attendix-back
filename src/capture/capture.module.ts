import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CaptureService } from './capture.service';

@Module({
  imports: [PrismaModule],
  providers: [CaptureService],
  exports: [CaptureService],
})
export class CaptureModule {}
