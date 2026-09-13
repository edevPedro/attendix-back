import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { assertRuntimeConfig, trustProxy } from './common/env';

async function bootstrap() {
  assertRuntimeConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
  });
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });
  if (trustProxy()) app.set('trust proxy', 1);
  app.enableShutdownHooks();
  app.use(cookieParser());
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    next();
  });
  const origin = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: origin?.length ? origin : false,
    credentials: true,
  });
  app.useStaticAssets(join(process.cwd(), 'public'), { index: 'index.html' });
  const port = Number(process.env.PORT ?? 3300);
  await app.listen(port, '0.0.0.0');
  console.log(`Gateway em http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
