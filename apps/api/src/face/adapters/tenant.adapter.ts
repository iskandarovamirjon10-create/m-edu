import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { TenantContext, TenantContextProvider } from '@medu/core/src/ports/tenant-context.port';
import { TenantMismatchError } from '@medu/core';
import type { RequestUser } from '../../auth/types';

interface TenantRequestContext {
  user?: RequestUser;
}

@Injectable()
export class NestTenantContextProvider implements TenantContextProvider {
  constructor(private readonly reqContext: TenantRequestContext) {}

  async getContext(): Promise<TenantContext> {
    const user = this.reqContext?.user;
    if (!user || !user.organizationId) {
      throw new UnauthorizedException('Valid tenant context is required.');
    }

    return {
      userId: user.sub,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };
  }

  async validateOrganization(organizationId: string): Promise<void> {
    const context = await this.getContext();
    if (context.organizationId !== organizationId) {
      throw new TenantMismatchError();
    }
  }
}