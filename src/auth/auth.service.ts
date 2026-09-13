import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { WEEK_MS } from './cookie';

export function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

export function sha256Hex(value: string): string {
  return sha256(value).toString('hex');
}

export function hashesMatch(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

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
        token: sha256Hex(token),
        username: this.adminUser(),
        expiresAt: new Date(Date.now() + WEEK_MS),
      },
    });
    return token;
  }

  async sessionUser(token?: string | null): Promise<string | null> {
    if (!token) return null;
    const hashed = sha256Hex(token);
    const row = await this.prisma.adminSession.findUnique({ where: { token: hashed } });
    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) {
      await this.prisma.adminSession.delete({ where: { token: hashed } }).catch(() => undefined);
      return null;
    }
    return row.username;
  }

  async revoke(token?: string | null) {
    if (token) {
      await this.prisma.adminSession.delete({ where: { token: sha256Hex(token) } }).catch(() => undefined);
    }
  }
}
