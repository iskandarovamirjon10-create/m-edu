import { describe, it, expect } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser } from '../current-user.decorator';

// Helper to extract the param decorator factory
function getParamDecoratorFactory() {
  class TestController {
    testMethod(@CurrentUser() _user: unknown, @CurrentUser('organizationId') _orgId: string) {}
  }

  const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'testMethod');
  const keys = Object.keys(metadata);
  return {
    fullUserFactory: metadata[keys[0]].factory,
    propertyFactory: metadata[keys[1]].factory,
  };
}

describe('CurrentUser decorator', () => {
  const mockUser = {
    id: 'u-123',
    email: 'test@example.com',
    organizationId: 'org-456',
    role: 'ORG_ADMIN',
  };

  function makeContext(user: unknown): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('extracts the entire user object when no data parameter is passed', () => {
    const { fullUserFactory } = getParamDecoratorFactory();
    const ctx = makeContext(mockUser);
    const result = fullUserFactory(undefined, ctx);
    expect(result).toEqual(mockUser);
  });

  it('extracts a specific property when data key is provided', () => {
    const { propertyFactory } = getParamDecoratorFactory();
    const ctx = makeContext(mockUser);
    const result = propertyFactory('organizationId', ctx);
    expect(result).toBe('org-456');
  });

  it('returns undefined if user object is not present', () => {
    const { propertyFactory, fullUserFactory } = getParamDecoratorFactory();
    const ctx = makeContext(undefined);
    expect(fullUserFactory(undefined, ctx)).toBeUndefined();
    expect(propertyFactory('organizationId', ctx)).toBeUndefined();
  });
});
