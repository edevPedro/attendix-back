import { Module } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [AdminGuard],
  exports: [AdminGuard],
})
export class AuthModule {}
