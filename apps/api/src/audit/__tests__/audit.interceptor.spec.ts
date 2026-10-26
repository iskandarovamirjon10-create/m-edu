import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AuditInterceptor } from '../audit.interceptor';
import { AuditService } from '../audit.service';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let auditService: Partial<AuditService>;

  beforeEach(() => {
    auditService = {
      record: vi.fn().mockResolvedValue({} as any),
    };
    interceptor = new AuditInterceptor(auditService as AuditService);
  });

  function createMockContext(request: any, statusCode = 200): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ statusCode }),
      }),
    } as unknown as ExecutionContext;
  }

  function createMockCallHandler(result: any = { success: true }): CallHandler {
    return {
      handle: () => of(result),
    };
  }

  it('ignores GET, OPTIONS, HEAD requests', () => {
    const request = {
      method: 'GET',
      path: '/api/students',
      ip: '127.0.0.1',
      headers: {},
      user: { organizationId: 'org-1', id: 'user-1' },
    };
    const context = createMockContext(request);
    const handler = createMockCallHandler();

    interceptor.intercept(context, handler).subscribe();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('ignores requests without user organizationId', () => {
    const request = {
      method: 'POST',
      path: '/api/students',
      ip: '127.0.0.1',
      headers: {},
      user: null,
    };
    const context = createMockContext(request);
    const handler = createMockCallHandler();

    interceptor.intercept(context, handler).subscribe();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('correctly audits mutating requests and extracts resource & resourceId stripping /api', () => {
    const request = {
      method: 'PATCH',
      path: '/api/students/student-99?filter=active',
      ip: '192.168.1.1',
      headers: { 'user-agent': 'Vitest Browser' },
      user: { organizationId: 'org-test', sub: 'user-actor-123' },
    };
    const context = createMockContext(request, 200);
    const handler = createMockCallHandler({ updated: true });

    interceptor.intercept(context, handler).subscribe();

    expect(auditService.record).toHaveBeenCalledWith({
      organizationId: 'org-test',
      userId: 'user-actor-123',
      action: 'UPDATE',
      resource: 'STUDENTS',
      resourceId: 'student-99',
      ipAddress: '192.168.1.1',
      userAgent: 'Vitest Browser',
      method: 'PATCH',
      path: '/api/students/student-99?filter=active',
      statusCode: 200,
    });
  });

  it('records error status code when request handler fails', () => {
    const request = {
      method: 'DELETE',
      path: '/api/courses/course-12',
      ip: '10.0.0.1',
      headers: {},
      user: { organizationId: 'org-test', id: 'admin-1' },
    };
    const context = createMockContext(request, 200);
    const handler: CallHandler = {
      handle: () => throwError(() => ({ status: 403, message: 'Forbidden' })),
    };

    interceptor.intercept(context, handler).subscribe({
      error: () => {
        expect(auditService.record).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'DELETE',
            resource: 'COURSES',
            resourceId: 'course-12',
            statusCode: 403,
          }),
        );
      },
    });
  });
});
