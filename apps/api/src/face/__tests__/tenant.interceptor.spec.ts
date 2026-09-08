import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  CallHandler,
  ExecutionContext,
} from '@nestjs/common';

import { firstValueFrom, of } from 'rxjs';

import {
  TenantInterceptor,
} from '../interceptors/tenant.interceptor';

import type {
  RequestUser,
  TenantContext,
} from '../../auth/types';

/* -------------------------------------------------------------------------- */
/* Test helpers                                                               */
/* -------------------------------------------------------------------------- */

function makeContext(
  request: Record<string, unknown>,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function makeNext(
  value = 'handled',
): CallHandler {
  return {
    handle: vi.fn(() => of(value)),
  } as unknown as CallHandler;
}

function makeUser(
  overrides: Partial<RequestUser> = {},
): RequestUser {
  return {
    sub: 'user-1',
    email: 'admin@medu.test',
    role: 'ORG_ADMIN',
    organizationId: 'org-1',
    sid: 'session-1',
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Tenant context attachment                                                  */
/* -------------------------------------------------------------------------- */

describe('TenantInterceptor', () => {
  it('attaches tenant context exclusively from the validated JWT principal', async () => {
    const interceptor =
      new TenantInterceptor();

    const request: {
      user?: RequestUser;
      tenantContext?: TenantContext;
    } = {
      user: makeUser(),
    };

    const next = makeNext();

    await firstValueFrom(
      interceptor.intercept(
        makeContext(request),
        next,
      ),
    );

    expect(request.tenantContext).toEqual({
      userId: 'user-1',
      email: 'admin@medu.test',
      role: 'ORG_ADMIN',
      organizationId: 'org-1',
    });
  });

  it('maps JWT sub to tenantContext.userId', async () => {
    const interceptor =
      new TenantInterceptor();

    const request: {
      user?: RequestUser;
      tenantContext?: TenantContext;
    } = {
      user: makeUser({
        sub: 'jwt-sub-123',
      }),
    };

    await firstValueFrom(
      interceptor.intercept(
        makeContext(request),
        makeNext(),
      ),
    );

    expect(
      request.tenantContext?.userId,
    ).toBe('jwt-sub-123');
  });

  it('uses JWT organizationId as the only tenant identity', async () => {
    const interceptor =
      new TenantInterceptor();

    const request: {
      user?: RequestUser;
      tenantContext?: TenantContext;
    } = {
      user: makeUser({
        organizationId: 'org-legitimate',
      }),
    };

    await firstValueFrom(
      interceptor.intercept(
        makeContext(request),
        makeNext(),
      ),
    );

    expect(
      request.tenantContext?.organizationId,
    ).toBe('org-legitimate');
  });

  it('copies the authenticated email and role', async () => {
    const interceptor =
      new TenantInterceptor();

    const request: {
      user?: RequestUser;
      tenantContext?: TenantContext;
    } = {
      user: makeUser({
        email: 'teacher@medu.test',
        role: 'TEACHER',
      }),
    };

    await firstValueFrom(
      interceptor.intercept(
        makeContext(request),
        makeNext(),
      ),
    );

    expect(request.tenantContext).toEqual({
      userId: 'user-1',
      email: 'teacher@medu.test',
      role: 'TEACHER',
      organizationId: 'org-1',
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Principal minimization                                                   */
  /* ------------------------------------------------------------------------ */

  it('does not copy the raw JWT session id into tenant context', async () => {
    const interceptor =
      new TenantInterceptor();

    const request: {
      user?: RequestUser;
      tenantContext?: TenantContext;
    } = {
      user: makeUser({
        sid: 'private-session-id',
      }),
    };

    await firstValueFrom(
      interceptor.intercept(
        makeContext(request),
        makeNext(),
      ),
    );

    expect(
      request.tenantContext,
    ).not.toHaveProperty('sid');
  });

  it('does not copy unknown JWT principal fields', async () => {
    const interceptor =
      new TenantInterceptor();

    const request: {
      user?: RequestUser;
      tenantContext?: TenantContext;
    } = {
      user: {
        ...makeUser(),
        extra: 'must-not-leak',
        accessToken: 'must-not-leak',
        refreshToken: 'must-not-leak',
      } as RequestUser & {
        extra: string;
        accessToken: string;
        refreshToken: string;
      },
    };

    await firstValueFrom(
      interceptor.intercept(
        makeContext(request),
        makeNext(),
      ),
    );

    expect(request.tenantContext).toEqual({
      userId: 'user-1',
      email: 'admin@medu.test',
      role: 'ORG_ADMIN',
      organizationId: 'org-1',
    });

    expect(
      request.tenantContext,
    ).not.toHaveProperty('extra');

    expect(
      request.tenantContext,
    ).not.toHaveProperty('accessToken');

    expect(
      request.tenantContext,
    ).not.toHaveProperty('refreshToken');
  });

  /* ------------------------------------------------------------------------ */
  /* Header spoofing / tenant isolation                                       */
  /* ------------------------------------------------------------------------ */

  it('ignores x-tenant-id supplied by the client', async () => {
    const interceptor =
      new TenantInterceptor();

    const request: {
      headers: Record<string, string>;
      user?: RequestUser;
      tenantContext?: TenantContext;
    } = {
      headers: {
        'x-tenant-id': 'org-evil',
      },
      user: makeUser({
        organizationId: 'org-legitimate',
      }),
    };

    await firstValueFrom(
      interceptor.intercept(
        makeContext(request),
        makeNext(),
      ),
    );

    expect(
      request.tenantContext?.organizationId,
    ).toBe('org-legitimate');

    expect(
      request.tenantContext?.organizationId,
    ).not.toBe('org-evil');
  });

  it('ignores x-organization-id supplied by the client', async () => {
    const interceptor =
      new TenantInterceptor();

    const request: {
      headers: Record<string, string>;
      user?: RequestUser;
      tenantContext?: TenantContext;
    } = {
      headers: {
        'x-organization-id': 'org-evil',
      },
      user: makeUser({
        organizationId: 'org-legitimate',
      }),
    };

    await firstValueFrom(
      interceptor.intercept(
        makeContext(request),
        makeNext(),
      ),
    );

    expect(
      request.tenantContext?.organizationId,
    ).toBe('org-legitimate');
  });

  it('ignores multiple conflicting client tenant headers', async () => {
    const interceptor =
      new TenantInterceptor();

    const request: {
      headers: Record<string, string>;
      user?: RequestUser;
      tenantContext?: TenantContext;
    } = {
      headers: {
        'x-tenant-id': 'org-evil-1',
        'x-organization-id': 'org-evil-2',
        'x-org-id': 'org-evil-3',
      },
      user: makeUser({
        organizationId: 'org-legitimate',
      }),
    };

    await firstValueFrom(
      interceptor.intercept(
        makeContext(request),
        makeNext(),
      ),
    );

    expect(
      request.tenantContext?.organizationId,
    ).toBe('org-legitimate');
  });

  it('does not derive tenant identity from request headers when JWT is present', async () => {
    const interceptor =
      new TenantInterceptor();

    const request: {
      headers: Record<string, string>;
      user?: RequestUser;
      tenantContext?: TenantContext;
    } = {
      headers: {
        'x-tenant-id': 'attacker-controlled',
        'x-organization-id': 'attacker-controlled',
      },
      user: makeUser({
        organizationId: 'jwt-controlled',
      }),
    };

    await firstValueFrom(
      interceptor.intercept(
        makeContext(request),
        makeNext(),
      ),
    );

    expect(
      request.tenantContext?.organizationId,
    ).toBe('jwt-controlled');
  });

  /* ------------------------------------------------------------------------ */
  /* Existing context                                                         */
  /* ------------------------------------------------------------------------ */

  it('does not preserve a client-supplied tenantContext over the JWT context', async () => {
    const interceptor =
      new TenantInterceptor();

    const request: {
      user?: RequestUser;
      tenantContext?: TenantContext;
    } = {
      user: makeUser({
        organizationId: 'org-legitimate',
      }),

      tenantContext: {
        userId: 'evil-user',
        email: 'evil@example.com',
        role: 'ORG_ADMIN',
        organizationId: 'org-evil',
      },
    };

    await firstValueFrom(
      interceptor.intercept(
        makeContext(request),
        makeNext(),
      ),
    );

    expect(request.tenantContext).toEqual({
      userId: 'user-1',
      email: 'admin@medu.test',
      role: 'ORG_ADMIN',
      organizationId: 'org-legitimate',
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Unauthenticated requests                                                 */
  /* ------------------------------------------------------------------------ */

  it('passes requests without req.user through', async () => {
    const interceptor =
      new TenantInterceptor();

    const request: {
      user?: RequestUser;
      tenantContext?: TenantContext;
    } = {};

    const next = makeNext();

    const result =
      await firstValueFrom(
        interceptor.intercept(
          makeContext(request),
          next,
        ),
      );

    expect(result).toBe('handled');

    expect(next.handle).toHaveBeenCalledTimes(
      1,
    );
  });

  it('does not create tenant context for unauthenticated requests', async () => {
    const interceptor =
      new TenantInterceptor();

    const request: {
      user?: RequestUser;
      tenantContext?: TenantContext;
    } = {};

    await firstValueFrom(
      interceptor.intercept(
        makeContext(request),
        makeNext(),
      ),
    );

    expect(
      request,
    ).not.toHaveProperty(
      'tenantContext',
    );
  });

  it('does not invent tenant identity when req.user is absent even if headers are supplied', async () => {
    const interceptor =
      new TenantInterceptor();

    const request: {
      headers: Record<string, string>;
      user?: RequestUser;
      tenantContext?: TenantContext;
    } = {
      headers: {
        'x-tenant-id': 'org-attacker',
        'x-organization-id': 'org-attacker',
      },
    };

    await firstValueFrom(
      interceptor.intercept(
        makeContext(request),
        makeNext(),
      ),
    );

    expect(
      request,
    ).not.toHaveProperty(
      'tenantContext',
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Observable / handler contract                                             */
  /* ------------------------------------------------------------------------ */

  it('continues the observable stream', async () => {
    const interceptor =
      new TenantInterceptor();

    const next = makeNext(
      'recognition-result',
    );

    const request: {
      user?: RequestUser;
      tenantContext?: TenantContext;
    } = {
      user: makeUser(),
    };

    const result =
      await firstValueFrom(
        interceptor.intercept(
          makeContext(request),
          next,
        ),
      );

    expect(result).toBe(
      'recognition-result',
    );
  });

  it('calls the downstream handler exactly once', async () => {
    const interceptor =
      new TenantInterceptor();

    const next = makeNext();

    const request: {
      user?: RequestUser;
      tenantContext?: TenantContext;
    } = {
      user: makeUser(),
    };

    await firstValueFrom(
      interceptor.intercept(
        makeContext(request),
        next,
      ),
    );

    expect(
      next.handle,
    ).toHaveBeenCalledTimes(1);
  });

  /* ------------------------------------------------------------------------ */
  /* Role preservation                                                        */
  /* ------------------------------------------------------------------------ */

  it('preserves the authenticated role without trusting a header override', async () => {
    const interceptor =
      new TenantInterceptor();

    const request: {
      headers: Record<string, string>;
      user?: RequestUser;
      tenantContext?: TenantContext;
    } = {
      headers: {
        'x-role': 'ORG_ADMIN',
      },

      user: makeUser({
        role: 'TEACHER',
      }),
    };

    await firstValueFrom(
      interceptor.intercept(
        makeContext(request),
        makeNext(),
      ),
    );

    expect(
      request.tenantContext?.role,
    ).toBe('TEACHER');
  });

  /* ------------------------------------------------------------------------ */
  /* Tenant isolation invariants                                               */
  /* ------------------------------------------------------------------------ */

  it('keeps two different JWT tenants completely isolated', async () => {
    const interceptor =
      new TenantInterceptor();

    const requestOne: {
      user?: RequestUser;
      tenantContext?: TenantContext;
    } = {
      user: makeUser({
        sub: 'user-org-1',
        organizationId: 'org-1',
      }),
    };

    const requestTwo: {
      user?: RequestUser;
      tenantContext?: TenantContext;
    } = {
      user: makeUser({
        sub: 'user-org-2',
        organizationId: 'org-2',
      }),
    };

    await firstValueFrom(
      interceptor.intercept(
        makeContext(requestOne),
        makeNext(),
      ),
    );

    await firstValueFrom(
      interceptor.intercept(
        makeContext(requestTwo),
        makeNext(),
      ),
    );

    expect(
      requestOne.tenantContext?.organizationId,
    ).toBe('org-1');

    expect(
      requestTwo.tenantContext?.organizationId,
    ).toBe('org-2');

    expect(
      requestOne.tenantContext?.userId,
    ).toBe('user-org-1');

    expect(
      requestTwo.tenantContext?.userId,
    ).toBe('user-org-2');
  });
});