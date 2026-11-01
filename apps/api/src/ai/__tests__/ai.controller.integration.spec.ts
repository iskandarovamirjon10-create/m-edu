import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import request from 'supertest';
import { AiModule } from '../ai.module';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

describe('AiController (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dbAvailable = false;
  const currentRole = 'ORG_ADMIN';
  const testOrgId = 'a0000000-0000-0000-0000-000000000001';
  const testUserId = 'a0000000-0000-0000-0000-000000000002';

  beforeAll(async () => {
    try {
      const net = await import('net');
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection({ port: 5432, host: '127.0.0.1', timeout: 800 });
        socket.on('connect', () => { socket.destroy(); resolve(); });
        socket.on('error', (err) => { socket.destroy(); reject(err); });
        socket.on('timeout', () => { socket.destroy(); reject(new Error('timeout')); });
      });
      dbAvailable = true;
    } catch {
      dbAvailable = false;
    }

    if (!dbAvailable) {
      return;
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), AiModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: vi.fn((key: string) => {
          if (key === 'JWT_SECRET') return 'test-jwt-secret-key-at-least-32-chars-long';
          return process.env[key] || '';
        }),
      })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          req.user = { organizationId: testOrgId, sub: testUserId, role: currentRole };
          return true;
        } 
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    
    try {
      await prisma.organization.upsert({
        where: { id: testOrgId },
        update: {},
        create: { id: testOrgId, name: 'Test Org', email: 'test-org-ai@example.com' },
      });
      await prisma.user.upsert({
        where: { id: testUserId },
        update: {},
        create: {
          id: testUserId,
          email: 'test-ai-user@example.com',
          firstName: 'Test',
          lastName: 'User',
          organizationId: testOrgId,
          role: 'ORG_ADMIN',
        },
      });
    } catch {}
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.aiMessage.deleteMany({ where: { organizationId: testOrgId } }).catch(() => {});
      await prisma.aiConversation.deleteMany({ where: { organizationId: testOrgId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: testUserId } }).catch(() => {});
      await prisma.organization.deleteMany({ where: { id: testOrgId } }).catch(() => {});
    }
    if (app) await app.close();
  });

  it.skipIf(() => !dbAvailable)('/ai/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/ai/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.ok).toBe(true);
      });
  });

  it.skipIf(() => !dbAvailable)('/ai/conversations (GET)', () => {
    return request(app.getHttpServer())
      .get('/ai/conversations')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it.skipIf(() => !dbAvailable)('/ai/conversations (POST)', () => {
    return request(app.getHttpServer())
      .post('/ai/conversations')
      .send({ title: 'Integration Test' })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
      });
  });

  it.skipIf(() => !dbAvailable)('/ai/insights (GET)', () => {
    return request(app.getHttpServer())
      .get('/ai/insights?scope=global')
      .set('X-Page-Context', '/dashboard')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it.skipIf(() => !dbAvailable)('/ai/suggestions (GET)', () => {
    return request(app.getHttpServer())
      .get('/ai/suggestions?context=/attendance')
      .set('Accept-Language', 'uz')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });
});
