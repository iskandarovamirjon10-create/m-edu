import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { ApiKeyGuard } from '../api-keys/api-keys.guard';

/**
 * Device transport for {@link ApiKeyGuard}.
 *
 * Standalone face terminals (Hikvision MinMoe, ZKTeco, …) can set a custom
 * HTTP header but cannot reliably build a standard `Authorization: ApiKey …`
 * header. This guard maps the legacy `x-terminal-token` header onto that
 * standard transport and then defers entirely to {@link ApiKeyGuard}, so the
 * terminal webhook shares one authentication implementation — and one test
 * suite — with every other API-key-authenticated endpoint:
 *
 *   - bcrypt-verified key (hashed at rest, prefix-indexed lookup)
 *   - revoked / expired keys rejected
 *   - `@RequireApiKeyScopes(...)` enforced, fail-closed when absent
 *   - usage counter incremented
 *   - `req.user.organizationId` bound to the **key's** organization
 *
 * `req.user.organizationId` is what the terminal webhook must use to resolve a
 * camera. It is never derived from the request body, which is what previously
 * let any network peer post attendance events for any tenant.
 *
 * The guard itself never populates `req.user`; if {@link ApiKeyGuard} rejects,
 * no principal is created.
 *
 * NOTE: this route also carries `@AllowPublic()` so the global JWT guard does
 * not demand a user session — machine callers are authenticated here instead.
 * `@AllowPublic()` only skips the JWT check; it never skips this one.
 */
@Injectable()
export class TerminalAuthGuard implements CanActivate {
  constructor(private readonly apiKeyGuard: ApiKeyGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();

    const token = request.headers['x-terminal-token'];
    const rawToken = typeof token === 'string' ? token.trim() : '';

    if (!rawToken) {
      throw new UnauthorizedException('Terminal token is missing');
    }

    // Device transport → standard transport. Both headers are client-supplied,
    // so this normalisation cannot elevate anything an attacker did not already
    // control; it only routes the credential through the single real verifier.
    if (!request.headers.authorization) {
      request.headers.authorization = `ApiKey ${rawToken}`;
    }

    return this.apiKeyGuard.canActivate(context);
  }
}
