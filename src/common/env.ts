export function assertRuntimeConfig() {
  const missing: string[] = [];
  if (!process.env.POSTGRESQL_URL?.trim()) missing.push('POSTGRESQL_URL');
  if (!process.env.ADMIN_PASSWORD?.trim()) missing.push('ADMIN_PASSWORD');
  if (missing.length) {
    throw new Error(`Variáveis obrigatórias ausentes: ${missing.join(', ')}`);
  }
}

export function cookieSecure(): boolean {
  return process.env.COOKIE_SECURE === 'true';
}

export function trustProxy(): boolean {
  return process.env.TRUST_PROXY === 'true';
}

export function mediaMaxBytes(): number {
  const n = Number(process.env.MEDIA_MAX_BYTES);
  return Number.isFinite(n) && n > 0 ? n : 12 * 1024 * 1024;
}

export function mediaTtlMs(): number {
  const hours = Number(process.env.MEDIA_TTL_HOURS);
  const h = Number.isFinite(hours) && hours > 0 ? hours : 24 * 14;
  return h * 3600 * 1000;
}
