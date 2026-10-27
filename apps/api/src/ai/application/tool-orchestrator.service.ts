import { Injectable, Logger } from '@nestjs/common';
import {
  AiErrorCode,
  type AiContext,
  type AiErrorPayload,
  type AiToolCall,
  type AiToolResult,
} from '@medu/contracts';
import { AiException } from '../domain/ai.errors';
import { ToolRegistryService } from '../tools/registry/tool-registry.service';
import { AiPolicyService } from './ai-policy.service';

const TOOL_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_CHARS = 50_000;

/**
 * Validates, authorizes and executes READ tools. Write tools are never executed
 * here — the gateway diverts them into the durable action lifecycle.
 */
@Injectable()
export class ToolOrchestratorService {
  private readonly logger = new Logger(ToolOrchestratorService.name);

  constructor(
    private readonly registry: ToolRegistryService,
    private readonly policy: AiPolicyService,
  ) {}

  /** Parse and validate raw model arguments against the tool's schema. */
  validateInput(call: AiToolCall): { ok: true; value: unknown } | { ok: false; error: AiErrorPayload } {
    const tool = this.registry.get(call.name);
    if (!tool) {
      return {
        ok: false,
        error: {
          code: AiErrorCode.AI_TOOL_NOT_FOUND,
          message: `Unknown tool: ${call.name}`,
          retryable: false,
        },
      };
    }

    const parsed = tool.inputSchema.safeParse(call.arguments);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: AiErrorCode.AI_TOOL_INVALID_INPUT,
          message: 'Invalid tool arguments',
          retryable: false,
          details: { issues: parsed.error.issues.map((issue) => issue.message) },
        },
      };
    }
    return { ok: true, value: parsed.data };
  }

  assertAuthorized(context: AiContext, call: AiToolCall): void {
    const tool = this.registry.require(call.name);
    this.policy.assertCanExecuteTool(context, tool);
  }

  async executeReadTool(context: AiContext, call: AiToolCall): Promise<AiToolResult> {
    const start = Date.now();
    const tool = this.registry.get(call.name);
    if (!tool) {
      return this.failure(call, {
        code: AiErrorCode.AI_TOOL_NOT_FOUND,
        message: `Unknown tool: ${call.name}`,
        retryable: false,
      });
    }

    if (!this.policy.canExecuteTool(context, tool)) {
      return this.failure(call, {
        code: AiErrorCode.AI_TOOL_NOT_AUTHORIZED,
        message: 'You are not allowed to run this tool',
        retryable: false,
      });
    }

    const validated = this.validateInput(call);
    if (!validated.ok) return this.failure(call, validated.error);

    try {
      const dataPromise = tool.execute(validated.value, context);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Tool execution timed out after ${TOOL_TIMEOUT_MS}ms`)),
          TOOL_TIMEOUT_MS,
        ),
      );

      const rawData = await Promise.race([dataPromise, timeoutPromise]);
      const durationMs = Date.now() - start;

      // Bound output payload to prevent provider context overflows
      let boundedData = rawData;
      const jsonStr = JSON.stringify(rawData ?? null);
      if (jsonStr.length > MAX_OUTPUT_CHARS) {
        this.logger.warn(
          `Tool ${call.name} output exceeded ${MAX_OUTPUT_CHARS} chars (${jsonStr.length}). Truncating safely.`,
        );
        boundedData = {
          _truncated: true,
          originalSize: jsonStr.length,
          preview: jsonStr.slice(0, MAX_OUTPUT_CHARS),
        };
      }

      this.logger.log(
        JSON.stringify({
          event: 'ai_tool_executed',
          toolName: call.name,
          durationMs,
          status: 'success',
          organizationId: context.organizationId,
          userId: context.userId,
        }),
      );

      return { toolCallId: call.id, toolName: call.name, ok: true, data: boundedData };
    } catch (error) {
      const durationMs = Date.now() - start;
      const isTimeout = error instanceof Error && error.message.includes('timed out');
      this.logger.error(
        JSON.stringify({
          event: 'ai_tool_executed',
          toolName: call.name,
          durationMs,
          status: 'error',
          error: error instanceof Error ? error.message : 'unknown',
          organizationId: context.organizationId,
        }),
      );
      return this.failure(call, {
        code: isTimeout ? AiErrorCode.AI_PROVIDER_TIMEOUT : AiErrorCode.AI_INTERNAL,
        message: isTimeout
          ? 'Asbob so‘rovi vaqti tugadi (timeout)'
          : 'The tool could not complete the request',
        retryable: true,
      });
    }
  }

  /** Validate + authorize a write tool call, returning its parsed input. */
  prepareWriteTool(
    context: AiContext,
    call: AiToolCall,
  ): { toolName: string; parameters: Record<string, unknown> } {
    const tool = this.registry.require(call.name);
    this.policy.assertCanExecuteTool(context, tool);

    const parsed = tool.inputSchema.safeParse(call.arguments);
    if (!parsed.success) {
      throw new AiException(
        AiErrorCode.AI_TOOL_INVALID_INPUT,
        'Invalid tool arguments',
        { details: { issues: parsed.error.issues.map((issue) => issue.message) } },
      );
    }

    return {
      toolName: tool.name,
      parameters: parsed.data as Record<string, unknown>,
    };
  }

  private failure(call: AiToolCall, error: AiErrorPayload): AiToolResult {
    return { toolCallId: call.id, toolName: call.name, ok: false, error };
  }
}
