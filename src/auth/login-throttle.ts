const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;

type Bucket = { fails: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function loginAllowed(ip: string): boolean {
  const now = Date.now();
  const key = ip || 'unknown';
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { fails: 0, resetAt: now + WINDOW_MS });
    return true;
  }
  return bucket.fails < MAX_FAILS;
}

export function loginFailed(ip: string) {
  const now = Date.now();
  const key = ip || 'unknown';
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { fails: 1, resetAt: now + WINDOW_MS });
    return;
  }
  bucket.fails += 1;
}

export function loginSucceeded(ip: string) {
  buckets.delete(ip || 'unknown');
}

/** Test helper */
export function resetLoginThrottle() {
  buckets.clear();
}
