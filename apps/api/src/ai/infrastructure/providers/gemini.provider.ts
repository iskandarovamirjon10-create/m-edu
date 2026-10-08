import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  AiErrorCode,
  type AiGenerateRequest,
  type AiGenerateResponse,
  type AiProviderMessage,
  type AiProviderTool,
  AiRole,
} from '@medu/contracts';
import { AiProviderError } from '../../domain/ai.errors';
import type { AiProvider } from './ai-provider.interface';

/* ── Minimal, strictly-typed shape of the Gemini REST payloads we use ──── */

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: unknown };
}

interface GeminiContent {
  role?: 'user' | 'model' | 'function';
  parts: GeminiPart[];
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

interface GeminiRequestBody {
  contents: GeminiContent[];
  generationConfig?: { temperature?: number };
  systemInstruction?: { parts: { text: string }[] };
  tools?: { functionDeclarations: { name: string; description: string; parameters: unknown }[] }[];
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * White-label fallback model list. If the primary model is unavailable the
 * adapter degrades model-by-model before giving up with a typed provider error.
 */
const FALLBACK_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash'];

@Injectable()
export class GeminiProvider implements AiProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('GEMINI_API_KEY') ?? process.env.GEMINI_API_KEY ?? '';
    this.model = this.configService.get<string>('GEMINI_MODEL') ?? DEFAULT_MODEL;
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    if (!this.apiKey) {
      throw new AiProviderError(
        AiErrorCode.AI_PROVIDER_UNAVAILABLE,
        'AI provider is not configured',
      );
    }

    const body = this.buildRequestBody(request);
    const models = [this.model, ...FALLBACK_MODELS.filter((m) => m !== this.model)];
    let lastError: AiProviderError | null = null;

    for (const model of models) {
      try {
        const parsed = await this.callModel(model, body);
        return this.toGenerateResponse(parsed);
      } catch (error) {
        if (error instanceof AiProviderError) {
          // A configuration/auth error (bad API key, invalid model name) is
          // PERMANENT — the fallback list should not burn through every model
          // on a broken credential (regression: F-14).
          if (error.code === AiErrorCode.AI_PROVIDER_CONFIG_ERROR) {
            throw error;
          }
          lastError = error;
          this.logger.warn(`Model ${model} failed: ${error.code}`);
          continue;
        }
        throw error;
      }
    }

    throw (
      lastError ??
      new AiProviderError(AiErrorCode.AI_PROVIDER_UNAVAILABLE, 'No AI model available')
    );
  }

  private buildRequestBody(request: AiGenerateRequest): GeminiRequestBody {
    const contents: GeminiContent[] = request.messages.map((message) =>
      this.toGeminiContent(message),
    );

    const body: GeminiRequestBody = {
      contents,
      generationConfig: { temperature: request.temperature ?? 0.2 },
    };

    if (request.systemInstruction) {
      body.systemInstruction = { parts: [{ text: request.systemInstruction }] };
    }

    if (request.tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: request.tools.map((tool: AiProviderTool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          })),
        },
      ];
    }

    return body;
  }

  private toGeminiContent(message: AiProviderMessage): GeminiContent {
    if (message.role === AiRole.TOOL) {
      return {
        role: 'function',
        parts: [
          {
            functionResponse: {
              name: message.toolCallId ?? 'tool',
              response: { result: message.toolResult ?? null },
            },
          },
        ],
      };
    }

    if (message.role === AiRole.ASSISTANT && message.toolCalls?.length) {
      return {
        role: 'model',
        parts: message.toolCalls.map((call) => ({
          functionCall: { name: call.name, args: call.arguments },
        })),
      };
    }

    return {
      role: message.role === AiRole.ASSISTANT ? 'model' : 'user',
      parts: [{ text: message.content }],
    };
  }

  private async callModel(model: string, body: GeminiRequestBody): Promise<GeminiResponse> {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        this.logger.error(`Gemini ${response.status}: ${detail.slice(0, 300)}`);
        // 429 rates and 5xx are transient → retryable via fallback models.
        // Other 4xx (bad API key 400/403, unknown model 404, malformed
        // request) indicate a configuration problem that no fallback can fix.
        throw new AiProviderError(
          response.status === 429
            ? AiErrorCode.AI_RATE_LIMITED
            : response.status >= 500
              ? AiErrorCode.AI_PROVIDER_UNAVAILABLE
              : AiErrorCode.AI_PROVIDER_CONFIG_ERROR,
          `Gemini responded ${response.status}`,
        );
      }

      return (await response.json()) as GeminiResponse;
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiProviderError(AiErrorCode.AI_PROVIDER_TIMEOUT, 'Gemini request timed out');
      }
      throw new AiProviderError(
        AiErrorCode.AI_PROVIDER_UNAVAILABLE,
        error instanceof Error ? error.message : 'Gemini request failed',
      );
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }

  private toGenerateResponse(data: GeminiResponse): AiGenerateResponse {
    const parts = data.candidates?.[0]?.content?.parts ?? [];

    const functionPart = parts.find((part) => part.functionCall);
    if (functionPart?.functionCall) {
      return {
        toolCall: {
          id: randomUUID(),
          name: functionPart.functionCall.name,
          arguments: functionPart.functionCall.args ?? {},
        },
      };
    }

    const text = parts
      .map((part) => part.text ?? '')
      .filter((chunk) => chunk.length > 0)
      .join('');

    if (!text) {
      throw new AiProviderError(
        AiErrorCode.AI_PROVIDER_UNAVAILABLE,
        'Gemini returned no content',
      );
    }

    return { text };
  }
}
