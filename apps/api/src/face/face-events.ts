/**
 * Shared pub/sub contract between the face enrollment pipeline (publisher)
 * and the camera worker manager (subscriber).
 *
 * Enrollment mutations (capture → activate, revoke, re-enroll) change the
 * template gallery that camera workers cache for TEMPLATE_CACHE_TTL_MS.
 * Without this signal a revoked student keeps matching for up to the TTL.
 */
export const FACE_TEMPLATES_CHANGED_CHANNEL =
  'face-templates-changed';

export interface FaceTemplatesChangedPayload {
  organizationId: string;
}
