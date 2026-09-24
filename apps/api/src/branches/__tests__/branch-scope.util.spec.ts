import { describe, it, expect } from 'vitest';
import { branchScopeFilter } from '../branch-scope.util';

describe('branchScopeFilter', () => {
  it('should return only organizationId when branchId is omitted or null or undefined', () => {
    expect(branchScopeFilter('org-1')).toEqual({ organizationId: 'org-1' });
    expect(branchScopeFilter('org-1', null)).toEqual({ organizationId: 'org-1' });
    expect(branchScopeFilter('org-1', undefined)).toEqual({ organizationId: 'org-1' });
  });

  it('should return both organizationId and branchId when branchId is provided', () => {
    expect(branchScopeFilter('org-1', 'branch-42')).toEqual({
      organizationId: 'org-1',
      branchId: 'branch-42',
    });
  });
});
