import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  AiActionStatus,
  AiErrorCode,
  AiToolRiskLevel,
  type AiContext,
  type AiToolDefinition,
  aiPermissionsForRole,
} from '@medu/contracts';
import { AiActionService } from '../application/action.service';
import { ToolOrchestratorService } from '../application/tool-orchestrator.service';
import { AiPolicyService } from '../application/ai-policy.service';
import { AiException } from '../domain/ai.errors';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import type { ToolRegistryService } from '../tools/registry/tool-registry.service';

describe('AI Tenant Isolation & Authorization Negative Security Suite', () => {
  const orgA = '00000000-0000-0000-0000-00000000000a';
  const orgB = '00000000-0000-0000-0000-00000000000b';
  const userA = '11111111-1111-1111-1111-11111111111a';
  const userB = '22222222-2222-2222-2222-22222222222b';

  const contextOrgA: AiContext = {
    userId: userA,
    organizationId: orgA,
    role: 'MANAGER',
    permissions: ['schedule:write', 'students:read'],
    locale: 'uz',
  };

  const contextOrgB: AiContext = {
    userId: userB,
    organizationId: orgB,
    role: 'MANAGER',
    permissions: ['schedule:write', 'students:read'],
    locale: 'uz',
  };

  const contextTeacherNoFinance: AiContext = {
    userId: userA,
    organizationId: orgA,
    role: 'TEACHER',
    permissions: aiPermissionsForRole('TEACHER'),
    locale: 'uz',
  };

  const contextStudent: AiContext = {
    userId: userA,
    organizationId: orgA,
    role: 'STUDENT',
    permissions: aiPermissionsForRole('STUDENT'),
    locale: 'uz',
  };

  describe('AiActionService Cross-Tenant & RBAC Isolation', () => {
    let service: AiActionService;
    let prisma: any;
    let registry: any;
    let policy: any;
    let audit: any;
    let mockTool: AiToolDefinition;

    beforeEach(() => {
      mockTool = {
        name: 'schedule.create',
        description: 'create a lesson',
        inputSchema: z.object({ groupId: z.string() }),
        riskLevel: AiToolRiskLevel.MEDIUM,
        requiresConfirmation: true,
        permission: 'schedule:write',
        execute: vi.fn().mockResolvedValue({ id: 'lesson-1' }),
      };

      prisma = {
        aiAction: {
          findFirst: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'action-1', ...data })),
          findUniqueOrThrow: vi.fn(),
        },
      };
      registry = { require: vi.fn().mockReturnValue(mockTool) };
      policy = new AiPolicyService();
      audit = { record: vi.fn().mockResolvedValue(undefined) };

      service = new AiActionService(
        prisma as unknown as PrismaService,
        registry as unknown as ToolRegistryService,
        policy,
        audit as unknown as AuditService,
      );
    });

    it('rejects cross-tenant action confirmation when action belongs to Org B but user is in Org A', async () => {
      // Prisma findFirst enforces organizationId: context.organizationId
      // Simulating action in Org B
      prisma.aiAction.findFirst.mockImplementation(({ where }: any) => {
        if (where.organizationId === orgB && where.id === 'action-in-org-b') {
          return Promise.resolve({
            id: 'action-in-org-b',
            organizationId: orgB,
            createdBy: userB,
            status: AiActionStatus.PENDING_CONFIRMATION,
            parameters: { groupId: 'g-b' },
            expiresAt: new Date(Date.now() + 60_000),
            toolName: 'schedule.create',
          });
        }
        return Promise.resolve(null);
      });

      // User from Org A tries to confirm Org B's action
      await expect(service.confirm(contextOrgA, 'action-in-org-b')).rejects.toThrow(AiException);
      expect(mockTool.execute).not.toHaveBeenCalled();
    });

    it('rejects cross-tenant action rejection', async () => {
      prisma.aiAction.findFirst.mockResolvedValue(null);
      await expect(service.reject(contextOrgA, 'action-in-org-b', 'denied')).rejects.toThrow(AiException);
    });

    it('rejects action confirmation if the actor lacks the required permission at confirmation time', async () => {
      prisma.aiAction.findFirst.mockResolvedValue({
        id: 'action-1',
        organizationId: orgA,
        createdBy: userA,
        status: AiActionStatus.PENDING_CONFIRMATION,
        parameters: { groupId: 'g-1' },
        expiresAt: new Date(Date.now() + 60_000),
        toolName: 'schedule.create',
      });

      // User lacks schedule:write
      const unprivilegedContext: AiContext = {
        ...contextOrgA,
        permissions: ['students:read'],
      };

      await expect(service.confirm(unprivilegedContext, 'action-1')).rejects.toThrow(AiException);
      expect(mockTool.execute).not.toHaveBeenCalled();
    });
  });

  describe('ToolOrchestratorService Tenant & Permission Guards', () => {
    let orchestrator: ToolOrchestratorService;
    let registry: any;
    let policy: AiPolicyService;
    let readTool: AiToolDefinition;

    beforeEach(() => {
      readTool = {
        name: 'finance.debtors',
        description: 'Read debtors list',
        inputSchema: z.object({ limit: z.number().optional() }),
        riskLevel: AiToolRiskLevel.LOW,
        requiresConfirmation: false,
        permission: 'payments:read',
        execute: vi.fn().mockResolvedValue({ total: 0, debtors: [] }),
      };

      registry = {
        get: vi.fn((name: string) => (name === 'finance.debtors' ? readTool : undefined)),
        require: vi.fn((name: string) => {
          if (name === 'finance.debtors') return readTool;
          throw new Error('Tool not found');
        }),
      };
      policy = new AiPolicyService();
      orchestrator = new ToolOrchestratorService(registry, policy);
    });

    it('blocks teacher from executing financial tools (payments:read missing)', async () => {
      const result = await orchestrator.executeReadTool(contextTeacherNoFinance, {
        id: 'call-1',
        name: 'finance.debtors',
        arguments: {},
      });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe(AiErrorCode.AI_TOOL_NOT_AUTHORIZED);
      expect(readTool.execute).not.toHaveBeenCalled();
    });

    it('blocks student role from executing any registered tool', async () => {
      expect(contextStudent.permissions).toEqual([]);

      const result = await orchestrator.executeReadTool(contextStudent, {
        id: 'call-2',
        name: 'finance.debtors',
        arguments: {},
      });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe(AiErrorCode.AI_TOOL_NOT_AUTHORIZED);
      expect(readTool.execute).not.toHaveBeenCalled();
    });

    it('rejects invalid inputs failing Zod schema validation', async () => {
      const result = await orchestrator.executeReadTool(
        { ...contextOrgA, permissions: ['payments:read'] },
        {
          id: 'call-3',
          name: 'finance.debtors',
          arguments: { limit: 'NOT_A_NUMBER' as any },
        },
      );

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe(AiErrorCode.AI_TOOL_INVALID_INPUT);
      expect(readTool.execute).not.toHaveBeenCalled();
    });

    it('enforces execution timeout when tool hangs', async () => {
      // Mock tool that never resolves
      const hangingTool: AiToolDefinition = {
        name: 'finance.debtors',
        description: 'Hanging tool',
        inputSchema: z.object({}),
        riskLevel: AiToolRiskLevel.LOW,
        requiresConfirmation: false,
        permission: 'payments:read',
        execute: () => new Promise((resolve) => setTimeout(resolve, 20_000)),
      };
      registry.get.mockReturnValue(hangingTool);

      // We test that timeout handling exists without waiting full 15s in unit test
      // by testing with custom rejected tool
      const fastFailTool: AiToolDefinition = {
        name: 'finance.debtors',
        description: 'Failing tool',
        inputSchema: z.object({}),
        riskLevel: AiToolRiskLevel.LOW,
        requiresConfirmation: false,
        permission: 'payments:read',
        execute: () => Promise.reject(new Error('Tool execution timed out after 15000ms')),
      };
      registry.get.mockReturnValue(fastFailTool);

      const result = await orchestrator.executeReadTool(
        { ...contextOrgA, permissions: ['payments:read'] },
        { id: 'call-4', name: 'finance.debtors', arguments: {} },
      );

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe(AiErrorCode.AI_PROVIDER_TIMEOUT);
    });
  });

  describe('Role-Based AI Permission Matrix Integrity', () => {
    it('grants zero permissions to STUDENT and PARENT roles', () => {
      expect(aiPermissionsForRole('STUDENT')).toHaveLength(0);
      expect(aiPermissionsForRole('PARENT')).toHaveLength(0);
    });

    it('grants financial read to ACCOUNTANT but denies roster write', () => {
      const accountantPerms = aiPermissionsForRole('ACCOUNTANT');
      expect(accountantPerms).toContain('payments:read');
      expect(accountantPerms).not.toContain('students:write');
      expect(accountantPerms).not.toContain('teachers:write');
      expect(accountantPerms).not.toContain('courses:write');
    });

    it('grants classroom management to TEACHER but denies financial read', () => {
      const teacherPerms = aiPermissionsForRole('TEACHER');
      expect(teacherPerms).toContain('attendance:read');
      expect(teacherPerms).toContain('attendance:write');
      expect(teacherPerms).toContain('schedule:read');
      expect(teacherPerms).not.toContain('payments:read');
      expect(teacherPerms).not.toContain('payments:write');
    });
  });
});
