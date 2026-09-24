import { describe, it, expect } from 'vitest';
import { Roles, ROLES_KEY, AllowAnyRole, ALLOW_ANY_ROLE_KEY } from '../roles.decorator';

describe('Roles decorators', () => {
  it('Roles decorator sets roles metadata on target handler', () => {
    class TestController {
      @Roles('SUPER_ADMIN', 'ORG_ADMIN')
      testEndpoint() {}
    }

    const metadata = Reflect.getMetadata(ROLES_KEY, TestController.prototype.testEndpoint);
    expect(metadata).toEqual(['SUPER_ADMIN', 'ORG_ADMIN']);
  });

  it('AllowAnyRole decorator sets allowAnyRole metadata on target handler', () => {
    class TestController {
      @AllowAnyRole()
      testEndpoint() {}
    }

    const metadata = Reflect.getMetadata(ALLOW_ANY_ROLE_KEY, TestController.prototype.testEndpoint);
    expect(metadata).toBe(true);
  });
});
