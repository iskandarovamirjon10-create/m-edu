/**
 * Domain events for cross-module communication.
 * These events are published after state changes and can be consumed
 * by other modules (e.g., notifications, analytics, external integrations).
 */

import type { AttendanceDecision } from './enums';

export interface EnrollmentCreatedEvent {
  type: 'ENROLLMENT_CREATED';
  enrollmentId: string;
  organizationId: string;
  studentId: string;
  createdAt: string;
}

export interface EnrollmentActivatedEvent {
  type: 'ENROLLMENT_ACTIVATED';
  enrollmentId: string;
  organizationId: string;
  studentId: string;
  templateId: string;
  activatedAt: string;
}

export interface EnrollmentRevokedEvent {
  type: 'ENROLLMENT_REVOKED';
  enrollmentId: string;
  organizationId: string;
  studentId: string;
  revokedBy: string;
  reason: string;
  revokedAt: string;
}

export interface RecognitionAttemptedEvent {
  type: 'RECOGNITION_ATTEMPTED';
  attemptId: string;
  sessionId: string;
  organizationId: string;
  status: string;
  occurredAt: string;
}

export interface RecognitionConfirmedEvent {
  type: 'RECOGNITION_CONFIRMED';
  attemptId: string;
  sessionId: string;
  organizationId: string;
  studentId: string;
  confidence: number;
  occurredAt: string;
}

export interface RecognitionRejectedEvent {
  type: 'RECOGNITION_REJECTED';
  attemptId: string;
  sessionId: string;
  organizationId: string;
  reason: string;
  occurredAt: string;
}

export interface AttendanceRecordedEvent {
  type: 'ATTENDANCE_RECORDED';
  attendanceId: string;
  organizationId: string;
  studentId: string;
  groupId: string;
  lessonId: string | null;
  decision: AttendanceDecision;
  recordedAt: string;
}

export interface AttendanceDuplicatePreventedEvent {
  type: 'ATTENDANCE_DUPLICATE_PREVENTED';
  organizationId: string;
  studentId: string;
  groupId: string;
  existingAttendanceId: string;
  occurredAt: string;
}

export interface DeviceRegisteredEvent {
  type: 'DEVICE_REGISTERED';
  deviceId: string;
  organizationId: string;
  deviceName: string;
  registeredAt: string;
}

export interface DeviceRevokedEvent {
  type: 'DEVICE_REVOKED';
  deviceId: string;
  organizationId: string;
  revokedAt: string;
}

export interface DeviceHeartbeatEvent {
  type: 'DEVICE_HEARTBEAT';
  deviceId: string;
  organizationId: string;
  timestamp: string;
}

export interface BiometricAccessDeniedEvent {
  type: 'BIOMETRIC_ACCESS_DENIED';
  organizationId: string;
  userId: string;
  resourceType: string;
  resourceId: string;
  reason: string;
  timestamp: string;
}

export type FacePlatformEvent =
  | EnrollmentCreatedEvent
  | EnrollmentActivatedEvent
  | EnrollmentRevokedEvent
  | RecognitionAttemptedEvent
  | RecognitionConfirmedEvent
  | RecognitionRejectedEvent
  | AttendanceRecordedEvent
  | AttendanceDuplicatePreventedEvent
  | DeviceRegisteredEvent
  | DeviceRevokedEvent
  | DeviceHeartbeatEvent
  | BiometricAccessDeniedEvent;
