import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException } from '@nestjs/common';
import { AiService } from '../ai.service';

interface MockPrisma {
  aiConversation: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  aiMessage: { create: ReturnType<typeof vi.fn> };
  student: { count: ReturnType<typeof vi.fn> };
  group: { count: ReturnType<typeof vi.fn> };
  teacher: { count: ReturnType<typeof vi.fn> };
  payment: {
    aggregate: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
}

function createPrisma(): MockPrisma {
  return {
    aiConversation: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async (args: any) => ({
        id: 'conv-new',
        organizationId: args.data.organizationId,
        createdBy: args.data.createdBy,
        title: args.data.title,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      update: vi.fn(async () => ({})),
    },
    aiMessage: {
      create: vi.fn(async (args: any) => ({
        id: `msg-${args.data.role}`,
        createdAt: new Date('2026-01-02T03:04:05.000Z'),
        ...args.data,
      })),
    },
    student: { count: vi.fn(async () => 12) },
    group: { count: vi.fn(async () => 3) },
    teacher: { count: vi.fn(async () => 4) },
    payment: {
      aggregate: vi.fn(async () => ({ _sum: { amount: 250000 } })),
      findMany: vi.fn(async () => [
        { amount: 150000, student: { user: { firstName: 'Ali', lastName: 'Valiyev' } } },
      ]),
    },
  };
}

function createConfig() {
  return { get: vi.fn(() => undefined) } as any;
}

/**
 * The service caches the GenAI client; injecting a recording double lets the
 * suite assert on the exact system prompt without a network call.
 */
function attachFakeClient(service: AiService) {
  const generateContent = vi.fn(async (params: any) => ({ text: 'AI reply' }));
  const generateContentStream = vi.fn(async (params: any) => ({
    stream: (async function* () {
      yield { text: 'streamed' };
    })(),
  }));
  (service as unknown as { aiInstance: unknown }).aiInstance = {
    models: { generateContent, generateContentStream },
  };
  return { generateContent, generateContentStream };
}

function createService(prisma: MockPrisma) {
  return new AiService(prisma as any, createConfig());
}

const ORG = 'org-1';
const USER = 'user-1';

describe('AiService', () => {
  let prisma: MockPrisma;
  let service: AiService;

  beforeEach(() => {
    prisma = createPrisma();
    service = createService(prisma);
    attachFakeClient(service);
  });

  describe('conversation ownership (cross-tenant / cross-user guard)', () => {
    it('rejects a conversation the caller does not own', async () => {
      prisma.aiConversation.findFirst.mockResolvedValue(null);

      const err = await service
        .chat(ORG, USER, 'hello', [], 'someone-elses-conv')
        .catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(403);
      expect(prisma.aiMessage.create).not.toHaveBeenCalled();
    });

    it('creates a conversation when none is supplied', async () => {
      await service.chat(ORG, USER, 'salom', []);

      expect(prisma.aiConversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: ORG, createdBy: USER }),
        }),
      );
    });

    it('never queries another organization when loading a conversation', async () => {
      prisma.aiConversation.findFirst.mockResolvedValue({ id: 'conv-owned' });

      await service.chat(ORG, USER, 'salom', [], 'conv-owned');

      expect(prisma.aiConversation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv-owned', organizationId: ORG, createdBy: USER },
        }),
      );
    });
  });

  describe('financial data in the model prompt', () => {
    it('omits debt and payer identities unless explicitly allowed', async () => {
      const { generateContent } = attachFakeClient(service);

      await service.chat(ORG, USER, 'qanday yordam bera olasan?', []);

      expect(generateContent).toHaveBeenCalledTimes(1);
      const instruction = generateContent.mock.calls[0][0].config.systemInstruction as string;
      expect(instruction).not.toContain("Kutilayotgan to'lovlar");
      expect(instruction).not.toContain('Ali Valiyev');
      expect(instruction).toContain('Jami talabalar: 12 nafar');
      expect(prisma.payment.aggregate).not.toHaveBeenCalled();
      expect(prisma.payment.findMany).not.toHaveBeenCalled();
    });

    it('injects the aggregates for admin callers', async () => {
      const { generateContent } = attachFakeClient(service);

      await service.chat(ORG, USER, 'qanday yordam bera olasan?', [], undefined, true);

      const instruction = generateContent.mock.calls[0][0].config.systemInstruction as string;
      expect(instruction).toContain("Kutilayotgan to'lovlar (qarzlar): 250000 so'm");
      expect(instruction).toContain('Ali Valiyev paid 150000');
      expect(prisma.payment.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: ORG }) }),
      );
    });

    it('keeps the stream endpoint free of financials by default', async () => {
      attachFakeClient(service);
      const res = { setHeader: vi.fn(), write: vi.fn(), end: vi.fn() };

      await service.chatStream(ORG, USER, 'qanday yordam bera olasan?', [], undefined, res as any);

      expect(prisma.payment.aggregate).not.toHaveBeenCalled();
      expect(prisma.payment.findMany).not.toHaveBeenCalled();
      expect(res.end).toHaveBeenCalled();
    });
  });

  describe('tenant scoping of aggregated counters', () => {
    it('counts only the caller organization', async () => {
      await service.chat(ORG, USER, 'salom', []);

      expect(prisma.student.count).toHaveBeenCalledWith({ where: { organizationId: ORG } });
      expect(prisma.group.count).toHaveBeenCalledWith({ where: { organizationId: ORG } });
      expect(prisma.teacher.count).toHaveBeenCalledWith({ where: { organizationId: ORG } });
    });
  });

  describe('error handling', () => {
    it('rethrows HttpExceptions as-is (403 stays 403)', async () => {
      prisma.aiConversation.findFirst.mockResolvedValue(null);

      const err = await service.chat(ORG, USER, 'hi', [], 'conv-x').catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(403);
    });
  });
});
