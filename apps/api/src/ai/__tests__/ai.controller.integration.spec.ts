// M-EDU AI Copilot — integration pass
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AiModule } from '../ai.module';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

describe('AiController (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const currentRole = 'ORG_ADMIN';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AiModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          req.user = { organizationId: 'org-1', sub: 'user-1', role: currentRole };
          return true;
        } 
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    
    try {
      await prisma.organization.create({ data: { id: 'org-1', name: 'Test Org' } }).catch(() => {});
      await prisma.user.create({ data: { id: 'user-1', email: 'test@example.com', organizationId: 'org-1' } }).catch(() => {});
    } catch {}
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ai/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/ai/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.ok).toBe(true);
      });
  });

  it('/ai/conversations (GET)', () => {
    return request(app.getHttpServer())
      .get('/ai/conversations')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it('/ai/conversations (POST)', () => {
    return request(app.getHttpServer())
      .post('/ai/conversations')
      .send({ title: 'Integration Test' })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
      });
  });

  it('/ai/insights (GET)', () => {
    return request(app.getHttpServer())
      .get('/ai/insights?scope=global')
      .set('X-Page-Context', '/dashboard')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it('/ai/suggestions (GET)', () => {
    return request(app.getHttpServer())
      .get('/ai/suggestions?context=/attendance')
      .set('Accept-Language', 'uz')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });
});
