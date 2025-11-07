import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Quotient Advisor Agent (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Chat Endpoints', () => {
    it('/chat (POST) - should return advice and analysis', () => {
      return request(app.getHttpServer())
        .post('/chat')
        .send({ message: 'I feel stuck in my career' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('response');
          expect(res.body).toHaveProperty('sessionId');
          expect(res.body).toHaveProperty('analysis');
          expect(res.body).toHaveProperty('recommendations');
          expect(res.body.analysis).toHaveProperty('dominantQuotients');
          expect(res.body.analysis).toHaveProperty('needsAttention');
        });
    });

    it('/chat/quotients (GET) - should return all quotients', () => {
      return request(app.getHttpServer())
        .get('/chat/quotients')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBe(10);
          expect(res.body[0]).toHaveProperty('id');
          expect(res.body[0]).toHaveProperty('name');
          expect(res.body[0]).toHaveProperty('fullName');
        });
    });

    it('/chat/quotients/:id (GET) - should return specific quotient', () => {
      return request(app.getHttpServer())
        .get('/chat/quotients/eq')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', 'eq');
          expect(res.body).toHaveProperty('fullName', 'Emotional Quotient (Emotional Intelligence)');
          expect(res.body).toHaveProperty('keyAspects');
          expect(res.body).toHaveProperty('characteristics');
        });
    });
  });
});

