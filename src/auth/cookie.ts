import { cookieSecure } from '../common/env';

export const WEEK_MS = 7 * 24 * 3600 * 1000;

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: cookieSecure(),
    maxAge: WEEK_MS,
    path: '/',
  };
}
