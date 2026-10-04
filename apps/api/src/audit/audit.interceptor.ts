import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

import { Request } from 'express';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
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

  private logEvent(context: ExecutionContext, request: Request & { user?: any }, responseData: unknown, statusCode: number) {
    const { method, path, ip, user, headers } = request;
    const userAgent = headers['user-agent'];
    const organizationId = user?.organizationId || headers['x-organization-id'];

    if (!organizationId) {
      return;
    }

    const action = method;
    let resource = path.split('/')[1] || 'unknown';
    resource = resource.toUpperCase();
    
    // Simple exclusion for non-mutating requests, unless it's a specific need. We'll just log all for now or check method
    if (['GET', 'OPTIONS', 'HEAD'].includes(method)) {
      return; // Often GETs aren't audited, but depending on requirements. Let's exclude GETs to prevent spam, or just log all? "Audit logging not global" means we want it. Usually, we only audit mutations.
    }

    this.auditService.record({
      organizationId,
      userId: user?.id,
      action,
      resource,
      ipAddress: ip,
      userAgent,
      method,
      path,
      statusCode,
    }).catch((err) => {
      // Ignore errors for now to not break the flow
      console.error('Audit log failed', err);
    });
  }
}
