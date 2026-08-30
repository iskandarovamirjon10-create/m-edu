import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/attendance/application/services/attendance_statistics_service.dart';
import 'package:m_edu/features/attendance/domain/entities/attendance_entry.dart';
import 'package:m_edu/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:m_edu/features/audit/domain/entities/audit_log_entry.dart';
import 'package:m_edu/features/crm/domain/entities/lead.dart';
import 'package:m_edu/features/crm/domain/entities/lead_activity.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';
import 'package:m_edu/features/identity/domain/entities/identity_activity.dart';
import 'package:m_edu/features/notifications/domain/entities/notification.dart';
import 'package:m_edu/features/notifications/domain/repositories/notification_repository.dart';
import 'package:m_edu/features/scheduling/domain/entities/schedule.dart';
import 'package:m_edu/features/scheduling/domain/repositories/schedule_repository.dart';
import 'package:m_edu/features/students/application/services/student_360_aggregator.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';

import '../helpers/fake_lead_repository.dart';
import '../helpers/fake_repositories.dart';

void main() {
  group('Student 360 Aggregator — happy path', () {
    test('Aggregate with full data — no crashes', () async {
      final sRepo = FakeStudentRepository();
      final iRepo = FakeIdentityRepository();
      final aRepo = FakeAuditRepository();

      const id = 'M-EDU-2026-000001';
      await iRepo.save(Identity(
        identityId: id,
        firstName: 'Ali',
        lastName: 'Valiyev',
        role: IdentityRole.student,
        status: IdentityStatus.active,
        qrSeed: 'q-$id',
        createdAt: DateTime(2026, 1, 1),
      ));
      await sRepo.save(Student(
        identityId: id,
        studentNumber: 1,
        studentStatus: StudentStatus.active,
        enrolledAt: DateTime(2026, 1, 1),
        groupId: 'G-1',
      ));

      await aRepo.record(AuditLogEntry(
        auditId: 'a-1',
        actorUserId: 'admin',
        actorName: 'Admin',
        action: AuditAction.studentCreated,
        occurredAt: DateTime(2026, 1, 1),
        targetType: 'student',
        targetId: id,
        details: 'Test student',
      ));

      await iRepo.recordActivity(IdentityActivity(
        identityId: id,
        type: IdentityActivityTypes.registered,
        description: "Ro'yxatdan o'tdi",
        occurredAt: DateTime(2026, 1, 1),
      ));

      final aggregator = Student360Aggregator(
        studentRepository: sRepo,
        identityRepository: iRepo,
        attendanceStatisticsService: AttendanceStatisticsService(
          attendanceRepository: _NoOpAttendanceRepository(),
          scheduleRepository: _NoOpScheduleRepository(),
        ),
        paymentRepository: FakePaymentRepository(),
        leadRepository: FakeLeadRepository(),
        scheduleRepository: _NoOpScheduleRepository(),
        notificationRepository: _NoOpNotificationRepository(),
        auditRepository: aRepo,
      );
      final result = await aggregator.aggregate(id);

      expect(result.identityId, id);
      expect(result.hasGroup, isTrue);
      expect(result.hasAuditTrail, isTrue);
      expect(result.audit.count, 1);
      expect(result.timeline.hasAny, isTrue);
      expect(result.timeline.events.length, 2);
      expect(result.identity.fullName, 'Ali Valiyev');
      expect(result.academic.currentGroupId, 'G-1');
    });

    test('Aggregate with no data — empty snapshots, no crashes', () async {
      final sRepo = FakeStudentRepository();
      final iRepo = FakeIdentityRepository();
      const id = 'M-EDU-2026-000002';
      await iRepo.save(Identity(
        identityId: id,
        firstName: 'Ali',
        lastName: 'Valiyev',
        role: IdentityRole.student,
        status: IdentityStatus.active,
        qrSeed: 'q-$id',
        createdAt: DateTime(2026, 1, 1),
      ));
      await sRepo.save(Student(
        identityId: id,
        studentNumber: 1,
        studentStatus: StudentStatus.active,
        enrolledAt: DateTime(2026, 1, 1),
      ));

      final aggregator = Student360Aggregator(
        studentRepository: sRepo,
        identityRepository: iRepo,
        attendanceStatisticsService: AttendanceStatisticsService(
          attendanceRepository: _NoOpAttendanceRepository(),
          scheduleRepository: _NoOpScheduleRepository(),
        ),
        paymentRepository: FakePaymentRepository(),
        leadRepository: FakeLeadRepository(),
        scheduleRepository: _NoOpScheduleRepository(),
        notificationRepository: _NoOpNotificationRepository(),
        auditRepository: FakeAuditRepository(),
      );
      final result = await aggregator.aggregate(id);

      expect(result.identityId, id);
      expect(result.hasGroup, isFalse);
      expect(result.hasAuditTrail, isFalse);
      expect(result.timeline.events, isEmpty);
      // Attendance isAvailable true (service returns empty statistics),
      // but scheduledLessons=0 (no group = no schedule).
      expect(result.attendance.scheduledLessons, 0);
      expect(result.attendance.percentage, 0);
      expect(result.financial.hasAnyPayment, isFalse);
      expect(result.crm.hasLead, isFalse);
    });
  });

  group('Student 360 Aggregator — error cases', () {
    test('Identity not found → throws', () async {
      final aggregator = Student360Aggregator(
        studentRepository: FakeStudentRepository(),
        identityRepository: FakeIdentityRepository(),
        attendanceStatisticsService: AttendanceStatisticsService(
          attendanceRepository: _NoOpAttendanceRepository(),
          scheduleRepository: _NoOpScheduleRepository(),
        ),
        paymentRepository: FakePaymentRepository(),
        leadRepository: FakeLeadRepository(),
        scheduleRepository: _NoOpScheduleRepository(),
        notificationRepository: _NoOpNotificationRepository(),
        auditRepository: FakeAuditRepository(),
      );
      expect(
        () => aggregator.aggregate('M-EDU-2026-NONEXISTENT'),
        throwsA(isA<Exception>()),
      );
    });
  });

  group('Student 360 Aggregator — CRM connection', () {
    test('Lead converted to student → CrmSnapshot.hasLead=true', () async {
      final sRepo = FakeStudentRepository();
      final iRepo = FakeIdentityRepository();
      final leadRepo = FakeLeadRepository();
      const id = 'M-EDU-2026-000004';
      await iRepo.save(Identity(
        identityId: id,
        firstName: 'A',
        lastName: 'B',
        role: IdentityRole.student,
        status: IdentityStatus.active,
        qrSeed: 'q',
        createdAt: DateTime(2026, 1, 1),
      ));
      await sRepo.save(Student(
        identityId: id,
        studentNumber: 1,
        studentStatus: StudentStatus.active,
        enrolledAt: DateTime(2026, 1, 1),
      ));

      await leadRepo.save(Lead(
        leadId: 'LEAD-2026-000001',
        fullName: 'A B',
        source: LeadSource.instagram,
        stage: LeadStage.converted,
        convertedToIdentityId: id,
        createdAt: DateTime(2026, 1, 1),
        updatedAt: DateTime(2026, 1, 5),
      ));
      await leadRepo.recordActivity(LeadActivity(
        leadId: 'LEAD-2026-000001',
        type: LeadActivityTypes.captured,
        description: 'Captured from Instagram',
        occurredAt: DateTime(2026, 1, 1),
      ));

      final aggregator = Student360Aggregator(
        studentRepository: sRepo,
        identityRepository: iRepo,
        attendanceStatisticsService: AttendanceStatisticsService(
          attendanceRepository: _NoOpAttendanceRepository(),
          scheduleRepository: _NoOpScheduleRepository(),
        ),
        paymentRepository: FakePaymentRepository(),
        leadRepository: leadRepo,
        scheduleRepository: _NoOpScheduleRepository(),
        notificationRepository: _NoOpNotificationRepository(),
        auditRepository: FakeAuditRepository(),
      );
      final result = await aggregator.aggregate(id);

      expect(result.hasCrm, isTrue);
      expect(result.crm.source, 'instagram');
      expect(result.crm.leadActivities, hasLength(1));
    });
  });
}

// ─── Minimal stub repositories (NoOp) ───────────────────────────

class _NoOpAttendanceRepository implements AttendanceRepository {
  @override
  Future<List<AttendanceEntry>> fetchForIdentity(String id) async => [];
  @override
  noSuchMethod(Invocation i) => null;
}

class _NoOpScheduleRepository implements ScheduleRepository {
  @override
  Future<List<Schedule>> fetchByGroupId(String id) async => [];
  @override
  Future<bool> hasGroupConflict(
          {required String groupId,
          required DayOfWeek dayOfWeek,
          required String startTime,
          required String endTime,
          String? excludeScheduleId}) async =>
      false;
  @override
  Future<bool> hasTeacherConflict(
          {required String teacherId,
          required DayOfWeek dayOfWeek,
          required String startTime,
          required String endTime,
          String? excludeScheduleId}) async =>
      false;
  @override
  Future<bool> hasConflict(
          {required String roomId,
          required DayOfWeek dayOfWeek,
          required String startTime,
          required String endTime,
          String? excludeScheduleId}) async =>
      false;
  @override
  noSuchMethod(Invocation i) => null;
}

class _NoOpNotificationRepository implements NotificationRepository {
  @override
  Future<List<AppNotification>> fetchByTarget(String id) async => [];
  @override
  noSuchMethod(Invocation i) => null;
}
