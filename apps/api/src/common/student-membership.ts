import type { Prisma } from '@prisma/client';
import { getOrganizationDate } from './date-range';

/**
 * THE canonical definition of "this student is enrolled in this group".
 *
 * This rule used to be written out inline in FOUR places and the four copies
 * had already drifted apart:
 *
 *   1. AttendanceService.markAttendance      — full rule (window included)
 *   2. AttendanceDecisionEngine (camera)     — full rule (window included)
 *   3. PrismaStudentAdapter.isStudentInGroup — window MISSING
 *   4. PrismaEnrollmentAdapter.streamActiveTemplates (face candidate
 *      retrieval)                             — group/student state MISSING
 *
 * The result was that the face-session pipeline could identify a student the
 * camera pipeline would reject (and vice versa), surfacing as
 * "Student X is not enrolled in group Y" after a successful recognition, or
 * as attendance recorded on one path but not the other.
 *
 * CANONICAL RULE (org-local attendance day `dayStart` … `dayStart + 24h`):
 *   - StudentGroup.organizationId = the caller's tenant
 *   - StudentGroup.isActive       = true
 *   - StudentGroup.joinedAt      <  END of the day  (assigned today counts)
 *   - StudentGroup.leftAt IS NULL OR leftAt >= START of the day
 *   - Group.isActive              = true  (soft-deleted groups take no attendance)
 *   - Student.status NOT IN (PAUSED, DROPPED)
 */
export const INELIGIBLE_STUDENT_STATUSES = ['PAUSED', 'DROPPED'] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface MembershipWhereParams {
  organizationId: string;
  /** Org-local UTC midnight of the attendance day. Omit to skip the window. */
  dayStart?: Date;
  groupId?: string;
  studentId?: string;
}

/**
 * Build the canonical `StudentGroup` filter.
 *
 * `dayStart` is optional on purpose: candidate retrieval (which must stay a
 * SUPERSET of the attendance gate or enrolled students would never even be
 * identified) may omit the membership window when it cannot afford the
 * organization-timezone lookup. Everything else MUST pass it.
 */
export function canonicalMembershipWhere(
  params: MembershipWhereParams,
): Prisma.StudentGroupWhereInput {
  const where: Prisma.StudentGroupWhereInput = {
    organizationId: params.organizationId,
    isActive: true,
    group: { isActive: true },
    student: { status: { notIn: [...INELIGIBLE_STUDENT_STATUSES] } },
  };

  if (params.groupId) where.groupId = params.groupId;
  if (params.studentId) where.studentId = params.studentId;

  if (params.dayStart) {
    const dayEnd = new Date(params.dayStart.getTime() + MS_PER_DAY);
    where.joinedAt = { lt: dayEnd };
    where.OR = [{ leftAt: null }, { leftAt: { gte: params.dayStart } }];
  }

  return where;
}

/** Org-local start of the attendance day for `at`, using the tenant timezone. */
export function organizationDayStart(at: Date, timezone?: string | null): Date {
  return getOrganizationDate(at, timezone);
}
