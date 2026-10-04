import type {
  AiGenerateRequest,
  AiGenerateResponse,
  AiStreamEvent,
} from '@medu/contracts';

/**
 * Provider port. The application layer depends only on this; Gemini, OpenAI or
 * any future model is an infrastructure detail behind it.
 */
export interface AiProvider {
  generate(request: AiGenerateRequest): Promise<AiGenerateResponse>;
  stream?(
    request: AiGenerateRequest,
    signal?: AbortSignal,
  ): AsyncIterable<AiStreamEvent>;
}

/** DI token for the active provider adapter. */
export const AI_PROVIDER = Symbol('AI_PROVIDER');
