import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionsService } from '../subscriptions.service';

export const ENTITLEMENT_KEY = 'feature_entitlement';
export const RequireEntitlement = (feature: 'hasFaceId' | 'hasAiCopilot') =>
  SetMetadata(ENTITLEMENT_KEY, feature);

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<'hasFaceId' | 'hasAiCopilot'>(
      ENTITLEMENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!feature) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const organizationId = user?.organizationId || request.headers['x-organization-id'];

    if (!organizationId) {
      return true;
    }

    // Platform owner bypasses
    if (user?.role === 'PLATFORM_OWNER') {
      return true;
    }

    return this.subscriptionsService.checkEntitlement(organizationId, feature);
  }
}
