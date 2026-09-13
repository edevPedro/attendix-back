import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

export const ADMIN_COOKIE = 'attendix_admin';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const cookie = req.cookies?.[ADMIN_COOKIE];
    const header = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
    const user = this.auth.sessionUser(cookie || header || null);
    if (!user) {
      throw new UnauthorizedException('Admin authentication required');
    }
    req.adminUser = user;
    return true;
  }
}
