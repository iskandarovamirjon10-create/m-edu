import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeysService } from './api-keys.service';
import * as bcrypt from 'bcryptjs';

export const API_KEY_SCOPES_KEY = 'api-key-scopes';

/**
 * Declares which API-key scopes are required to access a route.
 *
 * Usage on controllers/handlers that accept ApiKey authentication:
 *   @RequireApiKeyScopes('students:read')
 *   @UseGuards(ApiKeyGuard)
 *
 * Scopes follow the `<resource>:<action>` convention defined in
 * API_KEY_SCOPES (dto/api-key.dto.ts). A key satisfies a requirement when it
 * holds every required scope.
 */
export const RequireApiKeyScopes = (...scopes: string[]) =>
  SetMetadata(API_KEY_SCOPES_KEY, scopes);

/**
 * Authenticates requests presenting an `Authorization: ApiKey <raw>` header.
 *
 * SECURITY MODEL — least privilege:
 * The guard authenticates the key and attaches a synthetic principal, but it
 * does NOT grant any role. Previously every API key was mapped to
 * `role: 'ORG_ADMIN'`, letting a leaked read-only key create/delete users,
 * rotate other keys and hit every admin endpoint. Now authorization is driven
 * exclusively by the key's `scopes` array:
 *   - Routes decorated with @RequireApiKeyScopes(...) succeed only when the
 *     key carries every required scope.
 *   - Routes guarded by @Roles(...) fail for API-key principals (no role),
 *     because RolesGuard matches against `user.role` which is undefined here.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('ApiKey ')) {
      return false;
    }

    const rawKey = authHeader.substring(7).trim();
    if (!rawKey || rawKey.length > 100) return false;

    const keyPrefix = rawKey.substring(0, 11);

    const candidates = await this.apiKeysService.findCandidatesByKeyPrefix(keyPrefix);
    let candidate: typeof candidates[0] | undefined = undefined;

    for (const cand of candidates) {
      const valid = await bcrypt.compare(rawKey, cand.keyHash);
      if (valid) {
        candidate = cand;
        break;
      }
    }

    if (!candidate) throw new UnauthorizedException('Invalid API key');
    // Defence in depth: the lookup already filters `isActive: true`, but never
    // trust a single layer to enforce revocation.
    if (candidate.isActive === false) {
      throw new UnauthorizedException('API key is revoked');
    }
    if (candidate.expiresAt && candidate.expiresAt < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    // Scope enforcement: the endpoint must declare what a key may do, and the
    // key must carry every required scope. Endpoints without scope metadata
    // reject API-key access outright (fail-closed default).
    const requiredScopes =
      this.reflector.getAllAndOverride<string[]>(API_KEY_SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredScopes.length === 0) {
      throw new ForbiddenException(
        'This endpoint does not accept API-key authentication',
      );
    }

    const granted = new Set(candidate.scopes ?? []);
    const missing = requiredScopes.filter((scope) => !granted.has(scope));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `API key is missing required scopes: ${missing.join(', ')}`,
      );
    }

    this.apiKeysService.incrementUsage(candidate.id).catch(() => {
      // fire and forget
    });

    // Synthetic principal: deliberately has NO `role`, so RolesGuard never
    // treats an API key as an ORG_ADMIN human account. `apiKeyScopes` is kept
    // for downstream per-scope checks (e.g. write vs read verbs).
    req.user = {
      sub: candidate.createdBy,
      id: candidate.createdBy,
      organizationId: candidate.organizationId,
      apiKeyId: candidate.id,
      apiKeyScopes: candidate.scopes,
      isApiKey: true,
    };

    return true;
  }
}
