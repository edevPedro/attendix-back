import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ADMIN_COOKIE, AdminGuard } from './admin.guard';
import { AuthService } from './auth.service';

@Controller('admin')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(
    @Body() body: { username?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!this.auth.credentialsOk(body.username || '', body.password || '')) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const token = this.auth.issueSession();
    res.cookie(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 7 * 24 * 3600 * 1000,
    });
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.auth.revoke(req.cookies?.[ADMIN_COOKIE]);
    res.clearCookie(ADMIN_COOKIE);
    return { ok: true };
  }

  @Get('session')
  @UseGuards(AdminGuard)
  session() {
    return { ok: true, user: this.auth.adminUser() };
  }
}
