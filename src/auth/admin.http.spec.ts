import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthModule } from './auth.module';
import { PrismaService } from 'src/prisma/prisma.service';

describe('admin auth http', () => {
  let app: INestApplication;
  const sessions = new Map<string, { token: string; username: string; expiresAt: Date }>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ ADMIN_USER: 'admin', ADMIN_PASSWORD: 'pw' })],
        }),
        AuthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({
        adminSession: {
          deleteMany: async () => undefined,
          create: async ({ data }: { data: { token: string; username: string; expiresAt: Date } }) => {
            sessions.set(data.token, data);
            return data;
          },
          findUnique: async ({ where }: { where: { token: string } }) => sessions.get(where.token) ?? null,
          delete: async ({ where }: { where: { token: string } }) => {
            sessions.delete(where.token);
          },
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects session without cookie', async () => {
    await request(app.getHttpServer()).get('/admin/session').expect(401);
  });

  it('login then session then logout invalidates', async () => {
    const login = await request(app.getHttpServer())
      .post('/admin/login')
      .send({ username: 'admin', password: 'pw' })
      .expect(200);
    const cookie = login.headers['set-cookie'][0];
    await request(app.getHttpServer()).get('/admin/session').set('Cookie', cookie).expect(200);
    await request(app.getHttpServer()).post('/admin/logout').set('Cookie', cookie).expect(200);
    await request(app.getHttpServer()).get('/admin/session').set('Cookie', cookie).expect(401);
  });
});
