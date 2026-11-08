/**
 * Shared auth-related types.
 *
 * These mirror the exact shapes produced by the JWT strategy, the Google
 * strategy and AuthService.issueToken so controllers and services can be
 * strongly typed without leaking `any` across the module boundary.
 */

/** Shape of the JWT payload signed by AuthService and validated by JwtStrategy. */
export interface JwtPayload {
  /** User id (Prisma `user.id`). */
  sub: string;
  id?: string;
  username?: string | null;
  email: string;
  role: string;
  organizationId: string;
  mustChangePassword?: boolean;
  permissions?: readonly string[];
  /** Session row id — lets logout() revoke the exact session that issued the token. */
  sid?: string;
}

/**
 * Authenticated request principal attached by Passport (req.user).
 *
 * `sid` is widened to `string | null` on purpose: Omit<...> prevents the
 * intersection with `JwtPayload.sid?: string` from collapsing the type back
 * to `string`, so callers are forced to handle the no-session case
 * (tokens issued without a session row, e.g. pre-session legacy tokens).
 */
export type RequestUser = Omit<JwtPayload, 'sid'> & { sid: string | null; id: string };

/** Tenant context attached to face/camera requests by the TenantInterceptor. */
export interface TenantContext {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
}

/** Normalized Google profile emitted by GoogleStrategy.validate. */
export interface GoogleProfile {
  googleSubject: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  avatar: string | null;
  accessToken?: string;
}

/** Minimal user shape required to mint a token (Prisma user rows satisfy this). */
export interface TokenUser {
  id: string;
  username?: string | null;
  email: string;
  role: string;
  organizationId: string;
  firstName?: string | null;
  lastName?: string | null;
  avatar?: string | null;
  mustChangePassword?: boolean;
  memberships?: any[];
  organization?: { id: string; name: string } | null;
}

/** Response type for getMe route */
export interface GetMeResponse {
  id: string;
  username?: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatar: string | null;
  role: string;
  organizationId: string;
  mustChangePassword?: boolean;
  organization: { id: string; name: string } | null;
  settings: any;
  lastLoginAt: Date | null;
  memberships?: any[];
}

/** Active session / device representation returned by GET /auth/sessions */
export interface ActiveSessionDto {
  id: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  os: string;
  ipAddress: string;
  createdAt: string;
  expiresAt: string;
  lastActiveAt?: string | null;
  isCurrentSession: boolean;
}

/** Safe error-message extraction for `catch (err: unknown)` blocks. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
