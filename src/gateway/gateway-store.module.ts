import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MessageStore } from './message-store';

@Module({
  imports: [PrismaModule],
  providers: [MessageStore],
  exports: [MessageStore],
})
export class GatewayStoreModule {}
