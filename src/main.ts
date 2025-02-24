import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { sock } from './whatsapp-socket/conn';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3300);
  console.log(`Server is running on http://localhost:${process.env.PORT ?? 3300}`);
  console.log(sock)
}
bootstrap();
