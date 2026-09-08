import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@medu/contracts';

export const FACE_PERMISSIONS_KEY = 'face_permissions';

/**
 * Marks a route handler as requiring one or more face-module permissions.
 *
 * The decorator's runtime guard rejects empty / non-string permission slots
 * up-front. Without it, a stray `''` slot would (a) make the
 * `requiredPermissions` array non-empty so the guard's short-circuit
 * doesn't kick in, then (b) never match any real permission in
 * `userPermissions`, so a `FacePermissionsGuard` check would silently pass
 * for the *other* permissions in the same decorator call. That's an
 * authorization bypass — closing it here at the decorator layer.
 */
export const FacePermissions = (
  ...permissions: Permission[]
): MethodDecorator & ClassDecorator => {
  for (const p of permissions) {
    if (typeof p !== 'string' || p.length === 0) {
      throw new Error(
        'FacePermissions: empty or non-string permission slot is not allowed',
      );
    }
  }
  return SetMetadata(FACE_PERMISSIONS_KEY, permissions);
};