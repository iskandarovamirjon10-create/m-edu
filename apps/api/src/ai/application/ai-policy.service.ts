import { Injectable } from '@nestjs/common';
import {
  AiErrorCode,
  hasAiPermission,
  type AiContext,
  type AiToolDefinition,
} from '@medu/contracts';
import { AiException } from '../domain/ai.errors';

/**
 * Central authorization policy for AI tools and actions.
 *
 * Replaces the legacy `CopilotService.hasPermission()` string-suffix heuristic
 * with an explicit permission catalog (`AiRolePermissions`).
 */
@Injectable()
export class AiPolicyService {
  canExecuteTool(context: AiContext, tool: Pick<AiToolDefinition, 'permission'>): boolean {
    return hasAiPermission(context.permissions, tool.permission);
  }

  assertCanExecuteTool(context: AiContext, tool: Pick<AiToolDefinition, 'name' | 'permission'>): void {
    if (!this.canExecuteTool(context, tool)) {
      throw new AiException(
        AiErrorCode.AI_TOOL_NOT_AUTHORIZED,
        'You are not allowed to run this tool',
        { details: { toolName: tool.name, permission: tool.permission } },
      );
    }
  }
}
