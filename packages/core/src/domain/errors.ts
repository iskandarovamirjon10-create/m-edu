/**
 * Domain errors with stable error codes.
 * Each error maps to a specific failure case in the face recognition pipeline.
 * Internal implementation details are never exposed to the client.
 */

// ============================================================================
// Base Error
// ============================================================================

export abstract class FacePlatformError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;

  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
  }

  /** Safe error object for client consumption — never includes internal details */
  toClientError(): { code: string; message: string } {
    return { code: this.code, message: this.message };
  }
}

// ============================================================================
// Enrollment Errors
// ============================================================================

export class EnrollmentNotFoundError extends FacePlatformError {
  readonly code = 'ENROLLMENT_NOT_FOUND';
  readonly httpStatus = 404;

  constructor(id: string) {
    super(`Enrollment not found: ${id}`);
  }
}

export class EnrollmentAlreadyExistsError extends FacePlatformError {
  readonly code = 'ENROLLMENT_ALREADY_EXISTS';
  readonly httpStatus = 409;

  constructor(studentId: string) {
    super(`Active enrollment already exists for student: ${studentId}`);
  }
}

export class EnrollmentNotActiveError extends FacePlatformError {
  readonly code = 'ENROLLMENT_NOT_ACTIVE';
  readonly httpStatus = 400;

  constructor(id: string) {
    super(`Enrollment is not active: ${id}`);
  }
}

export class DuplicateFaceEnrollmentError extends FacePlatformError {
  readonly code = 'DUPLICATE_FACE_ENROLLMENT';
  readonly httpStatus = 409;

  constructor(duplicateStudentId: string, similarity: number) {
    super(
      `Face enrollment rejected: this face is already enrolled for another student (${duplicateStudentId}) with similarity ${(similarity * 100).toFixed(1)}%`,
      { duplicateStudentId, similarity },
    );
  }
}

// ============================================================================
// Face Detection Errors
// ============================================================================

export class FaceNotDetectedError extends FacePlatformError {
  readonly code = 'FACE_NOT_DETECTED';
  readonly httpStatus = 422;

  constructor() {
    super('No face detected in the provided image');
  }
}

export class MultipleFacesDetectedError extends FacePlatformError {
  readonly code = 'MULTIPLE_FACES_DETECTED';
  readonly httpStatus = 422;

  constructor(count: number) {
    super(`Multiple faces detected (${count}). Only one face is allowed per capture.`);
  }
}

// ============================================================================
// Quality Errors
// ============================================================================

export class FaceQualityTooLowError extends FacePlatformError {
  readonly code = 'FACE_QUALITY_TOO_LOW';
  readonly httpStatus = 422;

  constructor(score: number, threshold: number) {
    super(`Face quality score ${score.toFixed(3)} is below threshold ${threshold}`);
  }
}

// ============================================================================
// Liveness Errors
// ============================================================================

export class LivenessFailedError extends FacePlatformError {
  readonly code = 'LIVENESS_FAILED';
  readonly httpStatus = 422;

  constructor(result: string) {
    super(`Liveness check failed: ${result}`);
  }
}

export class LivenessUnavailableError extends FacePlatformError {
  readonly code = 'LIVENESS_UNAVAILABLE';
  readonly httpStatus = 503;

  constructor() {
    super('Liveness detection is currently unavailable');
  }
}

// ============================================================================
// Matching Errors
// ============================================================================

export class FaceMatchNotFoundError extends FacePlatformError {
  readonly code = 'FACE_MATCH_NOT_FOUND';
  readonly httpStatus = 404;

  constructor() {
    super('No matching face template found');
  }
}

export class FaceMatchUncertainError extends FacePlatformError {
  readonly code = 'FACE_MATCH_UNCERTAIN';
  readonly httpStatus = 422;

  constructor(score: number, threshold: number) {
    super(`Face match confidence ${score.toFixed(3)} is below threshold ${threshold}`);
  }
}

// ============================================================================
// Template Errors
// ============================================================================

export class TemplateCorruptedError extends FacePlatformError {
  readonly code = 'TEMPLATE_CORRUPTED';
  readonly httpStatus = 500;

  constructor(templateId: string) {
    super(`Face template is corrupted: ${templateId}`);
  }
}

// ============================================================================
// Attendance Errors
// ============================================================================

export class StudentNotInGroupError extends FacePlatformError {
  readonly code = 'STUDENT_NOT_IN_GROUP';
  readonly httpStatus = 400;

  constructor(studentId: string, groupId: string) {
    super(`Student ${studentId} is not enrolled in group ${groupId}`);
  }
}

export class AttendanceAlreadyExistsError extends FacePlatformError {
  readonly code = 'ATTENDANCE_ALREADY_EXISTS';
  readonly httpStatus = 409;

  constructor(studentId: string, groupId: string) {
    super(`Attendance already recorded for student ${studentId} in group ${groupId}`);
  }
}

export class LessonInvalidError extends FacePlatformError {
  readonly code = 'LESSON_INVALID';
  readonly httpStatus = 400;

  constructor(lessonId: string) {
    super(`Lesson is invalid or not currently active: ${lessonId}`);
  }
}

export class StudentInactiveError extends FacePlatformError {
  readonly code = 'STUDENT_INACTIVE';
  readonly httpStatus = 400;

  constructor(studentId: string) {
    super(`Student account is inactive: ${studentId}`);
  }
}

// ============================================================================
// Device Errors
// ============================================================================

export class DeviceNotFoundError extends FacePlatformError {
  readonly code = 'DEVICE_NOT_FOUND';
  readonly httpStatus = 404;

  constructor(id: string) {
    super(`Device not found: ${id}`);
  }
}

export class DeviceRevokedError extends FacePlatformError {
  readonly code = 'DEVICE_REVOKED';
  readonly httpStatus = 403;

  constructor(id: string) {
    super(`Device has been revoked: ${id}`);
  }
}

export class DeviceNotAuthorizedError extends FacePlatformError {
  readonly code = 'DEVICE_NOT_AUTHORIZED';
  readonly httpStatus = 401;

  constructor() {
    super('Device is not authorized for this operation');
  }
}

// ============================================================================
// Engine Errors
// ============================================================================

export class EngineUnavailableError extends FacePlatformError {
  readonly code = 'ENGINE_UNAVAILABLE';
  readonly httpStatus = 503;

  constructor() {
    super('Face recognition engine is currently unavailable');
  }
}

export class EngineTimeoutError extends FacePlatformError {
  readonly code = 'ENGINE_TIMEOUT';
  readonly httpStatus = 504;

  constructor(operation: string) {
    super(`Face engine operation timed out: ${operation}`);
  }
}

// ============================================================================
// Security Errors
// ============================================================================

export class BiometricAccessDeniedError extends FacePlatformError {
  readonly code = 'BIOMETRIC_ACCESS_DENIED';
  readonly httpStatus = 403;

  constructor(resourceType: string, resourceId: string) {
    super(`Access denied to biometric resource: ${resourceType}/${resourceId}`);
  }
}

export class TenantMismatchError extends FacePlatformError {
  readonly code = 'TENANT_MISMATCH';
  readonly httpStatus = 403;

  constructor() {
    super('Operation not permitted: tenant mismatch');
  }
}

export class ConsentRequiredError extends FacePlatformError {
  readonly code = 'CONSENT_REQUIRED';
  readonly httpStatus = 403;

  constructor(studentId: string) {
    super(`Biometric consent required for student: ${studentId}`);
  }
}

// ============================================================================
// Session Errors
// ============================================================================

export class SessionNotFoundError extends FacePlatformError {
  readonly code = 'SESSION_NOT_FOUND';
  readonly httpStatus = 404;

  constructor(id: string) {
    super(`Recognition session not found: ${id}`);
  }
}

export class SessionAlreadyFinishedError extends FacePlatformError {
  readonly code = 'SESSION_ALREADY_FINISHED';
  readonly httpStatus = 400;

  constructor(id: string) {
    super(`Recognition session is already finished: ${id}`);
  }
}

export class MaxConcurrentSessionsError extends FacePlatformError {
  readonly code = 'MAX_CONCURRENT_SESSIONS';
  readonly httpStatus = 429;

  constructor(max: number) {
    super(`Maximum concurrent sessions (${max}) reached`);
  }
}

// ============================================================================
// Validation Errors
// ============================================================================

export class ValidationError extends FacePlatformError {
  readonly code = 'VALIDATION_ERROR';
  readonly httpStatus = 400;

  constructor(field: string, reason: string) {
    super(`Validation failed for ${field}: ${reason}`);
  }
}
