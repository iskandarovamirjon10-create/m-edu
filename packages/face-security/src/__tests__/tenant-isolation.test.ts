import { describe, it, expect } from 'vitest';
import { assertTenantOwnership } from '../tenant-isolation.service';
import { TenantMismatchError } from '@medu/core';

describe('Tenant Isolation (P0)', () => {
  it('same organization passes ownership check', () => {
    expect(() => assertTenantOwnership('org-1', 'org-1')).not.toThrow();
  });

  it('cross-tenant access throws TenantMismatchError', () => {
    expect(() => assertTenantOwnership('org-A', 'org-B')).toThrow(TenantMismatchError);
    expect(() => assertTenantOwnership('org-A', 'org-B')).toThrowError(
      expect.objectContaining({ httpStatus: 403, code: 'TENANT_MISMATCH' }),
    );
  });

  it('empty vs non-empty org rejected', () => {
    expect(() => assertTenantOwnership('', 'org-B')).toThrow(TenantMismatchError);
  });
});
