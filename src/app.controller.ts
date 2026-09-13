import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('health')
  health() {
    return this.appService.getHealth();
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    const database = await this.prisma.ping();
    if (!database) res.status(503);
    return { ok: database, database };
  }
}
