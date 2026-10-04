import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AiErrorCode,
  AiLocale,
  aiPermissionsForRole,
  type AiContext,
} from '@medu/contracts';
import { AiException } from '../domain/ai.errors';
import type { AiAuthenticatedUser, AiRequestContext } from '../domain/ai.types';

const SUPPORTED_LOCALES: readonly string[] = [
  AiLocale.UZ,
  AiLocale.RU,
  AiLocale.EN,
];

/**
 * Builds the authoritative `AiContext`.
 *
 * `userId`, `organizationId`, `role` and `permissions` are ALWAYS derived from
 * the authenticated request. Only `route`, `entity` and `locale` may come from
 * the caller, and they are treated as non-authoritative hints.
 */
@Injectable()
export class AiContextService {
  fromRequest(user: AiAuthenticatedUser, request: AiRequestContext = {}): AiContext {
    const userId = user?.sub;
    const organizationId = user?.organizationId;
    const role = user?.role ?? '';

    if (!userId) {
      throw new AiException(AiErrorCode.AI_INVALID_INPUT, 'Authentication required', {
        status: HttpStatus.UNAUTHORIZED,
      });
    }
    if (!organizationId) {
      throw new AiException(AiErrorCode.AI_INVALID_INPUT, 'Tenant context required', {
        status: HttpStatus.FORBIDDEN,
        retryable: false,
      });
    }

    const locale =
      request.locale && SUPPORTED_LOCALES.includes(request.locale)
        ? request.locale
        : AiLocale.UZ;

    return {
      userId,
      organizationId,
      role,
      permissions: aiPermissionsForRole(role),
      ...(request.route ? { route: request.route } : {}),
      ...(request.entity ? { entity: { type: request.entity.type, id: request.entity.id } } : {}),
      locale,
    };
  }
}
