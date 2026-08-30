import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';
import 'package:m_edu/features/identity/domain/events/identity_events.dart';
import 'package:m_edu/features/teachers/application/commands/register_teacher_command.dart';
import 'package:m_edu/features/teachers/application/services/teacher_enrollment_projector.dart';

import '../helpers/fake_repositories.dart';
import '../helpers/test_helpers.dart';

void main() {
  group('TeacherEnrollmentProjector (C-02)', () {
    test(
        "teacher rolidagi identity ro'yxatdan o'tganda Teacher yozuvi "
        'avtomatik yaratiladi', () async {
      final bus = EventBus();
      final identityRepo = FakeIdentityRepository(
        identities: [_identity(role: IdentityRole.teacher)],
      );
      final teacherRepo = FakeTeacherRepository();

      final command = RegisterTeacherCommand(
        repository: teacherRepo,
        identityRepository: identityRepo,
        eventBus: bus,
        actorRole: UserRole.superAdmin,
      );
      final projector = TeacherEnrollmentProjector(
        registerTeacherCommand: command,
        identityRepository: identityRepo,
        eventBus: bus,
      );
      addTearDown(projector.dispose);
      addTearDown(bus.dispose);

      bus.publish(IdentityRegisteredEvent(
        identity: _identity(role: IdentityRole.teacher),
        occurredAt: DateTime.now(),
      ));

      await waitUntil(() => teacherRepo.teachers.isNotEmpty);
      expect(teacherRepo.teachers, hasLength(1));
      expect(teacherRepo.teachers.single.identityId, 'M-EDU-2026-000001');
    });

    test("teacher bo'lmagan rol (student) Teacher yaratmaydi", () async {
      final bus = EventBus();
      final identityRepo = FakeIdentityRepository(
        identities: [_identity(role: IdentityRole.student)],
      );
      final teacherRepo = FakeTeacherRepository();

      final command = RegisterTeacherCommand(
        repository: teacherRepo,
        identityRepository: identityRepo,
        eventBus: bus,
        actorRole: UserRole.superAdmin,
      );
      final projector = TeacherEnrollmentProjector(
        registerTeacherCommand: command,
        identityRepository: identityRepo,
        eventBus: bus,
      );
      addTearDown(projector.dispose);
      addTearDown(bus.dispose);

      bus.publish(IdentityRegisteredEvent(
        identity: _identity(role: IdentityRole.student),
        occurredAt: DateTime.now(),
      ));

      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(teacherRepo.teachers, isEmpty);
    });
  });
}

Identity _identity({required IdentityRole role}) {
  return Identity(
    identityId: 'M-EDU-2026-000001',
    firstName: 'Bek',
    lastName: 'Karimov',
    role: role,
    status: IdentityStatus.active,
    qrSeed: 'seed',
    createdAt: DateTime(2026, 8, 9),
  );
}
