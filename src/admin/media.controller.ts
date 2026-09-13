import { Controller, Get, NotFoundException, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { AdminGuard } from 'src/auth/admin.guard';
import { mediaAbs } from 'src/common/media-store';

@Controller('admin/media')
@UseGuards(AdminGuard)
export class MediaController {
  @Get(':filename')
  file(@Param('filename') filename: string, @Res() res: Response) {
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new NotFoundException();
    }
    const full = mediaAbs(filename);
    if (!existsSync(full)) {
      throw new NotFoundException();
    }
    return createReadStream(full).pipe(res);
  }
}
