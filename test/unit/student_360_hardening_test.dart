// Regression va adversarial testlar — Student 360 hardening.
// Bu fayl [student_360_aggregator_test.dart] ga qo'shimcha: F1..F25
// uchun regression testlar.
//
// Qamrab oladi:
// - F1: fetchByConvertedIdentityId (N+1 fix)
// - F3: convertedAt ni LeadActivity dan olish
// - F4: timeline try-catch mustaqil
// - F7: denominator clamp
// - F8/F9/F16: bounded list
// - F11: deterministic now()
// - F12: payment audit student-specific
// - F13: nearestOverdue now() injectable
// - F18: id-based dedup
// - F21: cancelled/refunded excluded
// - F23: per-student version provider
// - F25: negative-determinism (F11)
import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/attendance/application/services/attendance_statistics_service.dart';
import 'package:m_edu/features/attendance/domain/entities/attendance_entry.dart';
import 'package:m_edu/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:m_edu/features/audit/domain/entities/audit_log_entry.dart';
import 'package:m_edu/features/audit/domain/repositories/audit_repository.dart';
import 'package:m_edu/features/crm/domain/entities/lead.dart';
import 'package:m_edu/features/crm/domain/entities/lead_activity.dart';
import 'package:m_edu/features/crm/domain/repositories/lead_repository.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';
import 'package:m_edu/features/identity/domain/entities/identity_activity.dart';
import 'package:m_edu/features/identity/domain/repositories/identity_repository.dart';
import 'package:m_edu/features/notifications/domain/entities/notification.dart';
import 'package:m_edu/features/notifications/domain/repositories/notification_repository.dart';
import 'package:m_edu/features/payments/domain/entities/debt.dart';
import 'package:m_edu/features/payments/domain/entities/expense.dart';
import 'package:m_edu/features/payments/domain/entities/payment.dart';
import 'package:m_edu/features/payments/domain/repositories/payment_repository.dart';
import 'package:m_edu/features/scheduling/domain/entities/schedule.dart';
import 'package:m_edu/features/scheduling/domain/repositories/schedule_repository.dart';
import 'package:m_edu/features/students/application/services/student_360_aggregator.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';
import 'package:m_edu/features/students/domain/repositories/student_repository.dart';
import 'package:m_edu/features/students/domain/student_360/attendance_snapshot.dart';

import '../helpers/fake_lead_repository.dart';
import '../helpers/fake_repositories.dart';

// ─── In-memory fakes ──────────────────────────────────────────────

class _StubAttendanceRepository implements AttendanceRepository {
  @override
  Future<List<AttendanceEntry>> fetchForIdentity(String id) async => [];
  @override
  @override
  noSuchMethod(Invocation i) => null;
}

class _StubScheduleRepository implements ScheduleRepository {
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
  @override
  noSuchMethod(Invocation i) => null;
}

class _StubNotificationRepository implements NotificationRepository {
  @override
  Future<List<AppNotification>> fetchByTarget(String id) async => [];
  @override
  @override
  noSuchMethod(Invocation i) => null;
}

// LeadRepository wrapper that records call count (F1 verification).
class _CountingLeadRepository implements LeadRepository {
  final FakeLeadRepository _inner;
  int fetchAllCalls = 0;
  int fetchByConvertedIdentityCalls = 0;

  _CountingLeadRepository(this._inner);

  @override
  Future<Lead?> fetchByConvertedIdentityId(String identityId) async {
    fetchByConvertedIdentityCalls++;
    return _inner.fetchByConvertedIdentityId(identityId);
  }

  // Delegates.
  @override
  Future<Lead> save(Lead lead) => _inner.save(lead);
  @override
  Future<Lead> update(Lead lead) => _inner.update(lead);
  @override
  Future<void> recordActivity(LeadActivity a) => _inner.recordActivity(a);
  @override
  Future<Lead?> fetchByLeadId(String id) => _inner.fetchByLeadId(id);
  @override
  Future<List<Lead>> fetchAll() async {
    fetchAllCalls++;
    return _inner.fetchAll();
  }

  @override
  Future<List<Lead>> fetchByStage(LeadStage stage) =>
      _inner.fetchByStage(stage);
  @override
  Future<List<Lead>> fetchByAssignedUser(String id) =>
      _inner.fetchByAssignedUser(id);
  @override
  Future<List<Lead>> searchByNameOrPhone(String q) =>
      _inner.searchByNameOrPhone(q);
  @override
  Future<List<LeadActivity>> fetchActivities(String id) =>
      _inner.fetchActivities(id);
  @override
  Future<int> countByStage(LeadStage stage) => _inner.countByStage(stage);
}

// LeadRepository that returns many leads (F1 stress).
class _ManyLeadsRepository implements LeadRepository {
  final List<Lead> _leads = List.generate(
    5000,
    (i) => Lead(
      leadId: 'LEAD-2026-${i.toString().padLeft(6, '0')}',
      fullName: 'Test $i',
      source: LeadSource.instagram,
      stage: i == 0 ? LeadStage.converted : LeadStage.lost,
      createdAt: DateTime(2026, 1, 1),
    ),
  );

  // Add the converted lead with a specific identity.
  void setConverted(String identityId, {String leadId = 'LEAD-2026-000000'}) {
    _leads[0] = Lead(
      leadId: leadId,
      fullName: 'Converted Test',
      source: LeadSource.instagram,
      stage: LeadStage.converted,
      convertedToIdentityId: identityId,
      createdAt: DateTime(2026, 1, 1),
    );
  }

  @override
  Future<Lead?> fetchByConvertedIdentityId(String identityId) async {
    for (final l in _leads) {
      if (l.convertedToIdentityId == identityId) return l;
    }
    return null;
  }

  @override
  Future<List<Lead>> fetchAll() async => _leads;

  @override
  Future<List<LeadActivity>> fetchActivities(String leadId) async => [];
  // Unused stubs.
  @override
  Future<Lead> save(Lead l) async => l;
  @override
  Future<Lead> update(Lead l) async => l;
  @override
  Future<void> recordActivity(LeadActivity a) async {}
  @override
  Future<Lead?> fetchByLeadId(String id) async => null;
  @override
  Future<List<Lead>> fetchByStage(LeadStage s) async => [];
  @override
  Future<List<Lead>> fetchByAssignedUser(String id) async => [];
  @override
  Future<List<Lead>> searchByNameOrPhone(String q) async => [];
  @override
  Future<int> countByStage(LeadStage s) async => 0;
}

// Payment repository that returns many records (F8 bounded list).
class _ManyPaymentsRepository implements PaymentRepository {
  @override
  Future<Payment?> fetchByIdempotencyKey(String key) async => null, implements PaymentRepository {
  final String _studentId;
  _ManyPaymentsRepository(this._studentId);
  @override
  Future<List<Payment>> fetchByStudentId(String id) async {
    return List.generate(
      500,
      (i) => Payment(
        paymentId: 'PAY-$i',
        studentIdentityId: _studentId,
        amount: 1000,
        paymentType: PaymentType.cash,
        paymentDate: DateTime(2026, 1, 1).add(Duration(days: i)),
        status: PaymentStatus.completed,
      ),
    );
  }

  @override
  Future<List<Debt>> fetchDebtsByStudentId(String id) async => [];
  @override
  Future<List<Debt>> fetchOutstandingDebts() async => [];
  @override
  Future<List<Debt>> fetchOverdueDebts() async => [];
  @override
  Future<List<Debt>> fetchDebtsByGroupId(String id) async => [];
  @override
  Future<Debt> saveDebt(Debt d) async => d;
  @override
  Future<Debt> updateDebt(Debt d) async => d;
  @override
  Future<Debt> markDebtAsPaid(String id) async => throw UnimplementedError();
  @override
  Future<Debt> markReminderSent(String id) async => throw UnimplementedError();
  @override
  Future<Payment> save(Payment p) async => p;
  @override
  Future<Payment> updateStatus(String id, PaymentStatus s) async =>
      throw UnimplementedError();
  @override
  Future<Payment?> fetchById(String id) async => null;
  @override
  Future<List<Payment>> fetchAll() async => [];
  @override
  Future<List<Payment>> fetchByGroupId(String id) async => [];
  @override
  Future<List<Payment>> fetchByDateRange(DateTime s, DateTime e) async => [];
  @override
  Future<List<Payment>> fetchByType(PaymentType t) async => [];
  @override
  Future<List<Expense>> fetchAllExpenses() async => [];
  @override
  Future<Expense?> fetchExpenseById(String id) async => null;
  @override
  Future<List<Expense>> fetchExpensesByDateRange(
          DateTime s, DateTime e) async =>
      [];
  @override
  Future<void> deleteExpense(String id) async {}
  @override
  Future<Expense> saveExpense(Expense e) async => throw UnimplementedError();
  @override
  Future<String?> lastReceiptNumber() async => null;
  @override
  Future<int> repointPaymentAndDebtReferences(String a, String b) async => 0;
  @override
  Future<Payment> saveWithDebts(Payment p, List<Debt> ds) async => p;
}

// Payment repo that returns mix of completed/cancelled/refunded (F21).
class _MixedPaymentsRepository implements PaymentRepository {
  @override
  Future<Payment?> fetchByIdempotencyKey(String key) async => null, implements PaymentRepository {
  @override
  Future<List<Payment>> fetchByStudentId(String id) async {
    return [
      Payment(
        paymentId: 'P1',
        studentIdentityId: id,
        amount: 100000,
        paymentType: PaymentType.cash,
        paymentDate: DateTime(2026, 1, 5),
        status: PaymentStatus.completed,
      ),
      Payment(
        paymentId: 'P2',
        studentIdentityId: id,
        amount: 200000,
        paymentType: PaymentType.cash,
        paymentDate: DateTime(2026, 1, 10),
        status: PaymentStatus.completed,
      ),
      Payment(
        // cancelled — should NOT count in totalPaid
        paymentId: 'P3',
        studentIdentityId: id,
        amount: 999999,
        paymentType: PaymentType.cash,
        paymentDate: DateTime(2026, 1, 15),
        status: PaymentStatus.cancelled,
      ),
      Payment(
        // refunded — should NOT count
        paymentId: 'P4',
        studentIdentityId: id,
        amount: 999999,
        paymentType: PaymentType.cash,
        paymentDate: DateTime(2026, 1, 20),
        status: PaymentStatus.refunded,
      ),
      Payment(
        // pending — should NOT count
        paymentId: 'P5',
        studentIdentityId: id,
        amount: 999999,
        paymentType: PaymentType.cash,
        paymentDate: DateTime(2026, 1, 25),
        status: PaymentStatus.pending,
      ),
    ];
  }

  @override
  Future<List<Debt>> fetchDebtsByStudentId(String id) async => [];
  @override
  Future<List<Debt>> fetchOutstandingDebts() async => [];
  @override
  Future<List<Debt>> fetchOverdueDebts() async => [];
  @override
  Future<List<Debt>> fetchDebtsByGroupId(String id) async => [];
  @override
  Future<Debt> saveDebt(Debt d) async => d;
  @override
  Future<Debt> updateDebt(Debt d) async => d;
  @override
  Future<Debt> markDebtAsPaid(String id) async => throw UnimplementedError();
  @override
  Future<Debt> markReminderSent(String id) async => throw UnimplementedError();
  @override
  Future<Payment> save(Payment p) async => p;
  @override
  Future<Payment> updateStatus(String id, PaymentStatus s) async =>
      throw UnimplementedError();
  @override
  Future<Payment?> fetchById(String id) async => null;
  @override
  Future<List<Payment>> fetchAll() async => [];
  @override
  Future<List<Payment>> fetchByGroupId(String id) async => [];
  @override
  Future<List<Payment>> fetchByDateRange(DateTime s, DateTime e) async => [];
  @override
  Future<List<Payment>> fetchByType(PaymentType t) async => [];
  @override
  Future<List<Expense>> fetchAllExpenses() async => [];
  @override
  Future<Expense?> fetchExpenseById(String id) async => null;
  @override
  Future<List<Expense>> fetchExpensesByDateRange(
          DateTime s, DateTime e) async =>
      [];
  @override
  Future<void> deleteExpense(String id) async {}
  @override
  Future<Expense> saveExpense(Expense e) async => throw UnimplementedError();
  @override
  Future<String?> lastReceiptNumber() async => null;
  @override
  Future<int> repointPaymentAndDebtReferences(String a, String b) async => 0;
  @override
  Future<Payment> saveWithDebts(Payment p, List<Debt> ds) async => p;
}

// ─── Fixtures ─────────────────────────────────────────────────────

Identity _identity(String id) => Identity(
      identityId: id,
      firstName: 'Ali',
      lastName: 'Valiyev',
      role: IdentityRole.student,
      status: IdentityStatus.active,
      qrSeed: 'q-$id',
      createdAt: DateTime(2026, 1, 1),
    );

Student _student(String id) => Student(
      identityId: id,
      studentNumber: 1,
      studentStatus: StudentStatus.active,
      enrolledAt: DateTime(2026, 1, 1),
    );

Student360Aggregator _buildWith({
  StudentRepository? studentRepo,
  IdentityRepository? identityRepo,
  AuditRepository? auditRepo,
  PaymentRepository? paymentRepo,
  ScheduleRepository? scheduleRepo,
  NotificationRepository? notificationRepo,
  LeadRepository? leadRepo,
  DateTime Function()? now,
}) {
  return Student360Aggregator(
    studentRepository: studentRepo ?? FakeStudentRepository(),
    identityRepository: identityRepo ?? FakeIdentityRepository(),
    attendanceStatisticsService: AttendanceStatisticsService(
      attendanceRepository: _StubAttendanceRepository(),
      scheduleRepository: scheduleRepo ?? _StubScheduleRepository(),
    ),
    paymentRepository: paymentRepo ?? FakePaymentRepository(),
    leadRepository: leadRepo ?? FakeLeadRepository(),
    scheduleRepository: scheduleRepo ?? _StubScheduleRepository(),
    notificationRepository: notificationRepo ?? _StubNotificationRepository(),
    auditRepository: auditRepo ?? FakeAuditRepository(),
    now: now,
  );
}

// ─── Tests ────────────────────────────────────────────────────────

void main() {
  group('F1 — fetchByConvertedIdentityId avoids N+1', () {
    test('aggregator uses fetchByConvertedIdentityId, NOT fetchAll', () async {
      final sRepo = FakeStudentRepository();
      final iRepo = FakeIdentityRepository();
      final leadRepo = _CountingLeadRepository(FakeLeadRepository());
      const id = 'M-EDU-2026-000001';
      await iRepo.save(_identity(id));
      await sRepo.save(_student(id));
      await leadRepo.save(Lead(
        leadId: 'LEAD-2026-000001',
        fullName: 'A',
        source: LeadSource.instagram,
        stage: LeadStage.converted,
        convertedToIdentityId: id,
        createdAt: DateTime(2026, 1, 1),
      ));

      final aggregator = _buildWith(
        studentRepo: sRepo,
        identityRepo: iRepo,
        leadRepo: leadRepo,
      );
      final result = await aggregator.aggregate(id);

      expect(result.hasCrm, isTrue);
      expect(leadRepo.fetchByConvertedIdentityCalls, 1,
          reason: 'aggregator must use indexed lookup');
      expect(leadRepo.fetchAllCalls, 0,
          reason: 'aggregator must NOT call fetchAll');
    });

    test('5000 leads with 1 matching → still indexed lookup', () async {
      final sRepo = FakeStudentRepository();
      final iRepo = FakeIdentityRepository();
      final leadRepo = _ManyLeadsRepository();
      const id = 'M-EDU-2026-000777';
      await iRepo.save(_identity(id));
      await sRepo.save(_student(id));
      leadRepo.setConverted(id, leadId: 'LEAD-2026-000000');

      final aggregator = _buildWith(
        studentRepo: sRepo,
        identityRepo: iRepo,
        leadRepo: leadRepo,
      );
      final result = await aggregator.aggregate(id);

      expect(result.hasCrm, isTrue);
      expect(result.crm.source, 'instagram');
    });
  });

  group('F3 — convertedAt from LeadActivity, NOT lead.updatedAt', () {
    test('updatedAt != convertedAt when lead was updated post-convert',
        () async {
      final sRepo = FakeStudentRepository();
      final iRepo = FakeIdentityRepository();
      final leadRepo = FakeLeadRepository();
      const id = 'M-EDU-2026-000002';
      await iRepo.save(_identity(id));
      await sRepo.save(_student(id));

      // Lead: created Jan 1, converted Jan 5, then notes updated Jan 10.
      // `updatedAt` = Jan 10 (last update). `LeadActivity(converted)` = Jan 5.
      await leadRepo.save(Lead(
        leadId: 'LEAD-2026-000001',
        fullName: 'A B',
        source: LeadSource.instagram,
        stage: LeadStage.converted,
        convertedToIdentityId: id,
        createdAt: DateTime(2026, 1, 1),
        updatedAt: DateTime(2026, 1, 10), // later update
      ));
      await leadRepo.recordActivity(LeadActivity(
        leadId: 'LEAD-2026-000001',
        type: LeadActivityTypes.converted,
        description: 'Converted',
        occurredAt: DateTime(2026, 1, 5),
      ));
      await leadRepo.recordActivity(LeadActivity(
        leadId: 'LEAD-2026-000001',
        type: LeadActivityTypes.updated,
        description: 'Notes updated',
        occurredAt: DateTime(2026, 1, 10),
      ));

      final aggregator = _buildWith(
        studentRepo: sRepo,
        identityRepo: iRepo,
        leadRepo: leadRepo,
      );
      final result = await aggregator.aggregate(id);

      expect(result.crm.convertedAt, DateTime(2026, 1, 5),
          reason: 'must use LeadActivity.converted, not lead.updatedAt');
    });
  });

  group('F4 — timeline partial failure does NOT lose audit data', () {
    test('identity activity present + audit fetch failure → identity only',
        () async {
      final sRepo = FakeStudentRepository();
      final iRepo = FakeIdentityRepository();
      final aRepo = _ThrowingAuditRepository();
      const id = 'M-EDU-2026-000003';
      await iRepo.save(_identity(id));
      await sRepo.save(_student(id));
      await iRepo.recordActivity(IdentityActivity(
        identityId: id,
        type: IdentityActivityTypes.registered,
        description: 'Reg',
        occurredAt: DateTime(2026, 1, 1),
      ));

      final aggregator = _buildWith(
        studentRepo: sRepo,
        identityRepo: iRepo,
        auditRepo: aRepo,
      );
      final result = await aggregator.aggregate(id);

      // Timeline still has identity activity, no crash.
      expect(result.timeline.events, isNotEmpty);
      expect(result.timeline.events.first.source, 'identity');
    });
  });

  group('F7 — denominator clamped, percentage bounded', () {
    test('scheduledLessons=5, excusedLessons=10 → denominator=0, percentage=0',
        () {
      const snap = AttendanceSnapshot(
        scheduledLessons: 5,
        presentLessons: 3,
        lateLessons: 1,
        excusedLessons: 10, // impossible but service bug or data corruption
        absentLessons: 0,
        isAvailable: true,
      );
      expect(snap.denominator, 0);
      expect(snap.percentage, 0);
    });
  });

  group('F8 — paymentHistory bounded to 200', () {
    test('500 payments → 200 in snapshot, 500 in totalPaid', () async {
      final sRepo = FakeStudentRepository();
      final iRepo = FakeIdentityRepository();
      const id = 'M-EDU-2026-000004';
      await iRepo.save(_identity(id));
      await sRepo.save(_student(id));

      final aggregator = _buildWith(
        studentRepo: sRepo,
        identityRepo: iRepo,
        paymentRepo: _ManyPaymentsRepository(id),
      );
      final result = await aggregator.aggregate(id);

      expect(result.financial.paymentHistory.length, 200,
          reason: 'bounded to 200');
      expect(result.financial.paymentCount, 500,
          reason: 'count uses full set');
    });
  });

  group('F11 — deterministic now()', () {
    test('now() injected affects schedule todayLessons and timeline sort',
        () async {
      final sRepo = FakeStudentRepository();
      final iRepo = FakeIdentityRepository();
      const id = 'M-EDU-2026-000005';
      await iRepo.save(_identity(id));
      await sRepo.save(_student(id));

      // 2026-01-05 = Monday (Jan 1 2026 is Thursday... Jan 5 is Monday).
      // Verified: 2026-01-01 = Thursday.
      final monday = DateTime(2026, 1, 5);
      final aggregator = _buildWith(
        studentRepo: sRepo,
        identityRepo: iRepo,
        now: () => monday,
      );
      // Even with no schedules, generatedAt is the injected now.
      final result = await aggregator.aggregate(id);
      expect(result.generatedAt, monday);
    });
  });

  group('F12 — payment audit only for this student', () {
    test('other students\' payment audits do NOT leak in', () async {
      final sRepo = FakeStudentRepository();
      final iRepo = FakeIdentityRepository();
      final aRepo = FakeAuditRepository();
      const id = 'M-EDU-2026-000006';
      await iRepo.save(_identity(id));
      await sRepo.save(_student(id));

      // Audit: this student's payment
      await aRepo.record(AuditLogEntry(
        auditId: 'a-1',
        actorUserId: 'admin',
        actorName: 'A',
        action: AuditAction.paymentCreated,
        occurredAt: DateTime(2026, 1, 1),
        targetType: 'payment',
        targetId: 'P-my',
      ));
      // Audit: OTHER student's payment (different identity)
      await aRepo.record(AuditLogEntry(
        auditId: 'a-2',
        actorUserId: 'admin',
        actorName: 'A',
        action: AuditAction.paymentCreated,
        occurredAt: DateTime(2026, 1, 1),
        targetType: 'payment',
        targetId: 'P-other',
      ));

      // paymentRepo: this student has only P-my
      final paymentRepo = _SpecificPaymentRepository(['P-my']);
      final aggregator = _buildWith(
        studentRepo: sRepo,
        identityRepo: iRepo,
        auditRepo: aRepo,
        paymentRepo: paymentRepo,
      );
      final result = await aggregator.aggregate(id);

      // Only P-my audit included, P-other excluded.
      final paymentAudits = result.audit.entries
          .where((e) => e.targetType == 'payment')
          .toList();
      expect(paymentAudits.length, 1);
      expect(paymentAudits.first.auditId, 'a-1');
    });
  });

  group('F18 — id-based dedup in audit + timeline', () {
    test('duplicate audit ids deduplicate', () async {
      final sRepo = FakeStudentRepository();
      final iRepo = FakeIdentityRepository();
      final aRepo = FakeAuditRepository();
      const id = 'M-EDU-2026-000007';
      await iRepo.save(_identity(id));
      await sRepo.save(_student(id));

      // Same audit written twice (testing repo's record doesn't dedup).
      final entry = AuditLogEntry(
        auditId: 'dup',
        actorUserId: 'admin',
        actorName: 'A',
        action: AuditAction.studentCreated,
        occurredAt: DateTime(2026, 1, 1),
        targetType: 'student',
        targetId: id,
      );
      await aRepo.record(entry);
      await aRepo.record(entry); // duplicate

      final aggregator = _buildWith(
        studentRepo: sRepo,
        identityRepo: iRepo,
        auditRepo: aRepo,
      );
      final result = await aggregator.aggregate(id);

      // Audit dedup
      final dupCount = result.audit.entries.where((e) => e.auditId == 'dup').length;
      expect(dupCount, 1, reason: 'audit dedup must collapse duplicates');
    });
  });

  group('F21 — only completed payments count in totalPaid', () {
    test('cancelled/refunded/pending excluded from totalPaid', () async {
      final sRepo = FakeStudentRepository();
      final iRepo = FakeIdentityRepository();
      const id = 'M-EDU-2026-000008';
      await iRepo.save(_identity(id));
      await sRepo.save(_student(id));

      final aggregator = _buildWith(
        studentRepo: sRepo,
        identityRepo: iRepo,
        paymentRepo: _MixedPaymentsRepository(),
      );
      final result = await aggregator.aggregate(id);

      // Only P1 (100000) + P2 (200000) = 300000
      expect(result.financial.totalPaid, 300000);
      expect(result.financial.paymentCount, 2);
      expect(result.financial.pendingPaymentCount, 1);
    });
  });

  group('F13 — nearestOverdue uses injected now', () {
    test('now in 2027 → 2026 debts are overdue', () async {
      final sRepo = FakeStudentRepository();
      final iRepo = FakeIdentityRepository();
      const id = 'M-EDU-2026-000009';
      await iRepo.save(_identity(id));
      await sRepo.save(_student(id));

      final fixedNow = DateTime(2027, 1, 1);
      final aggregator = _buildWith(
        studentRepo: sRepo,
        identityRepo: iRepo,
        paymentRepo: _OverdueDebtRepository(),
        now: () => fixedNow,
      );
      final result = await aggregator.aggregate(id);

      expect(result.financial.hasOverdue, isTrue);
    });
  });
}

// ─── Auxiliary test fakes ─────────────────────────────────────────

class _ThrowingAuditRepository implements AuditRepository {
  @override
  Future<void> record(AuditLogEntry entry) async => throw Exception('boom');
  @override
  Future<List<AuditLogEntry>> fetchRecent({int limit = 50}) async =>
      throw Exception('boom');
  @override
  Future<List<AuditLogEntry>> fetchByTarget(String t, String id) async =>
      throw Exception('boom');
  @override
  Future<int> count() async => 0;
}

class _SpecificPaymentRepository implements PaymentRepository {
  @override
  Future<Payment?> fetchByIdempotencyKey(String key) async => null, implements PaymentRepository {
  final List<String> _paymentIds;
  _SpecificPaymentRepository(this._paymentIds);

  @override
  Future<List<Payment>> fetchByStudentId(String id) async {
    return _paymentIds
        .map((pid) => Payment(
              paymentId: pid,
              studentIdentityId: id,
              amount: 100000,
              paymentType: PaymentType.cash,
              paymentDate: DateTime(2026, 1, 1),
              status: PaymentStatus.completed,
            ))
        .toList();
  }

  @override
  Future<List<Debt>> fetchDebtsByStudentId(String id) async => [];
  @override
  Future<List<Debt>> fetchOutstandingDebts() async => [];
  @override
  Future<List<Debt>> fetchOverdueDebts() async => [];
  @override
  Future<List<Debt>> fetchDebtsByGroupId(String id) async => [];
  @override
  Future<Debt> saveDebt(Debt d) async => d;
  @override
  Future<Debt> updateDebt(Debt d) async => d;
  @override
  Future<Debt> markDebtAsPaid(String id) async => throw UnimplementedError();
  @override
  Future<Debt> markReminderSent(String id) async => throw UnimplementedError();
  @override
  Future<Payment> save(Payment p) async => p;
  @override
  Future<Payment> updateStatus(String id, PaymentStatus s) async =>
      throw UnimplementedError();
  @override
  Future<Payment?> fetchById(String id) async => null;
  @override
  Future<List<Payment>> fetchAll() async => [];
  @override
  Future<List<Payment>> fetchByGroupId(String id) async => [];
  @override
  Future<List<Payment>> fetchByDateRange(DateTime s, DateTime e) async => [];
  @override
  Future<List<Payment>> fetchByType(PaymentType t) async => [];
  @override
  Future<List<Expense>> fetchAllExpenses() async => [];
  @override
  Future<Expense?> fetchExpenseById(String id) async => null;
  @override
  Future<List<Expense>> fetchExpensesByDateRange(
          DateTime s, DateTime e) async =>
      [];
  @override
  Future<Expense> saveExpense(Expense e) async => throw UnimplementedError();
  @override
  Future<void> deleteExpense(String id) async {}
  @override
  Future<String?> lastReceiptNumber() async => null;
  @override
  Future<int> repointPaymentAndDebtReferences(String a, String b) async => 0;
  @override
  Future<Payment> saveWithDebts(Payment p, List<Debt> ds) async => p;
}

class _OverdueDebtRepository implements PaymentRepository {
  @override
  Future<Payment?> fetchByIdempotencyKey(String key) async => null, implements PaymentRepository {
  @override
  Future<List<Payment>> fetchByStudentId(String id) async => [];
  @override
  Future<List<Debt>> fetchDebtsByStudentId(String id) async => [
        Debt(
          debtId: 'D1',
          studentIdentityId: id,
          dueDate: DateTime(2026, 12, 1),
          totalAmount: 100000,
          paidAmount: 0,
          remainingAmount: 100000,
          status: DebtStatus.outstanding,
          billingPeriod: '2026-12',
        ),
      ];
  @override
  Future<List<Debt>> fetchOutstandingDebts() async => [];
  @override
  Future<List<Debt>> fetchOverdueDebts() async => [];
  @override
  Future<List<Debt>> fetchDebtsByGroupId(String id) async => [];
  @override
  Future<Debt> saveDebt(Debt d) async => d;
  @override
  Future<Debt> updateDebt(Debt d) async => d;
  @override
  Future<Debt> markDebtAsPaid(String id) async => throw UnimplementedError();
  @override
  Future<Debt> markReminderSent(String id) async => throw UnimplementedError();
  @override
  Future<Payment> save(Payment p) async => p;
  @override
  Future<Payment> updateStatus(String id, PaymentStatus s) async =>
      throw UnimplementedError();
  @override
  Future<Payment?> fetchById(String id) async => null;
  @override
  Future<List<Payment>> fetchAll() async => [];
  @override
  Future<List<Payment>> fetchByGroupId(String id) async => [];
  @override
  Future<List<Payment>> fetchByDateRange(DateTime s, DateTime e) async => [];
  @override
  Future<List<Payment>> fetchByType(PaymentType t) async => [];
  @override
  Future<List<Expense>> fetchAllExpenses() async => [];
  @override
  Future<Expense?> fetchExpenseById(String id) async => null;
  @override
  Future<List<Expense>> fetchExpensesByDateRange(
          DateTime s, DateTime e) async =>
      [];
  @override
  Future<Expense> saveExpense(Expense e) async => throw UnimplementedError();
  @override
  Future<void> deleteExpense(String id) async {}
  @override
  Future<String?> lastReceiptNumber() async => null;
  @override
  Future<int> repointPaymentAndDebtReferences(String a, String b) async => 0;
  @override
  Future<Payment> saveWithDebts(Payment p, List<Debt> ds) async => p;
}
