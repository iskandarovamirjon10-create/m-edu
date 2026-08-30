import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/app/event_sync.dart';
import 'package:m_edu/core/di/core_providers.dart';
import 'package:m_edu/features/attendance/domain/events/attendance_events.dart';
import 'package:m_edu/features/auth/presentation/providers/auth_providers.dart';
import 'package:m_edu/features/audit/presentation/providers/audit_providers.dart';
import 'package:m_edu/features/attendance/presentation/providers/attendance_providers.dart';
import 'package:m_edu/features/groups/domain/entities/group.dart';
import 'package:m_edu/features/groups/domain/events/group_events.dart';
import 'package:m_edu/features/groups/presentation/providers/group_providers.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';
import 'package:m_edu/features/identity/domain/events/identity_events.dart';
import 'package:m_edu/features/identity/presentation/providers/identity_providers.dart';
import 'package:m_edu/features/payments/domain/entities/expense.dart';
import 'package:m_edu/features/payments/domain/entities/payment.dart';
import 'package:m_edu/features/payments/domain/events/payment_events.dart';
import 'package:m_edu/features/payments/presentation/providers/payment_providers.dart';
import 'package:m_edu/features/scheduling/domain/entities/room.dart';
import 'package:m_edu/features/scheduling/domain/entities/schedule.dart';
import 'package:m_edu/features/scheduling/domain/events/schedule_events.dart';
import 'package:m_edu/features/scheduling/presentation/providers/schedule_providers.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';
import 'package:m_edu/features/students/domain/events/student_events.dart';
import 'package:m_edu/features/students/presentation/providers/student_providers.dart';
import 'package:m_edu/features/teachers/presentation/providers/teacher_providers.dart';

import '../helpers/fake_repositories.dart';
import '../helpers/test_helpers.dart';

void main() {
  group('EventSyncCoordinator (C-03)', () {
    late ProviderContainer container;
    late FakeStudentRepository studentRepo;
    late FakeIdentityRepository identityRepo;
    late FakeTeacherRepository teacherRepo;

    setUp(() {
      studentRepo = FakeStudentRepository();
      identityRepo = FakeIdentityRepository();
      teacherRepo = FakeTeacherRepository();
      container = ProviderContainer(overrides: [
        studentRepositoryProvider.overrideWithValue(studentRepo),
        identityRepositoryProvider.overrideWithValue(identityRepo),
        teacherRepositoryProvider.overrideWithValue(teacherRepo),
        // Isar talab qilmaydigan in-memory audit repo — command'lar
        // auditServiceProvider orqali audit yozadi (test hermetic).
        auditRepositoryProvider.overrideWithValue(FakeAuditRepository()),
        // AUDIT P2-02: proyeksiyalar command'lar orqali ishlaydi — ular
        // endi actorRole talab qiladi. Test muhitida auth zanjiri
        // (authControllerProvider → WidgetsBinding) ishga tushmasligi
        // uchun aktor to'g'ridan-to'g'ri superAdmin qilib beriladi.
        actorRoleProvider.overrideWithValue(UserRole.superAdmin),
      ]);
      addTearDown(container.dispose);
      // Ko'prikni ishga tushiramiz (main.dart dagi watch o'rnini bosadi).
      container.read(eventSyncProvider);
    });

    Future<void> pump() => Future<void>.delayed(Duration.zero);

    test('IdentityRegisteredEvent → identityListVersion oshadi', () async {
      expect(container.read(identityListVersionProvider), 0);
      container.read(eventBusProvider).publish(
            IdentityRegisteredEvent(
              identity: _studentIdentity(),
              occurredAt: DateTime.now(),
            ),
          );
      await pump();
      expect(container.read(identityListVersionProvider), 1);
    });

    test('AttendanceMarkedEvent → attendanceVersion oshadi', () async {
      final before = container.read(attendanceVersionProvider);
      container.read(eventBusProvider).publish(
            AttendanceMarkedEvent(
              identityId: 'M-EDU-2026-000001',
              fullName: 'Ali Valiyev',
              method: 'manual',
              timestamp: DateTime.now(),
            ),
          );
      await pump();
      expect(container.read(attendanceVersionProvider), before + 1);
    });

    test('GroupCreatedEvent → groupListVersion oshadi', () async {
      final before = container.read(groupListVersionProvider);
      container.read(eventBusProvider).publish(
            GroupCreatedEvent(
              group: Group(
                groupId: 'GRP-1',
                name: 'Matematika-101',
                capacity: 15,
              ),
              occurredAt: DateTime.now(),
            ),
          );
      await pump();
      expect(container.read(groupListVersionProvider), before + 1);
    });

    test('GroupUpdatedEvent → group va student ro\'yxatlari yangilanadi',
        () async {
      final groupBefore = container.read(groupListVersionProvider);
      final studentBefore = container.read(studentListVersionProvider);
      container.read(eventBusProvider).publish(
            GroupUpdatedEvent(
              group: Group(
                groupId: 'GRP-1',
                name: 'Matematika-102',
                capacity: 15,
              ),
              previousGroup: Group(
                groupId: 'GRP-1',
                name: 'Matematika-101',
                capacity: 15,
              ),
              occurredAt: DateTime.now(),
            ),
          );
      await pump();
      expect(container.read(groupListVersionProvider), groupBefore + 1);
      expect(container.read(studentListVersionProvider), studentBefore + 1);
    });

    test('GroupMemberAddedEvent → group va student ro\'yxatlari yangilanadi',
        () async {
      final groupBefore = container.read(groupListVersionProvider);
      final studentBefore = container.read(studentListVersionProvider);
      container.read(eventBusProvider).publish(
            GroupMemberAddedEvent(
              group: Group(
                groupId: 'GRP-1',
                name: 'Matematika-101',
                capacity: 15,
                currentSize: 6,
              ),
              studentIdentityId: 'M-EDU-2026-000001',
              occurredAt: DateTime.now(),
            ),
          );
      await pump();
      expect(container.read(groupListVersionProvider), groupBefore + 1);
      expect(container.read(studentListVersionProvider), studentBefore + 1);
    });

    test('GroupMemberRemovedEvent → group va student ro\'yxatlari yangilanadi',
        () async {
      final groupBefore = container.read(groupListVersionProvider);
      final studentBefore = container.read(studentListVersionProvider);
      container.read(eventBusProvider).publish(
            GroupMemberRemovedEvent(
              group: Group(
                groupId: 'GRP-1',
                name: 'Matematika-101',
                capacity: 15,
                currentSize: 4,
              ),
              studentIdentityId: 'M-EDU-2026-000001',
              occurredAt: DateTime.now(),
            ),
          );
      await pump();
      expect(container.read(groupListVersionProvider), groupBefore + 1);
      expect(container.read(studentListVersionProvider), studentBefore + 1);
    });

    test('ScheduleCreatedEvent/RoomCreatedEvent → scheduleVersion oshadi',
        () async {
      final before = container.read(scheduleListVersionProvider);
      final bus = container.read(eventBusProvider);

      bus.publish(ScheduleCreatedEvent(
        schedule: Schedule(
          scheduleId: 'SCH-1',
          groupId: 'GRP-1',
          teacherId: 'M-EDU-2026-000002',
          roomId: 'ROOM-1',
          dayOfWeek: DayOfWeek.monday,
          startTime: '09:00',
          endTime: '10:30',
        ),
        occurredAt: DateTime.now(),
      ));
      await pump();
      expect(container.read(scheduleListVersionProvider), before + 1);

      bus.publish(RoomCreatedEvent(
        room: Room(roomId: 'ROOM-2', name: '101-xona', capacity: 20),
        occurredAt: DateTime.now(),
      ));
      await pump();
      expect(container.read(scheduleListVersionProvider), before + 2);
    });

    test('ExpenseCreatedEvent → paymentListVersion oshadi', () async {
      final before = container.read(paymentListVersionProvider);
      container.read(eventBusProvider).publish(
            ExpenseCreatedEvent(
              expense: Expense(
                expenseId: 'EXP-1',
                expenseType: ExpenseType.rent,
                title: 'Ijara',
                amount: 500000,
                expenseDate: DateTime(2026, 8, 9),
                billingPeriod: '2026-08',
              ),
              occurredAt: DateTime.now(),
            ),
          );
      await pump();
      expect(container.read(paymentListVersionProvider), before + 1);
    });

    // ═══════════════════════════════════════════════════════════════════
    // §102 CRITICAL FLOW — hech qanday qo'lda refresh'siz:
    // Identity → Student → List → Payment → read-model → Attendance
    // ═══════════════════════════════════════════════════════════════════
    test(
        'critical flow: student ro\'yxatga olinadi → ro\'yxatda ko\'rinadi '
        '→ to\'lov → davomat (0 qo\'lda refresh)', () async {
      final bus = container.read(eventBusProvider);

      // 1) Identity saqlanadi (RegisterIdentityCommand ishi), so'ng
      //    IdentityRegisteredEvent tarqatiladi (real oqim tartibi).
      await identityRepo.save(_studentIdentity());
      bus.publish(IdentityRegisteredEvent(
        identity: _studentIdentity(),
        occurredAt: DateTime.now(),
      ));
      await waitUntil(() => studentRepo.students.isNotEmpty);

      // 2) studentListProvider real ma'lumotni qaytaradi (event orqali).
      await container.read(studentListProvider.future);
      expect(container.read(studentListProvider).requireValue, hasLength(1));
      expect(
        container.read(studentListProvider).requireValue.single.identityId,
        'M-EDU-2026-000001',
      );

      // 3) To'lov qabul qilinadi → Student read-model yangilanadi
      //    (paymentStatus/totalPaid) va paymentListVersion oshadi.
      final payment = Payment(
        paymentId: 'PAY-20260809-00001',
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 300000,
        paymentType: PaymentType.cash,
        paymentDate: DateTime(2026, 8, 9, 12),
        status: PaymentStatus.completed,
      );
      bus.publish(PaymentReceivedEvent(
        payment: payment,
        occurredAt: payment.paymentDate,
      ));
      await waitUntil(() => studentRepo.students.single.paymentStatus);
      expect(studentRepo.students.single.totalPaid, 300000);
      expect(
        container.read(paymentListVersionProvider),
        greaterThanOrEqualTo(1),
      );

      // 4) Davomat belgilanadi → attendanceVersion oshadi (davomat sahifasi
      //    va oylik hisobot avtomatik yangilanadi).
      final attendanceVersionBefore = container.read(attendanceVersionProvider);
      bus.publish(AttendanceMarkedEvent(
        identityId: 'M-EDU-2026-000001',
        fullName: 'Ali Valiyev',
        method: 'face',
        timestamp: DateTime.now(),
      ));
      await waitUntil(
        () => container.read(attendanceVersionProvider) > attendanceVersionBefore,
      );

      // 5) Student holati o'zgarsa ham ro'yxat yangilanadi.
      final listVersionBefore = container.read(studentListVersionProvider);
      bus.publish(StudentStatusChangedEvent(
        student: studentRepo.students.single
            .copyWith(studentStatus: StudentStatus.frozen),
        previousStatus: StudentStatus.active,
        occurredAt: DateTime.now(),
      ));
      await waitUntil(
        () => container.read(studentListVersionProvider) > listVersionBefore,
      );
    });

    test("teacher ro'yxatga olinishi teacher ro'yxatini yangilaydi",
        () async {
      final bus = container.read(eventBusProvider);
      final before = container.read(teacherListVersionProvider);

      await identityRepo.save(_teacherIdentity());
      bus.publish(IdentityRegisteredEvent(
        identity: _teacherIdentity(),
        occurredAt: DateTime.now(),
      ));
      await waitUntil(() => teacherRepo.teachers.isNotEmpty);
      expect(container.read(teacherListVersionProvider), before + 1);
    });
  });
}

Identity _studentIdentity() {
  return Identity(
    identityId: 'M-EDU-2026-000001',
    firstName: 'Ali',
    lastName: 'Valiyev',
    role: IdentityRole.student,
    status: IdentityStatus.active,
    qrSeed: 'seed-1',
    createdAt: DateTime(2026, 8, 9),
  );
}

Identity _teacherIdentity() {
  return Identity(
    identityId: 'M-EDU-2026-000002',
    firstName: 'Bek',
    lastName: 'Karimov',
    role: IdentityRole.teacher,
    status: IdentityStatus.active,
    qrSeed: 'seed-2',
    createdAt: DateTime(2026, 8, 9),
  );
}
