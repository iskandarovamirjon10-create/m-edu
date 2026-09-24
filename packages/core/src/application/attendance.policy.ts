/**
 * Attendance Policy — business validation before creating attendance records.
 *
 * Recognition ≠ Attendance. Even after successful recognition, the system must
 * validate business rules before recording attendance.
 */

import type { StudentDirectoryPort } from '../ports/student-directory.port';
import type { RecognitionRepository } from '../ports/recognition-repository.port';
import type { TenantContext } from '../ports/tenant-context.port';
import { AttendanceDecision } from '@medu/contracts';

export interface AttendanceCheckResult {
  decision: AttendanceDecision;
  message: string;
  /** Existing attendance record ID if duplicate */
  existingAttendanceId?: string;
}

export class AttendancePolicy {
  constructor(
    private readonly studentDirectory: StudentDirectoryPort,
    private readonly recognitionRepo: RecognitionRepository,
    private readonly duplicateWindowMinutes: number
  ) {}

  /**
   * Validate whether attendance should be recorded for a recognized student.
   * Returns a decision with the reason.
   */
  async validate(
    tenant: TenantContext,
    studentId: string,
    groupId: string,
    lessonId: string | null,
    _sessionId: string
  ): Promise<AttendanceCheckResult> {
    // 1. Check student is active
    const isActive = await this.studentDirectory.isStudentActive(tenant.organizationId, studentId);
    if (!isActive) {
      return {
        decision: 'STUDENT_INACTIVE',
        message: 'Student account is inactive',
      };
    }

    // 2. Check student is in this group
    const isInGroup = await this.studentDirectory.isStudentInGroup(
      tenant.organizationId,
      studentId,
      groupId
    );
    if (!isInGroup) {
      return {
        decision: 'STUDENT_NOT_IN_GROUP',
        message: 'Student is not enrolled in this group',
      };
    }

    // 3. Check for duplicate attendance for the day.
    // Attendance is day-scoped: the DB unique constraint is
    // (studentId, groupId, date) with a day-normalized date, and the camera
    // path (AttendanceDecisionEngine) treats ANY same-day row as a duplicate
    // (manual rows are authoritative). Previously this path only blocked
    // duplicates within `duplicateWindowMinutes`; an older same-day record
    // fell through to RECORDED and then collided with the unique constraint
    // (raw P2002 → 500) or created a second attendance row for the day. Any
    // existing row for the day is a duplicate — never re-record.
    const existingAttendance = await this.recognitionRepo.findExistingAttendance(
      tenant.organizationId,
      studentId,
      groupId,
      lessonId
    );

    if (existingAttendance) {
      return {
        decision: 'DUPLICATE_PREVENTED',
        message: 'Attendance already recorded for this student today',
        existingAttendanceId: existingAttendance.id,
      };
    }

    // 4. All checks passed
    return {
      decision: 'RECORDED',
      message: 'Attendance validated and ready to record',
    };
  }
}
