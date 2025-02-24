import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { AttendentModule } from './attendent/attendent.module';
import { ChatModule } from './chat/chat.module';
import {ConfigModule} from '@nestjs/config';

@Module({
  imports: [PrismaModule, AttendentModule, UserModule, ChatModule, ConfigModule.forRoot()], 

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
