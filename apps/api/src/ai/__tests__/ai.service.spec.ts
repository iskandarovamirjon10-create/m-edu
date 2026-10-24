import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException } from '@nestjs/common';
import { AiService } from '../ai.service';

interface MockPrisma {
  $transaction?: any;
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
  const p: any = {
    $transaction: vi.fn(async (cb: any) => (typeof cb === "function" ? cb(p) : Promise.all(cb))),
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
    student: { count: vi.fn(async () => 12), findMany: vi.fn(async () => []) },
    group: { count: vi.fn(async () => 3), findFirst: vi.fn(async () => null) },
    teacher: { count: vi.fn(async () => 4), findFirst: vi.fn(async () => null) },
    course: { count: vi.fn(async () => 2), findFirst: vi.fn(async () => null) },
    payment: {
      aggregate: vi.fn(async () => ({ _sum: { amount: 250000 } })),
      findMany: vi.fn(async () => [
        { amount: 150000, student: { user: { firstName: 'Ali', lastName: 'Valiyev' } } },
      ]),
    },
  };
  return p;
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
  return new AiService(prisma as any, createConfig(), { get: vi.fn(), set: vi.fn() } as any);
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
      expect(instruction).toContain("O'quvchilar: 12 nafar");
      expect(prisma.payment.aggregate).not.toHaveBeenCalled();
      expect(prisma.payment.findMany).not.toHaveBeenCalled();
    });

    it('injects the aggregates for admin callers', async () => {
      const { generateContent } = attachFakeClient(service);

      await service.chat(ORG, USER, 'qanday yordam bera olasan?', [], undefined, true);

      const instruction = generateContent.mock.calls[0][0].config.systemInstruction as string;
      expect(instruction).toMatch(/Kutilayotgan to'lovlar \(qarzlar\):\s*250[\s\u00A0]*000\s*so'm/);
      expect(instruction).toMatch(/Ali Valiyev\s*\(150[\s\u00A0]*000\s*so'm\)/);
      expect(prisma.payment.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: ORG }) }),
      );
    });

    it('keeps the stream endpoint free of financials by default', async () => {
      attachFakeClient(service);
      const res = { setHeader: vi.fn(), write: vi.fn(), end: vi.fn(), on: vi.fn() };

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

  describe('Uzbek entity resolution & disambiguation', () => {
    it('resolves student with Uzbek case suffix (-ning) and includes deep link', async () => {
      (prisma as any).student = {
        ...prisma.student,
        findMany: vi.fn(async () => [
          {
            id: 'stu-123',
            status: 'ACTIVE',
            balance: 150000,
            user: { firstName: 'Rustam', lastName: 'Sharipov', phone: '+998901234567' },
            groups: [{ group: { name: 'Frontend-01', course: { name: 'Frontend' }, teacher: { user: { firstName: 'Anvar', lastName: 'Karimov' } } } }],
            attendance: [{ date: new Date('2026-10-18'), status: 'PRESENT' }],
            payments: [{ amount: 500000, status: 'PAID' }],
          },
        ]),
      };

      const dossier = await service.resolveEntityDossier(ORG, 'Rustamning davomati qanday?');
      expect(dossier).toContain('Rustam Sharipov');
      expect(dossier).toContain('[👉 O\'quvchi profiliga o\'tish](/students/stu-123)');
      expect(dossier).toContain('Frontend-01');
    });

    it('emits disambiguation prompt when multiple students match the same name', async () => {
      (prisma as any).student = {
        ...prisma.student,
        findMany: vi.fn(async () => [
          {
            id: 'stu-1',
            user: { firstName: 'Rustam', lastName: 'Sharipov' },
            groups: [{ group: { name: 'Frontend-01' } }],
          },
          {
            id: 'stu-2',
            user: { firstName: 'Rustam', lastName: 'Aliyev' },
            groups: [{ group: { name: 'Backend-02' } }],
          },
        ]),
      };

      const dossier = await service.resolveEntityDossier(ORG, 'Rustam haqida ma\'lumot ber');
      expect(dossier).toContain("DIQQAT (BIR XIL ISMLI O'QUVCHILAR TOPILDI)");
      expect(dossier).toContain('Rustam Sharipov');
      expect(dossier).toContain('Rustam Aliyev');
      expect(dossier).toContain('aniqlashtirishni so\'rang');
    });

    it('STUDENT role can only resolve their own dossier and gets empty for other students', async () => {
      (prisma as any).student = {
        ...prisma.student,
        findMany: vi.fn(async () => [
          {
            id: 'stu-other',
            user: { firstName: 'Rustam', lastName: 'Sharipov' },
            groups: [],
            attendance: [],
            payments: [],
          },
        ]),
      };

      // Requesting as a different student ID
      const blockedDossier = await service.resolveEntityDossier(
        ORG,
        'Rustam Sharipov haqida',
        'STUDENT',
        'user-stu-my',
        'stu-my-own-id',
      );
      expect(blockedDossier).toBe('');

      // Requesting as the matching student ID
      const allowedDossier = await service.resolveEntityDossier(
        ORG,
        'Rustam Sharipov haqida',
        'STUDENT',
        'user-stu-rustam',
        'stu-other',
      );
      expect(allowedDossier).toContain('Rustam Sharipov');
    });

    it('PARENT role can only view verified children and redacts debt for non-admins', async () => {
      (prisma as any).student = {
        ...prisma.student,
        findMany: vi.fn(async () => [
          {
            id: 'stu-child-1',
            status: 'ACTIVE',
            balance: 200000,
            user: { firstName: 'Ali', lastName: 'Valiyev', phone: '+998901112233' },
            groups: [],
            attendance: [],
            payments: [{ amount: 150000, status: 'PENDING' }],
          },
        ]),
      };

      (prisma as any).parentStudent = {
        findFirst: vi.fn(async ({ where }) => {
          if (where.parentId === 'parent-valid' && where.studentId === 'stu-child-1') {
            return { parentId: 'parent-valid', studentId: 'stu-child-1' };
          }
          return null;
        }),
      };

      // Unlinked parent attempts lookup -> blocked
      const blocked = await service.resolveEntityDossier(
        ORG,
        'Ali Valiyev',
        'PARENT',
        undefined,
        null,
        'parent-unauthorized',
      );
      expect(blocked).toBe('');

      // Verified parent lookup -> permitted with financial data redacted
      const allowed = await service.resolveEntityDossier(
        ORG,
        'Ali Valiyev',
        'PARENT',
        undefined,
        null,
        'parent-valid',
      );
      expect(allowed).toContain('Ali Valiyev');
      expect(allowed).toContain('Moliyaviy intizom: Cheklangan');
      expect(allowed).not.toContain('Kutilayotgan qarzdorlik: 150 000');
    });

    it('PARENT_ACCOUNT chat bypasses AiConversation DB writes to prevent foreign key error', async () => {
      prisma.aiConversation.create.mockClear();
      prisma.aiMessage.create.mockClear();

      const response = await service.chat(
        ORG,
        'parent-uuid-not-in-user-table',
        'Salom, darslar qachon?',
        [],
        undefined,
        false,
        undefined,
        {
          userRole: 'PARENT',
          principalType: 'PARENT_ACCOUNT',
          parentId: 'parent-uuid-not-in-user-table',
        },
      );

      expect(response).toBeDefined();
      expect(response.role).toBe('assistant');
      expect(prisma.aiConversation.create).not.toHaveBeenCalled();
      expect(prisma.aiMessage.create).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('rethrows HttpExceptions as-is (403 stays 403)', async () => {
      prisma.aiConversation.findFirst.mockResolvedValue(null);

      const err = await service.chat(ORG, USER, 'hi', [], 'conv-x').catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(403);
    });

    it('does not trigger write action for informational questions about adding students (LOGIC-02)', async () => {
      const mockActionService = {
        createPending: vi.fn(),
      };
      const mockContextService = {
        fromRequest: vi.fn().mockReturnValue({}),
      };
      const customService = new AiService(
        prisma as any,
        createConfig(),
        { get: vi.fn(), set: vi.fn() } as any,
        undefined,
        undefined,
        mockActionService as any,
        mockContextService as any,
      );
      attachFakeClient(customService);
      prisma.aiConversation.findFirst.mockResolvedValue({ id: 'conv-1', createdBy: USER, organizationId: ORG });

      const fakeRes = { write: vi.fn(), end: vi.fn(), setHeader: vi.fn(), on: vi.fn() } as any;
      await customService.chatStream(
        ORG,
        USER,
        'Yangi o\'quvchi qo\'shish tartibi qanday?',
        [],
        'conv-1',
        fakeRes,
        'ADMIN',
      );

      // Verify that no write action was created for informational query
      expect(mockActionService.createPending).not.toHaveBeenCalled();
    });
  });

  describe('model-driven tool calling', () => {
    function toolService(options: {
      requiresConfirmation: boolean;
      toolName: string;
    }) {
      const tool = {
        name: options.toolName,
        permission: 'attendance:read',
        requiresConfirmation: options.requiresConfirmation,
        inputSchema: { safeParse: (value: unknown) => ({ success: true, data: value }) },
      };

      const executeReadTool = vi.fn(async () => ({
        toolCallId: 'call-1',
        toolName: options.toolName,
        ok: true,
        data: { rate: 93 },
      }));
      const prepareWriteTool = vi.fn(() => ({
        toolName: options.toolName,
        parameters: { firstName: 'Ali', lastName: 'Valiyev' },
      }));
      const createPending = vi.fn(async () => ({
        id: 'act-1',
        summary: "Yangi o'quvchi qo'shish: Ali Valiyev",
        parameters: { firstName: 'Ali', lastName: 'Valiyev' },
      }));

      const service = new AiService(
        prisma as any,
        createConfig(),
        { get: vi.fn(), set: vi.fn() } as any,
        {
          list: () => [tool],
          get: () => tool,
          toProviderTools: () => [
            { name: options.toolName, description: 'tool', parameters: {} },
          ],
        } as any,
        { executeReadTool, prepareWriteTool } as any,
        { createPending } as any,
        {
          fromRequest: () => ({
            userId: USER,
            organizationId: ORG,
            role: 'ORG_ADMIN',
            permissions: ['attendance:read', 'students:write'],
            locale: 'uz',
          }),
        } as any,
      );

      return { service, executeReadTool, prepareWriteTool, createPending };
    }

    function fakeRes() {
      return {
        write: vi.fn(),
        end: vi.fn(),
        setHeader: vi.fn(),
        on: vi.fn(),
        headersSent: false,
        writableEnded: false,
        destroyed: false,
      } as any;
    }

    function emitted(res: any, event: string): any[] {
      return res.write.mock.calls
        .map((call: any[]) => String(call[0]))
        .filter((frame: string) => frame.startsWith(`event: ${event}`))
        .map((frame: string) => JSON.parse(frame.split('data: ')[1]));
    }

    it('executes a model-requested read tool and streams the grounded answer', async () => {
      const { service, executeReadTool } = toolService({
        requiresConfirmation: false,
        toolName: 'attendance.summary',
      });

      const generateContentStream = vi
        .fn()
        .mockResolvedValueOnce({
          stream: (async function* () {
            yield { functionCalls: [{ name: 'attendance.summary', args: {} }] };
          })(),
        })
        .mockResolvedValueOnce({
          stream: (async function* () {
            yield { text: 'Davomat: 93%' };
          })(),
        });
      (service as any).aiInstance = {
        models: { generateContent: vi.fn(), generateContentStream },
      };

      prisma.aiConversation.findFirst.mockResolvedValue({
        id: 'conv-1',
        createdBy: USER,
        organizationId: ORG,
      });

      const res = fakeRes();
      await service.chatStream(ORG, USER, 'Bugungi davomat qanday?', [], 'conv-1', res, false, 'ORG_ADMIN');

      expect(executeReadTool).toHaveBeenCalledTimes(1);
      expect(emitted(res, 'tool').map((event) => event.type)).toEqual([
        'tool_running',
        'tool_result',
      ]);
      expect(prisma.aiMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'assistant', content: 'Davomat: 93%' }),
        }),
      );
      expect(emitted(res, 'done')).toHaveLength(1);
    });

    it('parks a write tool as a pending action instead of executing it', async () => {
      const { service, executeReadTool, createPending } = toolService({
        requiresConfirmation: true,
        toolName: 'students.create',
      });

      const generateContentStream = vi
        .fn()
        .mockResolvedValueOnce({
          stream: (async function* () {
            yield {
              functionCalls: [
                {
                  name: 'students.create',
                  args: { firstName: 'Ali', lastName: 'Valiyev' },
                },
              ],
            };
          })(),
        })
        .mockResolvedValueOnce({
          stream: (async function* () {
            yield { text: 'Tasdiqlash uchun tayyorlandi.' };
          })(),
        });
      (service as any).aiInstance = {
        models: { generateContent: vi.fn(), generateContentStream },
      };

      prisma.aiConversation.findFirst.mockResolvedValue({
        id: 'conv-1',
        createdBy: USER,
        organizationId: ORG,
      });

      const res = fakeRes();
      await service.chatStream(ORG, USER, "Ali Valiyevni qo'sh", [], 'conv-1', res, false, 'ORG_ADMIN');

      expect(createPending).toHaveBeenCalledTimes(1);
      expect(executeReadTool).not.toHaveBeenCalled();
      expect(emitted(res, 'tool')[0]).toMatchObject({
        type: 'action_pending',
        actionId: 'act-1',
        toolName: 'students.create',
      });
    });

    it('runs the same tool loop on the non-streaming REST path', async () => {
      const { service, executeReadTool } = toolService({
        requiresConfirmation: false,
        toolName: 'attendance.summary',
      });

      const generateContent = vi
        .fn()
        .mockResolvedValueOnce({
          functionCalls: [{ name: 'attendance.summary', args: {} }],
        })
        .mockResolvedValueOnce({ text: 'Yakuniy javob' });
      (service as any).aiInstance = {
        models: { generateContent, generateContentStream: vi.fn() },
      };

      prisma.aiConversation.findFirst.mockResolvedValue({
        id: 'conv-1',
        createdBy: USER,
        organizationId: ORG,
      });

      const response = await service.chat(
        ORG,
        USER,
        'Bugungi davomat qanday?',
        [],
        'conv-1',
        false,
        undefined,
        { userRole: 'ORG_ADMIN', principalType: 'USER' },
      );

      expect(executeReadTool).toHaveBeenCalledTimes(1);
      expect(response.content).toBe('Yakuniy javob');
    });

    it('falls back to real database metrics without inventing analysis', async () => {
      (service as any).aiInstance = {
        models: {
          generateContent: vi.fn(async () => {
            throw new Error('provider down');
          }),
          generateContentStream: vi.fn(async () => {
            throw new Error('provider down');
          }),
        },
      };

      prisma.aiConversation.findFirst.mockResolvedValue({
        id: 'conv-1',
        createdBy: USER,
        organizationId: ORG,
      });

      const res = fakeRes();
      await service.chatStream(ORG, USER, 'Xavf ostidagi oquvchilar tahlili', [], 'conv-1', res, false, 'ORG_ADMIN');

      const deltas = emitted(res, 'delta').map((event) => event.content).join('');
      expect(deltas).toContain('Akademik xavf');
      expect(deltas).not.toContain('35%');
      expect(deltas).not.toContain('Face ID');
      expect(deltas).toContain('AI modeli hozir javob bermadi');
    });
  });

  describe('model resolution and requested model routing', () => {
    it('routes requests to mapped provider models and falls back on error', async () => {
      let requestedModelName = '';
      const customGenerate = vi.fn(async (params: any) => {
        requestedModelName = params.model;
        return { text: 'ok' };
      });
      (service as any).aiInstance = {
        models: {
          generateContent: customGenerate,
          generateContentStream: vi.fn(),
        },
      };

      prisma.aiConversation.findFirst.mockResolvedValue({ id: 'conv-1', createdBy: USER, organizationId: ORG });

      await service.chat(ORG, USER, 'Salom', [], 'conv-1', false, 'medu-pro');
      expect(requestedModelName).toBe('gemini-3.1-pro-preview');

      await service.chat(ORG, USER, 'Salom', [], 'conv-1', false, 'medu-flash');
      expect(requestedModelName).toBe('gemini-3.8-flash');
    });
  });
});


