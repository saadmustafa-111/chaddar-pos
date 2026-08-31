import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirror the production bootstrap: '/api/v1' global prefix.
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  it('/api/v1/health (GET) returns a healthy payload', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        const body = res.body as { status?: string } | undefined;
        if (!body || body.status !== 'ok') {
          throw new Error(
            `Unexpected health payload: ${JSON.stringify(res.body)}`,
          );
        }
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
