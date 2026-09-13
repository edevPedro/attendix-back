import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(cookieParser());
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
bootstrap();
