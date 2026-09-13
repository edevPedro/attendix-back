import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ADMIN_COOKIE, AdminGuard } from './admin.guard';
import { AuthService } from './auth.service';
import { adminCookieOptions } from './cookie';
import { loginAllowed, loginFailed, loginSucceeded } from './login-throttle';

@Controller('admin')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Req() req: Request,
    @Body() body: { username?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (!loginAllowed(ip)) {
      throw new UnauthorizedException('Muitas tentativas. Aguarde alguns minutos.');
    }
    if (!this.auth.credentialsOk(body.username || '', body.password || '')) {
      loginFailed(ip);
      throw new UnauthorizedException('Credenciais inválidas');
    }
    loginSucceeded(ip);
    const token = await this.auth.issueSession();
    res.cookie(ADMIN_COOKIE, token, adminCookieOptions());
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.revoke(req.cookies?.[ADMIN_COOKIE]);
    res.clearCookie(ADMIN_COOKIE, adminCookieOptions());
    return { ok: true };
  }

  @Get('session')
  @UseGuards(AdminGuard)
  session() {
    return { ok: true, user: this.auth.adminUser() };
  }
}
