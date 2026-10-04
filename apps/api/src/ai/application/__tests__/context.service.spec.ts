import { describe, it, expect, beforeEach } from 'vitest';
import { AiContextService } from '../context.service';
import { AiException } from '../../domain/ai.errors';

describe('AiContextService', () => {
  let service: AiContextService;

  beforeEach(() => {
    service = new AiContextService();
  });

  it('derives permissions from the role and keeps tenant identity server-side', () => {
    const context = service.fromRequest(
      { sub: 'user-1', organizationId: 'org-1', role: 'MANAGER' },
      { route: '/students', entity: { type: 'student', id: 's-1' }, locale: 'ru' },
    );

    expect(context.userId).toBe('user-1');
    expect(context.organizationId).toBe('org-1');
    expect(context.permissions).toContain('students:read');
    expect(context.route).toBe('/students');
    expect(context.entity).toEqual({ type: 'student', id: 's-1' });
    expect(context.locale).toBe('ru');
  });

  it('defaults the locale to Uzbek when unsupported', () => {
    const context = service.fromRequest({
      sub: 'user-1',
      organizationId: 'org-1',
      role: 'TEACHER',
    });
    expect(context.locale).toBe('uz');
  });

  it('rejects a request without tenant context (403)', () => {
    try {
      service.fromRequest({ sub: 'user-1', role: 'MANAGER' });
      throw new Error('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AiException);
      expect((error as AiException).getStatus()).toBe(403);
    }
  });

  it('rejects an unauthenticated request (401)', () => {
    try {
      service.fromRequest({ sub: '', organizationId: 'org-1', role: 'MANAGER' });
      throw new Error('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AiException);
      expect((error as AiException).getStatus()).toBe(401);
    }
  });

  it('gives STUDENT no AI permissions', () => {
    const context = service.fromRequest({
      sub: 'user-1',
      organizationId: 'org-1',
      role: 'STUDENT',
    });
    expect(context.permissions).toEqual([]);
  });
});
