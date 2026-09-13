import { mkdir, readdir, stat, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { mediaMaxBytes } from './env';

export const MEDIA_DIR = join(process.cwd(), 'storage', 'media');

export function mediaFilename(fullPath: string): string {
  return fullPath.split(/[/\\]/).pop() || fullPath;
}

export function mediaAbs(stored: string): string {
  return join(MEDIA_DIR, mediaFilename(stored));
}

export async function saveMedia(buffer: Buffer, ext: string): Promise<string> {
  if (buffer.length > mediaMaxBytes()) {
    throw new Error(`mídia excede ${mediaMaxBytes()} bytes`);
  }
  await mkdir(MEDIA_DIR, { recursive: true });
  const name = `${Date.now()}-${randomBytes(6).toString('hex')}.${ext.replace(/^\./, '')}`;
  await writeFile(join(MEDIA_DIR, name), buffer);
  return name;
}

export async function pruneMedia(maxAgeMs: number): Promise<number> {
  let removed = 0;
  try {
    const files = await readdir(MEDIA_DIR);
    const cutoff = Date.now() - maxAgeMs;
    for (const file of files) {
      const full = join(MEDIA_DIR, file);
      const info = await stat(full).catch(() => null);
      if (!info?.isFile() || info.mtimeMs > cutoff) continue;
      await unlink(full).catch(() => undefined);
      removed += 1;
    }
  } catch {
    /* dir may not exist yet */
  }
  return removed;
}

export function extFromMime(mime?: string, fallback = 'bin'): string {
  if (!mime) return fallback;
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('webm')) return 'webm';
  return fallback;
}
