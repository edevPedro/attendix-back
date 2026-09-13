import { Module } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AdminGuard, AuthService],
  exports: [AdminGuard, AuthService],
})
export class AuthModule {}
