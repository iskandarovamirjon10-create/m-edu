import { Inject, Injectable } from '@nestjs/common';
import {
  AiErrorCode,
  type AiContext,
  type AiProviderTool,
  type AiToolDefinition,
} from '@medu/contracts';
import { AiException } from '../../domain/ai.errors';
import { zodToJsonSchema } from './zod-to-json-schema';

/** DI token carrying the flat list of registered tool definitions. */
export const AI_TOOL_DEFINITIONS = Symbol('AI_TOOL_DEFINITIONS');

/**
 * One registry for every AI tool. Read tools run immediately; write tools are
 * gated behind the durable action lifecycle (`requiresConfirmation`).
 */
@Injectable()
export class ToolRegistryService {
  private readonly tools = new Map<string, AiToolDefinition>();

  constructor(
    @Inject(AI_TOOL_DEFINITIONS) definitions: AiToolDefinition[],
  ) {
    for (const definition of definitions) {
      if (this.tools.has(definition.name)) {
        throw new Error(`Duplicate AI tool registered: ${definition.name}`);
      }
      this.tools.set(definition.name, definition);
    }
  }

  get(name: string): AiToolDefinition | undefined {
    return this.tools.get(name);
  }

  require(name: string): AiToolDefinition {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new AiException(AiErrorCode.AI_TOOL_NOT_FOUND, 'Requested tool does not exist', {
        details: { toolName: name },
      });
    }
    return tool;
  }

  list(): AiToolDefinition[] {
    return [...this.tools.values()];
  }

  /** Descriptors handed to the model (Gemini function declarations). */
  toProviderTools(): AiProviderTool[] {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.inputSchema) as unknown as Record<string, unknown>,
    }));
  }

  /**
   * Execute a validated tool. Callers must have validated `input` against the
   * tool's schema and checked authorization first.
   */
  async execute(name: string, input: unknown, context: AiContext): Promise<unknown> {
    const tool = this.require(name);
    return tool.execute(input, context);
  }
}
