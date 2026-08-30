import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';
import 'package:m_edu/features/identity/domain/events/identity_events.dart';
import 'package:m_edu/features/students/application/commands/register_student_command.dart';
import 'package:m_edu/features/students/application/services/student_enrollment_projector.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';

import '../helpers/fake_repositories.dart';
import '../helpers/test_helpers.dart';

void main() {
  group('StudentEnrollmentProjector (C-02)', () {
    test(
        "student rolidagi identity ro'yxatdan o'tganda Student yozuvi "
        'avtomatik yaratiladi', () async {
      final bus = EventBus();
      final identityRepo = FakeIdentityRepository(
        identities: [_identity(role: IdentityRole.student)],
      );
      final studentRepo = FakeStudentRepository();

      final command = RegisterStudentCommand(
        repository: studentRepo,
        identityRepository: identityRepo,
        eventBus: bus,
        actorRole: UserRole.superAdmin,
      );
      final projector = StudentEnrollmentProjector(
        registerStudentCommand: command,
        identityRepository: identityRepo,
        eventBus: bus,
      );
      addTearDown(projector.dispose);
      addTearDown(bus.dispose);

      bus.publish(IdentityRegisteredEvent(
        identity: _identity(role: IdentityRole.student),
        occurredAt: DateTime.now(),
      ));

      await waitUntil(() => studentRepo.students.isNotEmpty);
      expect(studentRepo.students, hasLength(1));
      expect(studentRepo.students.single.identityId, 'M-EDU-2026-000001');
      expect(studentRepo.students.single.studentStatus, StudentStatus.active);
      // Ro'yxatdan o'tgan sana real vaqt bilan to'ldiriladi.
      expect(studentRepo.students.single.enrolledAt, isNotNull);
    });

    test("student bo'lmagan rol (teacher) Student yaratmaydi", () async {
      final bus = EventBus();
      final identityRepo = FakeIdentityRepository(
        identities: [_identity(role: IdentityRole.teacher)],
      );
      final studentRepo = FakeStudentRepository();

      final command = RegisterStudentCommand(
        repository: studentRepo,
        identityRepository: identityRepo,
        eventBus: bus,
        actorRole: UserRole.superAdmin,
      );
      final projector = StudentEnrollmentProjector(
        registerStudentCommand: command,
        identityRepository: identityRepo,
        eventBus: bus,
      );
      addTearDown(projector.dispose);
      addTearDown(bus.dispose);

      bus.publish(IdentityRegisteredEvent(
        identity: _identity(role: IdentityRole.teacher),
        occurredAt: DateTime.now(),
      ));

      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(studentRepo.students, isEmpty);
    });

    test('bir xil identity ikki marta ro\'yxatdan o\'tsa — Student '
        'takrorlanmaydi (idempotent)', () async {
      final bus = EventBus();
      final identityRepo = FakeIdentityRepository(
        identities: [_identity(role: IdentityRole.student)],
      );
      final studentRepo = FakeStudentRepository();

      final command = RegisterStudentCommand(
        repository: studentRepo,
        identityRepository: identityRepo,
        eventBus: bus,
        actorRole: UserRole.superAdmin,
      );
      final projector = StudentEnrollmentProjector(
        registerStudentCommand: command,
        identityRepository: identityRepo,
        eventBus: bus,
      );
      addTearDown(projector.dispose);
      addTearDown(bus.dispose);

      bus.publish(IdentityRegisteredEvent(
        identity: _identity(role: IdentityRole.student),
        occurredAt: DateTime.now(),
      ));
      await waitUntil(() => studentRepo.students.isNotEmpty);

      // Takroriy event (masalan bus qayta ishga tushganda) — dublikat emas,
      // xato audit-log'ga yoziladi.
      bus.publish(IdentityRegisteredEvent(
        identity: _identity(role: IdentityRole.student),
        occurredAt: DateTime.now(),
      ));
      await Future<void>.delayed(const Duration(milliseconds: 100));

      expect(studentRepo.students, hasLength(1));
      // Xato audit-log'da ko'rinadi — yashirilmaydi (§10).
      expect(
        identityRepo.activities
            .where((a) => a.type == 'ENROLLMENT_FAILED'),
        isNotEmpty,
      );
    });
  });
}

Identity _identity({required IdentityRole role}) {
  return Identity(
    identityId: 'M-EDU-2026-000001',
    firstName: 'Ali',
    lastName: 'Valiyev',
    role: role,
    status: IdentityStatus.active,
    qrSeed: 'seed',
    createdAt: DateTime(2026, 8, 9),
  );
}
