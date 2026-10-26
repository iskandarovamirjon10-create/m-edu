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
    const request = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      tap({
        next: (data) => {
          this.logEvent(context, request, data, context.switchToHttp().getResponse().statusCode);
        },
        error: (error) => {
          this.logEvent(context, request, null, error.status || 500);
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
    const { method, path, ip, user, headers } = request;
    const userAgent = headers['user-agent'];

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

    this.auditService
      .record({
        organizationId,
        userId: user?.id || user?.sub || null,
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
