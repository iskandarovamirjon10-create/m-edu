import type { AiContext, AiLocale } from '@medu/contracts';

/** Authenticated principal as populated by `JwtStrategy.validate`. */
export interface AiAuthenticatedUser {
  sub: string;
  organizationId?: string;
  role?: string;
  email?: string;
}

/** Optional, non-authoritative context supplied by the frontend. */
export interface AiRequestContext {
  route?: string;
  entity?: { type: string; id: string };
  locale?: AiLocale;
}

export type { AiContext };
