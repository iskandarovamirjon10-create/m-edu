import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export enum SecurityEventType {
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  TOKEN_REUSE = 'TOKEN_REUSE',
  CROSS_TENANT_ACCESS_ATTEMPT = 'CROSS_TENANT_ACCESS_ATTEMPT',
  UNAUTHORIZED_RESOURCE_ACCESS = 'UNAUTHORIZED_RESOURCE_ACCESS',
  INVITE_CREATED = 'INVITE_CREATED',
  INVITE_REDEEMED = 'INVITE_REDEEMED',
  RATE_LIMIT_TRIGGERED = 'RATE_LIMIT_TRIGGERED',
  PLATFORM_BOOTSTRAPPED = 'PLATFORM_BOOTSTRAPPED'
}

@Injectable()
export class SecurityEventService {
  private readonly logger = new Logger(SecurityEventService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logEvent(params: {
    eventType: SecurityEventType;
    organizationId?: string;
    userId?: string;
    resourceType?: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    reason?: string;
    metadata?: any;
  }) {
    try {
      await this.prisma.securityEvent.create({
        data: {
          eventType: params.eventType,
          organizationId: params.organizationId,
          userId: params.userId,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          success: params.success,
          reason: params.reason,
          metadata: params.metadata || {},
        }
      });
    } catch (e) {
      this.logger.error("Failed to log security event", e.stack);
    }
  }
}

