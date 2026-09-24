import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { EmailService } from '../email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('EmailService', () => {
  let service: EmailService;
  let mockPrisma: {
    emailTemplate: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    emailLog: {
      create: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    mockPrisma = {
      emailTemplate: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      emailLog: {
        create: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('is not configured when SMTP env vars are missing (no fake transport)', () => {
    expect(service.isConfigured()).toBe(false);
  });

  it('fails fast with ServiceUnavailableException instead of simulating delivery', async () => {
    mockPrisma.emailTemplate.findFirst.mockResolvedValue({
      id: 'tpl-1',
      organizationId: 'org-1',
      subject: 'Test',
      htmlBody: '<p>Hi {{name}}</p>',
      textBody: 'Hi',
    });

    const send = () =>
      service.sendTemplatedEmail('org-1', {
        recipient: 'parent@example.com',
        templateId: 'tpl-1',
      });

    await expect(send).rejects.toThrow(ServiceUnavailableException);
    await expect(send).rejects.toThrow(/not configured/i);
  });

  it('never writes a fake DELIVERED EmailLog when SMTP is unconfigured', async () => {
    mockPrisma.emailTemplate.findFirst.mockResolvedValue({
      id: 'tpl-1',
      organizationId: 'org-1',
      subject: 'Test',
      htmlBody: '<p>Hi</p>',
      textBody: 'Hi',
    });

    await service.sendTemplatedEmail('org-1', {
      recipient: 'parent@example.com',
      templateId: 'tpl-1',
    }).catch(() => undefined);

    expect(mockPrisma.emailLog.create).not.toHaveBeenCalled();
  });
});
