import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';
import 'package:m_edu/features/teachers/application/commands/update_teacher_command.dart';
import 'package:m_edu/features/teachers/domain/entities/teacher.dart';
import 'package:m_edu/features/teachers/domain/events/teacher_events.dart';

import '../helpers/fake_repositories.dart';

/// Spec SCREEN 15: o'qituvchi profilini tahrirlash.
void main() {
  late FakeTeacherRepository repository;
  late FakeIdentityRepository identityRepository;
  late EventBus eventBus;
  late List<TeacherUpdatedEvent> published;

  setUp(() {
    repository = FakeTeacherRepository();
    identityRepository = FakeIdentityRepository();
    eventBus = EventBus();
    published = [];
    eventBus.on<TeacherUpdatedEvent>().listen((e) => published.add(e));
  });

  UpdateTeacherCommand buildCommand(UserRole role) => UpdateTeacherCommand(
        repository: repository,
        eventBus: eventBus,
        actorRole: role,
      );

  Future<void> seedTeacher() async {
    await identityRepository.save(
      Identity(
        identityId: 'M-EDU-2026-000101',
        firstName: 'Dilnoza',
        lastName: 'Karimova',
        role: IdentityRole.teacher,
        status: IdentityStatus.active,
        qrSeed: 'seed-1',
        createdAt: DateTime(2026, 1, 1),
      ),
    );
    await repository.save(
      Teacher(
        identityId: 'M-EDU-2026-000101',
        teacherNumber: 1,
        specialization: 'Matematika',
        weeklyHours: 12,
        maxWeeklyHours: 40,
        salary: 3000000,
        notes: 'Eski izoh',
        startDate: DateTime(2026, 1, 1),
      ),
    );
  }

  group('UpdateTeacherCommand', () {
    test('mutaxassislik va izoh yangilanadi, boshqa maydonlar saqlanadi',
        () async {
      await seedTeacher();

      final updated = await buildCommand(UserRole.superAdmin).execute(
        UpdateTeacherRequest(
          identityId: 'M-EDU-2026-000101',
          specialization: 'Ingliz tili',
          notes: 'Yangi izoh',
        ),
      );

      expect(updated.specialization, 'Ingliz tili');
      expect(updated.notes, 'Yangi izoh');
      expect(updated.maxWeeklyHours, 40); // berilmagan — saqlanadi
      expect(updated.salary, 3000000); // berilmagan — saqlanadi
      expect(updated.weeklyHours, 12);
      // Broadcast stream event'larni asinxron yetkazadi.
      await Future<void>.delayed(Duration.zero);
      expect(published, hasLength(1));
      expect(published.single.teacher.identityId, 'M-EDU-2026-000101');
    });

    test('maksimal soat yangilanadi', () async {
      await seedTeacher();

      final updated = await buildCommand(UserRole.admin).execute(
        UpdateTeacherRequest(
          identityId: 'M-EDU-2026-000101',
          maxWeeklyHours: 50,
        ),
      );

      expect(updated.maxWeeklyHours, 50);
      expect(updated.specialization, 'Matematika');
    });

    test("o'qituvchi topilmasa — NotFoundFailure", () async {
      expect(
        () => buildCommand(UserRole.superAdmin).execute(
          const UpdateTeacherRequest(identityId: 'M-EDU-2026-999999'),
        ),
        throwsA(isA<NotFoundFailure>()),
      );
    });

    test('teacher roli tahrirlay olmaydi — PermissionDenied (fail-closed)',
        () async {
      await seedTeacher();

      expect(
        () => buildCommand(UserRole.teacher).execute(
          const UpdateTeacherRequest(
            identityId: 'M-EDU-2026-000101',
            specialization: 'Boshqa fan',
          ),
        ),
        throwsA(isA<PermissionDeniedFailure>()),
      );
    });
  });
}
