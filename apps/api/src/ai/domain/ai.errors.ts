import { HttpException, HttpStatus } from '@nestjs/common';
import { AiErrorCode, type AiErrorPayload } from '@medu/contracts';

/**
 * Canonical AI error. Carries a machine-readable `code` so the frontend can map
 * it to a localized, human message. Raw provider/Prisma errors are never
 * surfaced to clients.
 */
export class AiException extends HttpException {
  readonly code: AiErrorCode;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: AiErrorCode,
    message: string,
    options: { status?: HttpStatus; retryable?: boolean; details?: Record<string, unknown> } = {},
  ) {
    super({ code, message }, options.status ?? statusForCode(code));
    this.name = 'AiException';
    this.code = code;
    this.retryable = options.retryable ?? isRetryable(code);
    this.details = options.details;
  }

  toPayload(): AiErrorPayload {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

function statusForCode(code: AiErrorCode): HttpStatus {
  switch (code) {
    case AiErrorCode.AI_INVALID_INPUT:
      return HttpStatus.BAD_REQUEST;
    case AiErrorCode.AI_TOOL_NOT_AUTHORIZED:
    case AiErrorCode.AI_ACTION_NOT_AUTHORIZED:
      return HttpStatus.FORBIDDEN;
    case AiErrorCode.AI_CONVERSATION_NOT_FOUND:
    case AiErrorCode.AI_ACTION_NOT_FOUND:
    case AiErrorCode.AI_TOOL_NOT_FOUND:
      return HttpStatus.NOT_FOUND;
    case AiErrorCode.AI_ACTION_EXPIRED:
    case AiErrorCode.AI_ACTION_ALREADY_RESOLVED:
      return HttpStatus.CONFLICT;
    case AiErrorCode.AI_RATE_LIMITED:
      return HttpStatus.TOO_MANY_REQUESTS;
    case AiErrorCode.AI_PROVIDER_TIMEOUT:
      return HttpStatus.GATEWAY_TIMEOUT;
    case AiErrorCode.AI_PROVIDER_UNAVAILABLE:
      return HttpStatus.SERVICE_UNAVAILABLE;
    default:
      return HttpStatus.BAD_GATEWAY;
  }
}

function isRetryable(code: AiErrorCode): boolean {
  return (
    code === AiErrorCode.AI_PROVIDER_TIMEOUT ||
    code === AiErrorCode.AI_PROVIDER_UNAVAILABLE ||
    code === AiErrorCode.AI_RATE_LIMITED ||
    code === AiErrorCode.AI_ACTION_FAILED ||
    code === AiErrorCode.AI_INTERNAL
  );
}

/** Provider-level failure raised by infrastructure adapters. */
export class AiProviderError extends Error {
  readonly code: AiErrorCode;

  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.name = 'AiProviderError';
    this.code = code;
  }
}
