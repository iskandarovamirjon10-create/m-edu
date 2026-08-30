import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';
import 'package:m_edu/features/students/domain/student_360/academic_snapshot.dart';
import 'package:m_edu/features/students/domain/student_360/activity_timeline.dart';
import 'package:m_edu/features/students/domain/student_360/attendance_snapshot.dart';
import 'package:m_edu/features/students/domain/student_360/audit_snapshot.dart';
import 'package:m_edu/features/students/domain/student_360/communication_snapshot.dart';
import 'package:m_edu/features/students/domain/student_360/crm_snapshot.dart';
import 'package:m_edu/features/students/domain/student_360/family_snapshot.dart';
import 'package:m_edu/features/students/domain/student_360/financial_snapshot.dart';
import 'package:m_edu/features/students/domain/student_360/identity_snapshot.dart';
import 'package:m_edu/features/students/domain/student_360/schedule_snapshot.dart';
import 'package:m_edu/features/students/domain/student_360/student_360.dart';

Identity _identity({
  String id = 'M-EDU-2026-000001',
  IdentityStatus status = IdentityStatus.active,
  IdentityRole role = IdentityRole.student,
}) {
  return Identity(
    identityId: id,
    firstName: 'Ali',
    lastName: 'Valiyev',
    role: role,
    status: status,
    qrSeed: 'q-$id',
    createdAt: DateTime(2026, 1, 1),
  );
}

Student _student({
  String identityId = 'M-EDU-2026-000001',
  String? groupId,
  StudentStatus status = StudentStatus.active,
}) {
  return Student(
    identityId: identityId,
    studentNumber: 1,
    studentStatus: status,
    enrolledAt: DateTime(2026, 1, 1),
    groupId: groupId,
  );
}

void main() {
  group('Student 360 — Snapshot immutability & defaults', () {
    test('StudentIdentitySnapshot.fromIdentity projects correctly', () {
      final i = _identity();
      final snap = StudentIdentitySnapshot.fromIdentity(i);
      expect(snap.identityId, 'M-EDU-2026-000001');
      expect(snap.fullName, 'Ali Valiyev');
      expect(snap.status, IdentityStatus.active);
      expect(snap.role, IdentityRole.student);
      expect(snap.registeredAt, DateTime(2026, 1, 1));
    });

    test('FamilySnapshot.empty has no data', () {
      const empty = FamilySnapshot.empty();
      expect(empty.guardianName, isNull);
      expect(empty.guardianPhone, isNull);
      expect(empty.guardianTelegramId, isNull);
      expect(empty.hasLinkedIdentity, isFalse);
      expect(empty.hasAny, isFalse);
      expect(empty.hasTelegramLinkage, isFalse);
    });

    test('FamilySnapshot with Telegram linkage', () {
      const family = FamilySnapshot(
        guardianName: 'Karim',
        guardianPhone: '+998901234567',
        guardianTelegramId: '12345678',
        hasLinkedIdentity: false,
      );
      expect(family.hasAny, isTrue);
      expect(family.hasTelegramLinkage, isTrue);
    });

    test('AcademicSnapshot flags', () {
      final active = AcademicSnapshot(
        currentGroupId: 'G-1',
        currentGroupName: 'Group A',
        academicYear: '2026',
        studentStatus: 'active',
        pendingTransferToGroupId: null,
        transferStatus: 'none',
        enrolledAt: DateTime(2026, 1, 1),
        assignedAt: DateTime(2026, 1, 2),
        completedAt: null,
      );
      expect(active.hasGroup, isTrue);
      expect(active.isActive, isTrue);
      expect(active.isPendingTransfer, isFalse);

      final pending = active.copyWith(
        pendingTransferToGroupId: 'G-2',
        transferStatus: 'pending',
      );
      expect(pending.isPendingTransfer, isTrue);
    });

    test('AttendanceSnapshot.unavailable isAvailable=false', () {
      const snap = AttendanceSnapshot.unavailable();
      expect(snap.isAvailable, isFalse);
      expect(snap.scheduledLessons, 0);
      expect(snap.percentage, 0);
    });

    test('AttendanceSnapshot percentage formula', () {
      const snap = AttendanceSnapshot(
        scheduledLessons: 10,
        presentLessons: 6,
        lateLessons: 2,
        excusedLessons: 1,
        absentLessons: 1,
        isAvailable: true,
      );
      expect(snap.totalAttended, 8);
      expect(snap.denominator, 9);
      // 8/9 * 100 ≈ 88.89
      expect(snap.percentage, closeTo(88.888, 0.01));
    });

    test('FinancialSnapshot.empty has no data', () {
      const empty = FinancialSnapshot.empty();
      expect(empty.totalPaid, 0);
      expect(empty.outstandingDebt, 0);
      expect(empty.hasAnyPayment, isFalse);
      expect(empty.hasDebt, isFalse);
      expect(empty.hasOverdue, isFalse);
      expect(empty.netBalance, 0);
    });

    test('CrmSnapshot.empty hasLead=false', () {
      const empty = CrmSnapshot.empty();
      expect(empty.hasLead, isFalse);
      expect(empty.source, isNull);
      expect(empty.score, 0);
      expect(empty.leadActivities, isEmpty);
    });

    test('CommunicationSnapshot.empty smsAvailable=false', () {
      const empty = CommunicationSnapshot.empty();
      expect(empty.telegramLinked, isFalse);
      expect(empty.smsAvailable, isFalse);
      expect(empty.smsHistory, isEmpty);
    });

    test('ScheduleSnapshot.empty isAvailable=false', () {
      const empty = ScheduleSnapshot.empty();
      expect(empty.isAvailable, isFalse);
      expect(empty.hasGroup, isFalse);
      expect(empty.hasTodayLessons, isFalse);
    });

    test('AuditSnapshot.empty has no entries', () {
      const empty = AuditSnapshot.empty();
      expect(empty.hasAny, isFalse);
      expect(empty.count, 0);
      expect(empty.oldestAt, isNull);
      expect(empty.newestAt, isNull);
    });

    test('ActivityTimeline.empty has no events', () {
      const tl = ActivityTimeline.empty();
      expect(tl.hasAny, isFalse);
      expect(tl.events, isEmpty);
      expect(tl.isComplete, isTrue);
    });
  });

  group('Student 360 — Aggregate composition', () {
    test('Student360 builds from snapshots + student', () {
      final identity = _identity();
      final student = _student(groupId: 'G-1');
      final now = DateTime(2026, 1, 5);

      final s360 = Student360(
        identityId: identity.identityId,
        student: student,
        identity: StudentIdentitySnapshot.fromIdentity(identity),
        family: const FamilySnapshot.empty(),
        academic: AcademicSnapshot(
          currentGroupId: student.groupId,
          currentGroupName: null,
          academicYear: null,
          studentStatus: student.studentStatus.name,
          pendingTransferToGroupId: null,
          transferStatus: student.transferStatus.name,
          enrolledAt: student.enrolledAt,
          assignedAt: null,
          completedAt: null,
        ),
        attendance: const AttendanceSnapshot.unavailable(),
        financial: const FinancialSnapshot.empty(),
        crm: const CrmSnapshot.empty(),
        communication: const CommunicationSnapshot.empty(),
        schedule: const ScheduleSnapshot.empty(),
        timeline: const ActivityTimeline.empty(),
        audit: const AuditSnapshot.empty(),
        generatedAt: now,
      );

      expect(s360.identityId, 'M-EDU-2026-000001');
      expect(s360.hasGroup, isTrue);
      expect(s360.hasAttendanceData, isFalse);
      expect(s360.hasFinancialData, isFalse);
      expect(s360.hasCrm, isFalse);
      expect(s360.hasTelegramLink, isFalse);
      expect(s360.hasAuditTrail, isFalse);
      expect(s360.isActive, isTrue);
      expect(s360.generatedAt, now);
    });

    test('Student360 with no group', () {
      final identity = _identity();
      final student = _student();
      final s360 = Student360(
        identityId: identity.identityId,
        student: student,
        identity: StudentIdentitySnapshot.fromIdentity(identity),
        family: const FamilySnapshot.empty(),
        academic: AcademicSnapshot(
          currentGroupId: null,
          currentGroupName: null,
          academicYear: null,
          studentStatus: student.studentStatus.name,
          pendingTransferToGroupId: null,
          transferStatus: student.transferStatus.name,
          enrolledAt: student.enrolledAt,
          assignedAt: null,
          completedAt: null,
        ),
        attendance: const AttendanceSnapshot.unavailable(),
        financial: const FinancialSnapshot.empty(),
        crm: const CrmSnapshot.empty(),
        communication: const CommunicationSnapshot.empty(),
        schedule: const ScheduleSnapshot.empty(),
        timeline: const ActivityTimeline.empty(),
        audit: const AuditSnapshot.empty(),
        generatedAt: DateTime.now(),
      );
      expect(s360.hasGroup, isFalse);
    });

    test('Student360 inactive student', () {
      final identity = _identity();
      final student = _student(status: StudentStatus.archived);
      final s360 = Student360(
        identityId: identity.identityId,
        student: student,
        identity: StudentIdentitySnapshot.fromIdentity(identity),
        family: const FamilySnapshot.empty(),
        academic: AcademicSnapshot(
          currentGroupId: null,
          currentGroupName: null,
          academicYear: null,
          studentStatus: student.studentStatus.name,
          pendingTransferToGroupId: null,
          transferStatus: student.transferStatus.name,
          enrolledAt: student.enrolledAt,
          assignedAt: null,
          completedAt: DateTime(2026, 5, 1),
        ),
        attendance: const AttendanceSnapshot.unavailable(),
        financial: const FinancialSnapshot.empty(),
        crm: const CrmSnapshot.empty(),
        communication: const CommunicationSnapshot.empty(),
        schedule: const ScheduleSnapshot.empty(),
        timeline: const ActivityTimeline.empty(),
        audit: const AuditSnapshot.empty(),
        generatedAt: DateTime.now(),
      );
      expect(s360.isActive, isFalse);
      expect(student.studentStatus, StudentStatus.archived);
    });
  });
}
