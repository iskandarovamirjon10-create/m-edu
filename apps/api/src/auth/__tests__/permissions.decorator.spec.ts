import { describe, it, expect } from 'vitest';
import { RequirePermissions, PERMISSIONS_KEY } from '../permissions.decorator';
import { Permissions } from '@medu/contracts';

describe('RequirePermissions decorator', () => {
  it('sets permissions metadata on target handler', () => {
    class TestController {
      @RequirePermissions(Permissions.VIEW_STUDENTS, Permissions.EDIT_STUDENTS)
      testEndpoint() {}
    }

    const metadata = Reflect.getMetadata(PERMISSIONS_KEY, TestController.prototype.testEndpoint);
    expect(metadata).toEqual([Permissions.VIEW_STUDENTS, Permissions.EDIT_STUDENTS]);
  });
});
