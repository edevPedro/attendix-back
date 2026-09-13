import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { existsSync } from 'fs';

const TMP = join(process.cwd(), 'storage', 'speech');

@Injectable()
export class SpeechService implements OnModuleInit {
  private readonly logger = new Logger(SpeechService.name);
  private transcriber: any = null;
  private loading: Promise<void> | null = null;
  private queue: Promise<void> = Promise.resolve();

  private pending = 0;
  private readonly maxQueue = 6;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    mkdir(TMP, { recursive: true }).catch(() => undefined);
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T | null> {
    if (this.pending >= this.maxQueue) {
      this.logger.warn('Fila de speech cheia — pulando');
      return Promise.resolve(null);
    }
    this.pending += 1;
    const run = this.queue.then(fn, fn);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run.finally(() => {
      this.pending -= 1;
    });
  }

  async transcribe(inputPath: string): Promise<string | null> {
    return this.enqueue(async () => {
      try {
        await this.ensureTranscriber();
        if (!this.transcriber) {
          return null;
        }
        const wav = join(TMP, `${randomBytes(8).toString('hex')}.wav`);
        await this.ffmpeg(inputPath, wav, ['-ar', '16000', '-ac', '1']);
        const audio = await this.readWavFloats(wav);
        await unlink(wav).catch(() => undefined);
        const result = await Promise.race([
          this.transcriber(audio, {
            chunk_length_s: 30,
            language: this.config.get('WHISPER_LANGUAGE') || 'portuguese',
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('whisper timeout')), 45_000)),
        ]);
        const text = typeof result === 'string' ? result : result?.text;
        return text?.trim() || null;
      } catch (err) {
        this.logger.warn(`STT falhou: ${(err as Error).message}`);
        return null;
      }
    });
  }

  async synthesize(text: string): Promise<Buffer | null> {
    return this.enqueue(async () => {
      const wav = join(TMP, `${randomBytes(8).toString('hex')}.wav`);
      const ogg = join(TMP, `${randomBytes(8).toString('hex')}.ogg`);
      try {
        const piper = this.config.get<string>('PIPER_BIN') || 'piper';
        const voice = this.config.get<string>('PIPER_VOICE');
        const spoken = text.slice(0, 4000);
        if (voice && (await this.commandExists(piper))) {
          await this.run(piper, ['--model', voice, '--output_file', wav], spoken);
        } else if (await this.commandExists('espeak-ng')) {
          await this.run('espeak-ng', ['-v', 'pt', '-w', wav, spoken]);
        } else if (await this.commandExists('espeak')) {
          await this.run('espeak', ['-v', 'pt', '-w', wav, spoken]);
        } else {
          this.logger.warn('Nenhum TTS local (piper/espeak) encontrado');
          return null;
        }
        await this.ffmpeg(wav, ogg, ['-c:a', 'libopus', '-b:a', '16k']);
        const { readFile } = await import('fs/promises');
        const buf = await readFile(ogg);
        return buf;
      } catch (err) {
        this.logger.warn(`TTS falhou: ${(err as Error).message}`);
        return null;
      } finally {
        await unlink(wav).catch(() => undefined);
        await unlink(ogg).catch(() => undefined);
      }
    });
  }

  private async ensureTranscriber() {
    if (this.transcriber) return;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const { pipeline, env } = await import('@xenova/transformers');
        env.cacheDir = join(process.cwd(), 'storage', 'whisper');
        const model = this.config.get('WHISPER_MODEL') || 'Xenova/whisper-tiny';
        this.transcriber = await pipeline('automatic-speech-recognition', model);
        this.logger.log(`Whisper local carregado: ${model}`);
      } catch (err) {
        this.logger.warn(`Não foi possível carregar Whisper: ${(err as Error).message}`);
        this.transcriber = null;
        this.loading = null;
      }
    })();
    await this.loading;
  }

  private ffmpeg(input: string, output: string, extra: string[]): Promise<void> {
    return this.run('ffmpeg', ['-y', '-i', input, ...extra, output]);
  }

  private run(cmd: string, args: string[], stdin?: string, timeoutMs = 20_000): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args);
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`${cmd} timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      child.stderr.on('data', (d) => {
        stderr += d.toString();
      });
      if (stdin) {
        child.stdin.write(stdin);
        child.stdin.end();
      }
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-400)}`));
      });
    });
  }

  private async commandExists(cmd: string): Promise<boolean> {
    if (cmd.includes('/') && existsSync(cmd)) return true;
    try {
      await this.run('which', [cmd]);
      return true;
    } catch {
      return false;
    }
  }

  private async readWavFloats(path: string): Promise<Float32Array> {
    const raw = join(TMP, `${randomBytes(8).toString('hex')}.f32`);
    await this.ffmpeg(path, raw, ['-f', 'f32le', '-acodec', 'pcm_f32le', '-ar', '16000', '-ac', '1']);
    const { readFile } = await import('fs/promises');
    const buf = await readFile(raw);
    await unlink(raw).catch(() => undefined);
    return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  }
}
