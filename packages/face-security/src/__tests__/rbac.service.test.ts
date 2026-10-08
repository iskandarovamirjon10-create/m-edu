import { describe, it, expect } from 'vitest';
import { RbacService } from '../rbac.service';
import { BiometricAccessDeniedError } from '@medu/core';
import { Permissions, RolePermissions } from '@medu/contracts';

describe('RbacService', () => {
  const createService = (role: string) =>
    new RbacService(
      async () => role,
      async () => RolePermissions[role] || [],
    );

  it('ORG_ADMIN can enroll and manage devices', async () => {
    const svc = createService('ORG_ADMIN');
    expect(await svc.hasPermission(Permissions.FACE_ENROLL)).toBe(true);
    expect(await svc.hasPermission(Permissions.FACE_DEVICE_MANAGE)).toBe(true);
  });

  it('TEACHER can recognize but cannot enroll', async () => {
    const svc = createService('TEACHER');
    expect(await svc.hasPermission(Permissions.FACE_RECOGNIZE)).toBe(true);
    expect(await svc.hasPermission(Permissions.FACE_ENROLL)).toBe(false);
  });

  it('STUDENT has no face permissions', async () => {
    const svc = createService('STUDENT');
    expect(await svc.hasPermission(Permissions.FACE_VIEW)).toBe(false);
    expect(await svc.hasPermission(Permissions.FACE_RECOGNIZE)).toBe(false);
  });

  it('requirePermission throws BiometricAccessDeniedError for unauthorized role', async () => {
    const svc = createService('STUDENT');
    await expect(svc.requirePermission(Permissions.FACE_ENROLL)).rejects.toBeInstanceOf(
      BiometricAccessDeniedError,
    );
  });

  it('requirePermission resolves for authorized role', async () => {
    const svc = createService('ORG_ADMIN');
    await expect(svc.requirePermission(Permissions.FACE_ENROLL)).resolves.toBeUndefined();
  });

  it('hasAnyPermission returns true when any matches', async () => {
    const svc = createService('ASSISTANT');
    expect(
      await svc.hasAnyPermission([Permissions.FACE_ENROLL, Permissions.FACE_RECOGNIZE]),
    ).toBe(true);
  });

  it('unknown role has no permissions', async () => {
    const svc = createService('UNKNOWN_ROLE');
    expect(await svc.hasPermission(Permissions.FACE_VIEW)).toBe(false);
  });

  it('hasPermission honors an explicit role argument (regression: FS-4)', async () => {
    // The dynamic permission list grants nothing; the role matrix grants
    // the permission — previously the `role` parameter was ignored and
    // every @medu/core caller was checked against the raw closure.
    const svc = new RbacService(async () => 'ORG_ADMIN', async () => []);
    expect(await svc.hasPermission(Permissions.FACE_ENROLL)).toBe(false);
    expect(await svc.hasPermission(Permissions.FACE_ENROLL, 'ORG_ADMIN')).toBe(true);
    expect(await svc.hasPermission(Permissions.FACE_DEVICE_MANAGE, 'STUDENT')).toBe(false);
  });

  it('getPermissionsForRole static lookup matches contracts', () => {
    expect(RbacService.getPermissionsForRole('TEACHER')).toEqual(RolePermissions.TEACHER);
  });
});
