import { describe, it, expect } from 'vitest';
import {
  Permissions,
  RolePermissions,
  EnrollmentStatus,
  RecognitionAttemptStatus,
  AttendanceDecision,
} from '../enums';

describe('Contracts enums', () => {
  it('permissions use namespaced string values', () => {
    expect(Permissions.FACE_ENROLL).toBe('face.enroll');
    expect(Permissions.FACE_RECOGNIZE).toBe('face.recognize');
    expect(Permissions.CAMERA_MANAGE).toBe('camera.manage');
  });

  it('SUPER_ADMIN gets every permission', () => {
    const all = Object.values(Permissions);
    for (const p of all) {
      expect(RolePermissions.SUPER_ADMIN).toContain(p);
    }
  });

  it('ORG_ADMIN has face + camera management', () => {
    expect(RolePermissions.ORG_ADMIN).toContain(Permissions.FACE_ENROLL);
    expect(RolePermissions.ORG_ADMIN).toContain(Permissions.CAMERA_MANAGE);
  });

  it('TEACHER is recognition-only', () => {
    expect(RolePermissions.TEACHER).toContain(Permissions.FACE_RECOGNIZE);
    expect(RolePermissions.TEACHER).not.toContain(Permissions.FACE_ENROLL);
    expect(RolePermissions.TEACHER).not.toContain(Permissions.FACE_DEVICE_MANAGE);
  });

  it('enrollment lifecycle values', () => {
    expect(EnrollmentStatus.PENDING).toBe('PENDING');
    expect(EnrollmentStatus.ACTIVE).toBe('ACTIVE');
    expect(EnrollmentStatus.REVOKED).toBe('REVOKED');
    expect(EnrollmentStatus.EXPIRED).toBe('EXPIRED');
  });

  it('recognition attempt statuses cover pipeline stages', () => {
    expect(RecognitionAttemptStatus.IDENTIFIED).toBe('IDENTIFIED');
    expect(RecognitionAttemptStatus.LIVENESS_FAILED).toBe('LIVENESS_FAILED');
    expect(RecognitionAttemptStatus.MATCH_UNCERTAIN).toBe('MATCH_UNCERTAIN');
  });

  it('attendance decisions include duplicate prevention', () => {
    expect(AttendanceDecision.DUPLICATE_PREVENTED).toBe('DUPLICATE_PREVENTED');
    expect(AttendanceDecision.RECORDED).toBe('RECORDED');
  });
});
