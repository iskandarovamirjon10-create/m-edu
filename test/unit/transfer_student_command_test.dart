import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/groups/domain/entities/group.dart';
import 'package:m_edu/features/students/application/commands/transfer_student_command.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';
import 'package:m_edu/features/students/domain/events/student_events.dart';

import '../helpers/fake_repositories.dart';

void main() {
  group('TransferStudentCommand', () {
    test("to'lgan guruhga o'tkazish rad etiladi (sig'im tekshiruvi)", () async {
      final groups = FakeGroupRepository(groups: [
        Group(
          groupId: 'GRP-1',
          name: 'Matematika-101',
          capacity: 10,
          currentSize: 3,
        ),
        Group(
          groupId: 'GRP-2',
          name: 'Matematika-102',
          capacity: 1,
          currentSize: 1,
        ),
      ]);
      final students = FakeStudentRepository(students: [_student()]);
      final command = TransferStudentCommand(
        repository: students,
        groupRepository: groups,
        eventBus: EventBus(),
        actorRole: UserRole.superAdmin,
      );

      await expectLater(
        command.startTransfer('M-EDU-2026-000001', 'GRP-2'),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test("mavjud bo'lmagan guruhga o'tkazish rad etiladi", () async {
      final groups = FakeGroupRepository(groups: [
        Group(
          groupId: 'GRP-1',
          name: 'Matematika-101',
          capacity: 10,
          currentSize: 3,
        ),
      ]);
      final students = FakeStudentRepository(students: [_student()]);
      final command = TransferStudentCommand(
        repository: students,
        groupRepository: groups,
        eventBus: EventBus(),
        actorRole: UserRole.superAdmin,
      );

      await expectLater(
        command.startTransfer('M-EDU-2026-000001', 'GRP-999'),
        throwsA(isA<NotFoundFailure>()),
      );
    });

    test("confirmTransfer to'lgan guruhga o'tishni rad etadi (TOCTOU)",
        () async {
      final groups = FakeGroupRepository(groups: [
        Group(
          groupId: 'GRP-1',
          name: 'Matematika-101',
          capacity: 10,
          currentSize: 3,
        ),
        Group(
          groupId: 'GRP-2',
          name: 'Matematika-102',
          capacity: 2,
          currentSize: 1,
        ),
      ]);
      final students = FakeStudentRepository(students: [_student()]);
      final command = TransferStudentCommand(
        repository: students,
        groupRepository: groups,
        eventBus: EventBus(),
        actorRole: UserRole.superAdmin,
      );

      // startTransfer vaqtida joy bor (1/2).
      await command.startTransfer('M-EDU-2026-000001', 'GRP-2');

      // Ora orasida guruh to'lib qoldi (boshqa talaba qo'shildi).
      await groups.addMember('GRP-2'); // 1 → 2 (to'lgan)

      // confirmTransfer hech qanday yozuv qilmasdan rad etishi kerak.
      await expectLater(
        command.confirmTransfer('M-EDU-2026-000001'),
        throwsA(isA<ValidationFailure>()),
      );
      final student = await students.fetchByIdentityId('M-EDU-2026-000001');
      expect(student!.transferStatus, TransferStatus.pending);
    });

    test('confirmTransfer guruh o\'lchamlari va groupName ni sinxronlaydi',
        () async {
      final bus = EventBus();
      final groups = FakeGroupRepository(groups: [
        Group(
          groupId: 'GRP-1',
          name: 'Matematika-101',
          capacity: 10,
          currentSize: 3,
        ),
        Group(
          groupId: 'GRP-2',
          name: 'Matematika-102',
          capacity: 10,
          currentSize: 2,
        ),
      ]);
      final students = FakeStudentRepository(students: [_student()]);
      final command = TransferStudentCommand(
        repository: students,
        groupRepository: groups,
        eventBus: bus,
        actorRole: UserRole.superAdmin,
      );

      StudentTransferredEvent? transferred;
      bus.on<StudentTransferredEvent>().listen((e) => transferred = e);

      await command.startTransfer('M-EDU-2026-000001', 'GRP-2');
      final student = await command.confirmTransfer('M-EDU-2026-000001');

      // Talaba yangi guruhga o'tdi va groupName denormalizatsiyasi to'g'ri.
      expect(student.groupId, 'GRP-2');
      expect(student.groupName, 'Matematika-102');
      expect(student.transferStatus, TransferStatus.none);

      // Guruh o'lchamlari yaxlitligi: eski 3→2, yangi 2→3.
      expect((await groups.fetchById('GRP-1'))!.currentSize, 2);
      expect((await groups.fetchById('GRP-2'))!.currentSize, 3);

      // Event yangilangan student bilan tarqatiladi.
      expect(transferred, isNotNull);
      expect(transferred!.toGroupId, 'GRP-2');
      expect(transferred!.student.groupName, 'Matematika-102');
    });
  });
}

Student _student() {
  return Student(
    identityId: 'M-EDU-2026-000001',
    studentNumber: 1,
    groupId: 'GRP-1',
    groupName: 'Matematika-101',
    studentStatus: StudentStatus.active,
    enrolledAt: DateTime(2026, 8, 9),
  );
}
