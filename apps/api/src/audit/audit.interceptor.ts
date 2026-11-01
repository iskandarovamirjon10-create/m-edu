import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { Request } from 'express';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (typeof context.getType === 'function' && context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    if (!request) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          const res = context.switchToHttp().getResponse();
          const statusCode = res?.statusCode ?? 200;
          this.logEvent(context, request, data, statusCode);
        },
        error: (error) => {
          const status = error?.getStatus?.() || error?.status || error?.statusCode || 500;
          this.logEvent(context, request, null, status);
        },
      }),
    );
  }

  private logEvent(
    _context: ExecutionContext,
    request: Request & { user?: any },
    _responseData: unknown,
    statusCode: number,
  ) {
    const method = request.method || 'GET';
    const path = request.path || (request as any).url || '';
    const ip = request.ip || (request as any).socket?.remoteAddress;
    const user = request.user;
    const headers = request.headers || {};
    const userAgent = typeof headers['user-agent'] === 'string' ? headers['user-agent'] : undefined;

    // SECURITY: the tenant MUST come from the authenticated principal.
    // Honoring a client-supplied x-organization-id header would let any
    // caller poison the audit trail used for forensics.
    const organizationId = user?.organizationId;

    if (!organizationId) {
      return;
    }

    // Only audit mutating state operations
    if (['GET', 'OPTIONS', 'HEAD'].includes(method)) {
      return;
    }

    // Parse path segments to extract domain resource and resourceId (skipping global 'api' prefix)
    const segments = path.split('?')[0].split('/').filter(Boolean);
    const resourceIndex = segments[0]?.toLowerCase() === 'api' ? 1 : 0;
    const resource = (segments[resourceIndex] || 'UNKNOWN').toUpperCase();
    const resourceId = segments[resourceIndex + 1] || null;

    // Standardize CRUD actions
    const actionMap: Record<string, string> = {
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };
    const action = actionMap[method] || method;

    const actorId = user?.id || user?.sub || null;
    const validActorId = typeof actorId === 'string' && actorId.trim() ? actorId : null;

    if (!organizationId || typeof organizationId !== 'string' || !organizationId.trim()) {
      return;
    }

    this.auditService
      .record({
        organizationId,
        userId: validActorId,
        action,
        resource,
        resourceId,
        ipAddress: ip,
        userAgent,
        method,
        path,
        statusCode,
      })
      .catch((err) => {
        this.logger.error('Audit log failed', err);
      });
  }
}
