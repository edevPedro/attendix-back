import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export const ADMIN_COOKIE = 'attendix_admin';

export function adminToken(user: string, secret: string): string {
  return createHmac('sha256', secret).update(user).digest('hex');
}

export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const expected = this.expectedToken();
    const cookie = req.cookies?.[ADMIN_COOKIE];
    const header = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = cookie || header;
    if (!provided || !tokensMatch(provided, expected)) {
      throw new UnauthorizedException('Admin authentication required');
    }
    return true;
  }

  expectedToken(): string {
    const user = this.config.get<string>('ADMIN_USER') || 'admin';
    const secret =
      this.config.get<string>('ADMIN_SECRET') ||
      this.config.get<string>('ADMIN_PASSWORD') ||
      'changeme';
    return adminToken(user, secret);
  }
}
