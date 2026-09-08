/**
 * Friendly, user-facing messages for M-EDU face/recognition error codes.
 * The API returns stable `code` values (see @medu/core domain errors);
 * raw domain messages are technical and confusing in the UI. This mapper
 * translates them for operators/students while preserving the technical
 * message as a fallback.
 */
import { ApiError } from './api';

const FACE_ERROR_MESSAGES: Record<string, string> = {
  // --- Enrollment ---
  ENROLLMENT_NOT_FOUND: 'Enrollment not found. Please start a new enrollment.',
  ENROLLMENT_ALREADY_EXISTS: 'This student already has an active enrollment. Revoke it before re-enrolling.',
  ENROLLMENT_NOT_ACTIVE: 'This enrollment is not active. Start a new enrollment.',

  // --- Capture pipeline ---
  FACE_NOT_DETECTED: 'No face detected. Make sure your face is well-lit and fully visible in the frame.',
  MULTIPLE_FACES_DETECTED: 'Multiple faces detected. Only one person may be in the frame.',
  FACE_QUALITY_TOO_LOW: 'Face quality is too low. Move closer and improve the lighting.',
  LIVENESS_FAILED: 'Liveness check failed — the capture may be a photo or screen replay. Use a live face.',
  LIVENESS_UNAVAILABLE: 'Liveness check is temporarily unavailable. Please try again later.',
  ENGINE_UNAVAILABLE: 'The recognition engine is unavailable right now. Please try again later.',
  ENGINE_TIMEOUT: 'The recognition engine timed out. Please try again.',

  // --- Matching ---
  FACE_MATCH_NOT_FOUND: 'No matching face found. Try again, or re-enroll the student.',
  FACE_MATCH_UNCERTAIN: 'The face match is uncertain. Try again with better lighting and a straight-on view.',
  TEMPLATE_CORRUPTED: 'The stored face template could not be read. Re-enrollment may be required.',

  // --- Attendance / grouping ---
  STUDENT_NOT_IN_GROUP: 'Student is not enrolled in any active group.',
  ATTENDANCE_ALREADY_EXISTS: 'Attendance for this student is already recorded for today.',
  LESSON_INVALID: 'No valid lesson is scheduled for this time.',
  STUDENT_INACTIVE: 'This student account is inactive.',

  // --- Devices ---
  DEVICE_NOT_FOUND: 'Device not found.',
  DEVICE_REVOKED: 'This device has been revoked.',
  DEVICE_NOT_AUTHORIZED: 'This device is not authorized.',

  // --- Security / tenant ---
  BIOMETRIC_ACCESS_DENIED: 'You do not have permission to access biometric data.',
  TENANT_MISMATCH: 'Organization mismatch — access denied.',
  CONSENT_REQUIRED: 'Biometric consent is required before enrolling a face.',
  SESSION_NOT_FOUND: 'Recognition session not found.',
  SESSION_ALREADY_FINISHED: 'This recognition session has already finished.',
  MAX_CONCURRENT_SESSIONS: 'Too many concurrent recognition sessions. Close another session and try again.',
  VALIDATION_ERROR: 'The request could not be validated. Check the entered values and try again.',
};

/**
 * Return a friendly message for an API error if a known face/recognition
 * `code` is present; otherwise fall back to the raw error message.
 */
export function friendlyFaceError(err: unknown): string {
  if (err instanceof ApiError) {
    const details = err.details as { code?: string } | null | undefined;
    const code = details?.code;
    if (code && FACE_ERROR_MESSAGES[code]) {
      return FACE_ERROR_MESSAGES[code];
    }
  }
  return err instanceof Error ? err.message : String(err);
}
