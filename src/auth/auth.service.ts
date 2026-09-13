import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';

const WEEK_MS = 7 * 24 * 3600 * 1000;

export function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

export function hashesMatch(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    if (!this.config.get('ADMIN_PASSWORD')) {
      this.logger.error('ADMIN_PASSWORD é obrigatório');
    }
  }

  adminUser(): string {
    return this.config.get<string>('ADMIN_USER') || 'admin';
  }

  credentialsOk(username: string, password: string): boolean {
    const pass = this.config.get<string>('ADMIN_PASSWORD');
    if (!pass) return false;
    return hashesMatch(username, this.adminUser()) && hashesMatch(password, pass);
  }

  async issueSession(): Promise<string> {
    await this.prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const token = randomBytes(32).toString('hex');
    await this.prisma.adminSession.create({
      data: {
        token,
        username: this.adminUser(),
        expiresAt: new Date(Date.now() + WEEK_MS),
      },
    });
    return token;
  }

  async sessionUser(token?: string | null): Promise<string | null> {
    if (!token) return null;
    const row = await this.prisma.adminSession.findUnique({ where: { token } });
    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) {
      await this.prisma.adminSession.delete({ where: { token } }).catch(() => undefined);
      return null;
    }
    return row.username;
  }

  async revoke(token?: string | null) {
    if (token) {
      await this.prisma.adminSession.delete({ where: { token } }).catch(() => undefined);
    }
  }
}
