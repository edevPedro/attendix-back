import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthModule } from './auth.module';

describe('admin auth http', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              ADMIN_USER: 'admin',
              ADMIN_PASSWORD: 'pw',
              ADMIN_SECRET: 's3cret',
            }),
          ],
        }),
        AuthModule,
      ],
    }).compile();
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

  it('login then session', async () => {
    const login = await request(app.getHttpServer())
      .post('/admin/login')
      .send({ username: 'admin', password: 'pw' })
      .expect(201);
    const cookie = login.headers['set-cookie'][0];
    await request(app.getHttpServer()).get('/admin/session').set('Cookie', cookie).expect(200);
  });
});
