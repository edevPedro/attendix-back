import { Body, Controller, Get, HttpCode, Post, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ADMIN_COOKIE, AdminGuard, adminToken, tokensMatch } from './admin.guard';

@Controller('admin')
export class AuthController {
  constructor(
    private readonly config: ConfigService,
    private readonly guard: AdminGuard,
  ) {}

  @Post('login')
  @HttpCode(200)
  login(
    @Body() body: { username?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = this.config.get<string>('ADMIN_USER') || 'admin';
    const pass = this.config.get<string>('ADMIN_PASSWORD') || 'changeme';
    if (!tokensMatch(body.username || '', user) || !tokensMatch(body.password || '', pass)) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const token = this.guard.expectedToken();
    res.cookie(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000,
    });
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ADMIN_COOKIE);
    return { ok: true };
  }

  @Get('session')
  @UseGuards(AdminGuard)
  session() {
    return { ok: true, user: this.config.get('ADMIN_USER') || 'admin' };
  }
}

export { adminToken };
