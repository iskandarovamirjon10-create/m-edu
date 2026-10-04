import { describe, it, expect } from 'vitest';
import type { AiContext } from '@medu/contracts';
import { AiPolicyService } from '../ai-policy.service';
import { AiException } from '../../domain/ai.errors';

const context = (permissions: string[]): AiContext => ({
  userId: 'u1',
  organizationId: 'o1',
  role: 'MANAGER',
  permissions,
  locale: 'uz',
});

describe('AiPolicyService', () => {
  const policy = new AiPolicyService();

  it('allows a tool when the required permission is present', () => {
    expect(policy.canExecuteTool(context(['students:read']), { permission: 'students:read' })).toBe(
      true,
    );
  });

  it('denies a tool when the permission is missing', () => {
    expect(policy.canExecuteTool(context([]), { permission: 'students:write' })).toBe(false);
  });

  it('throws a 403 AiException when asserting a denied tool', () => {
    try {
      policy.assertCanExecuteTool(context(['students:read']), {
        name: 'schedule.create',
        permission: 'schedule:write',
      });
      throw new Error('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AiException);
      expect((error as AiException).getStatus()).toBe(403);
      expect((error as AiException).code).toBe('AI_TOOL_NOT_AUTHORIZED');
    }
  });
});
