import { Module } from '@nestjs/common';
import { AttendentService } from './attendent.service';
import { AttendentController } from './attendent.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AttendentController],
  providers: [AttendentService],
})
export class AttendentModule {}
