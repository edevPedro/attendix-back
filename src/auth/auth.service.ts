import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const WEEK_MS = 7 * 24 * 3600 * 1000;

export function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

export function hashesMatch(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

@Injectable()
export class AuthService {
  private readonly sessions = new Map<string, { user: string; exp: number }>();

  constructor(private readonly config: ConfigService) {}

  adminUser(): string {
    return this.config.get<string>('ADMIN_USER') || 'admin';
  }

  adminPassword(): string {
    const pass = this.config.get<string>('ADMIN_PASSWORD');
    if (!pass) {
      throw new Error('ADMIN_PASSWORD is required');
    }
    return pass;
  }

  credentialsOk(username: string, password: string): boolean {
    try {
      return hashesMatch(username, this.adminUser()) && hashesMatch(password, this.adminPassword());
    } catch {
      return false;
    }
  }

  issueSession(): string {
    const token = randomBytes(32).toString('hex');
    this.sessions.set(token, { user: this.adminUser(), exp: Date.now() + WEEK_MS });
    return token;
  }

  sessionUser(token?: string | null): string | null {
    if (!token) return null;
    const row = this.sessions.get(token);
    if (!row) return null;
    if (row.exp < Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    return row.user;
  }

  revoke(token?: string | null) {
    if (token) this.sessions.delete(token);
  }
}
