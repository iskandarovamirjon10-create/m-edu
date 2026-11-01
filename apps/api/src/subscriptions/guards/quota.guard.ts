import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionsService } from '../subscriptions.service';

export const QUOTA_KEY = 'quota_resource';
export const RequireQuota = (resource: 'students' | 'branches' | 'employees' | 'cameras') =>
  SetMetadata(QUOTA_KEY, resource);

@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.getAllAndOverride<'students' | 'branches' | 'employees' | 'cameras'>(
      QUOTA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!resource) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const organizationId = user?.organizationId || request.headers['x-organization-id'];

    if (!organizationId) {
      return true; // Non-tenant requests bypass quota
    }

    // Platform owner bypasses customer quotas
    if (user?.role === 'PLATFORM_OWNER') {
      return true;
    }

    const check = await this.subscriptionsService.checkQuota(organizationId, resource);
    return check.allowed;
  }
}
