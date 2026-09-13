import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';

export const MEDIA_DIR = join(process.cwd(), 'storage', 'media');

export async function saveMedia(buffer: Buffer, ext: string): Promise<string> {
  await mkdir(MEDIA_DIR, { recursive: true });
  const name = `${Date.now()}-${randomBytes(6).toString('hex')}.${ext.replace(/^\./, '')}`;
  const full = join(MEDIA_DIR, name);
  await writeFile(full, buffer);
  return full;
}

export function mediaFilename(fullPath: string): string {
  return fullPath.split(/[/\\]/).pop() || fullPath;
}

export function extFromMime(mime?: string, fallback = 'bin'): string {
  if (!mime) {
    return fallback;
  }
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
