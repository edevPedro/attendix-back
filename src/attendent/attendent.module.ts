import { Module } from '@nestjs/common';
import { AttendentService } from './attendent.service';
import { AttendentController } from './attendent.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],  
  controllers: [AttendentController],
  providers: [AttendentService],
})
export class AttendentModule {}
