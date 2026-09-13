import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { mediaTtlMs } from './env';
import { pruneMedia } from './media-store';

@Injectable()
export class MediaRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaRetentionService.name);
  private timer: NodeJS.Timeout | null = null;

  onModuleInit() {
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), 6 * 3600 * 1000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweep() {
    const removed = await pruneMedia(mediaTtlMs());
    if (removed) this.logger.log(`Mídia expirada removida: ${removed} arquivo(s)`);
  }
}
