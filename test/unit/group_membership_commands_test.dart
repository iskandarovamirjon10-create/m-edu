import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/groups/application/commands/assign_student_to_group_command.dart';
import 'package:m_edu/features/groups/application/commands/remove_student_from_group_command.dart';
import 'package:m_edu/features/groups/application/commands/update_group_command.dart';
import 'package:m_edu/features/groups/domain/entities/group.dart';
import 'package:m_edu/features/groups/domain/events/group_events.dart';
import 'package:m_edu/features/students/application/commands/update_student_status_command.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';
import 'package:m_edu/features/students/domain/events/student_events.dart';

import '../helpers/fake_repositories.dart';

void main() {
  late FakeGroupRepository groupRepo;
  late FakeStudentRepository studentRepo;
  late EventBus bus;

  final updatedEvents = <GroupUpdatedEvent>[];
  final addedEvents = <GroupMemberAddedEvent>[];
  final removedEvents = <GroupMemberRemovedEvent>[];
  final assignedEvents = <StudentAssignedToGroupEvent>[];

  setUp(() {
    groupRepo = FakeGroupRepository();
    studentRepo = FakeStudentRepository();
    bus = EventBus();
    updatedEvents.clear();
    addedEvents.clear();
    removedEvents.clear();
    assignedEvents.clear();
    bus.on<GroupUpdatedEvent>().listen(updatedEvents.add);
    bus.on<GroupMemberAddedEvent>().listen(addedEvents.add);
    bus.on<GroupMemberRemovedEvent>().listen(removedEvents.add);
    bus.on<StudentAssignedToGroupEvent>().listen(assignedEvents.add);
  });

  Future<void> pump() => Future<void>.delayed(Duration.zero);

  Group makeGroup({int capacity = 10, int currentSize = 0}) {
    return Group(
      groupId: 'GRP-1',
      name: 'Matematika-101',
      code: 'MATH-101',
      capacity: capacity,
      currentSize: currentSize,
      subject: 'Matematika',
    );
  }

  Student student({
    String id = 'M-EDU-2026-000001',
    String? groupId,
    StudentStatus status = StudentStatus.active,
  }) {
    return Student(
      identityId: id,
      studentNumber: 1,
      groupId: groupId,
      studentStatus: status,
      enrolledAt: DateTime(2026, 8, 9),
    );
  }

  group('UpdateGroupCommand', () {
    test('muvaffaqiyatli tahrirlash — guruh yangilanadi va event chiqadi',
        () async {
      groupRepo.groups.add(makeGroup());
      studentRepo.students.add(student(groupId: 'GRP-1'));

      final command = UpdateGroupCommand(
        groupRepository: groupRepo,
        studentRepository: studentRepo,
        eventBus: bus,
        actorRole: UserRole.superAdmin,
      );

      final updated = await command.execute(UpdateGroupRequest(
        groupId: 'GRP-1',
        name: 'Matematika-102',
        capacity: 20,
        monthlyFee: 300000,
        status: GroupStatus.inactive,
        daysOfWeek: const ['dushanba', 'chorshanba'],
      ));

      expect(updated.name, 'Matematika-102');
      expect(updated.capacity, 20);
      expect(updated.status, GroupStatus.inactive);
      expect(updated.currentSize, 0, reason: 'currentSize saqlanib qoladi');

      // Guruh nomi o'zgardi → a'zolarning groupName denormalizatsiyasi.
      expect(studentRepo.students.single.groupName, 'Matematika-102');

      await pump();
      expect(updatedEvents, hasLength(1));
      expect(updatedEvents.single.group.name, 'Matematika-102');
      expect(updatedEvents.single.previousGroup.name, 'Matematika-101');
    });

    test('bo\'sh nom bilan tahrirlash — ValidationFailure', () async {
      groupRepo.groups.add(makeGroup());
      final command = UpdateGroupCommand(
        groupRepository: groupRepo,
        studentRepository: studentRepo,
        eventBus: bus,
        actorRole: UserRole.superAdmin,
      );

      expect(
        () => command.execute(UpdateGroupRequest(
          groupId: 'GRP-1',
          name: '  ',
          capacity: 10,
        )),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test("mavjud bo'lmagan guruh — NotFoundFailure", () async {
      final command = UpdateGroupCommand(
        groupRepository: groupRepo,
        studentRepository: studentRepo,
        eventBus: bus,
        actorRole: UserRole.superAdmin,
      );

      expect(
        () => command.execute(UpdateGroupRequest(
          groupId: 'GRP-999',
          name: 'Yangi nom',
          capacity: 10,
        )),
        throwsA(isA<NotFoundFailure>()),
      );
    });
  });

  group('AssignStudentToGroupCommand', () {
    AssignStudentToGroupCommand build() => AssignStudentToGroupCommand(
          groupRepository: groupRepo,
          studentRepository: studentRepo,
          eventBus: bus,
          actorRole: UserRole.superAdmin,
        );

    test('muvaffaqiyatli qo\'shish — student tayinlanadi, currentSize oshadi',
        () async {
      groupRepo.groups.add(makeGroup(currentSize: 2));
      studentRepo.students.add(student());

      await build().execute(
        groupId: 'GRP-1',
        studentIdentityId: 'M-EDU-2026-000001',
      );

      final updatedStudent = studentRepo.students.single;
      expect(updatedStudent.groupId, 'GRP-1');
      expect(updatedStudent.groupName, 'Matematika-101');
      expect(updatedStudent.assignedAt, isNotNull);
      expect(groupRepo.groups.single.currentSize, 3);

      await pump();
      expect(addedEvents, hasLength(1));
      expect(addedEvents.single.studentIdentityId, 'M-EDU-2026-000001');
      expect(assignedEvents, hasLength(1));
      expect(assignedEvents.single.previousGroupId, '',
          reason: "oldingi guruh yo'q edi");
    });

    test("guruh to'lgan bo'lsa — ValidationFailure", () async {
      groupRepo.groups.add(makeGroup(capacity: 2, currentSize: 2));
      studentRepo.students.add(student());

      expect(
        () => build().execute(
          groupId: 'GRP-1',
          studentIdentityId: 'M-EDU-2026-000001',
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('allaqachon shu guruhda bo\'lsa — ValidationFailure', () async {
      groupRepo.groups.add(makeGroup());
      studentRepo.students.add(student(groupId: 'GRP-1'));

      expect(
        () => build().execute(
          groupId: 'GRP-1',
          studentIdentityId: 'M-EDU-2026-000001',
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('boshqa guruhda bo\'lsa — ValidationFailure', () async {
      groupRepo.groups.add(makeGroup());
      studentRepo.students.add(student(groupId: 'GRP-2'));

      expect(
        () => build().execute(
          groupId: 'GRP-1',
          studentIdentityId: 'M-EDU-2026-000001',
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('nofaol o\'quvchi — ValidationFailure', () async {
      groupRepo.groups.add(makeGroup());
      studentRepo.students.add(
        student(status: StudentStatus.frozen),
      );

      expect(
        () => build().execute(
          groupId: 'GRP-1',
          studentIdentityId: 'M-EDU-2026-000001',
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test("guruh topilmasa — NotFoundFailure", () async {
      studentRepo.students.add(student());

      expect(
        () => build().execute(
          groupId: 'GRP-999',
          studentIdentityId: 'M-EDU-2026-000001',
        ),
        throwsA(isA<NotFoundFailure>()),
      );
    });
  });

  group('RemoveStudentFromGroupCommand', () {
    RemoveStudentFromGroupCommand build() => RemoveStudentFromGroupCommand(
          groupRepository: groupRepo,
          studentRepository: studentRepo,
          eventBus: bus,
          actorRole: UserRole.superAdmin,
        );

    test('muvaffaqiyatli chiqarish — student guruhsiz, currentSize kamayadi',
        () async {
      groupRepo.groups.add(makeGroup(currentSize: 3));
      studentRepo.students.add(student(groupId: 'GRP-1'));

      await build().execute(
        groupId: 'GRP-1',
        studentIdentityId: 'M-EDU-2026-000001',
      );

      final updatedStudent = studentRepo.students.single;
      expect(updatedStudent.groupId, isNull);
      expect(updatedStudent.groupName, isNull);
      expect(updatedStudent.assignedAt, isNull);
      expect(groupRepo.groups.single.currentSize, 2);

      await pump();
      expect(removedEvents, hasLength(1));
      expect(removedEvents.single.studentIdentityId, 'M-EDU-2026-000001');
      expect(assignedEvents, hasLength(1));
      expect(assignedEvents.single.previousGroupId, 'GRP-1');
    });

    test("o'quvchi bu guruhda bo'lmasa — ValidationFailure", () async {
      groupRepo.groups.add(makeGroup());
      studentRepo.students.add(student()); // guruhsiz

      expect(
        () => build().execute(
          groupId: 'GRP-1',
          studentIdentityId: 'M-EDU-2026-000001',
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });
  });

  group('UpdateStudentStatusCommand — Archive/Restore siyosati', () {
    UpdateStudentStatusCommand build() => UpdateStudentStatusCommand(
          repository: studentRepo,
          eventBus: bus,
          groupRepository: groupRepo,
          actorRole: UserRole.superAdmin,
        );

    test('faol talabani arxivlash — guruhdan chiqariladi, currentSize--',
        () async {
      groupRepo.groups.add(makeGroup(currentSize: 3));
      studentRepo.students.add(student(groupId: 'GRP-1'));

      final archived = await build().execute(
        'M-EDU-2026-000001',
        StudentStatus.archived,
      );

      expect(archived.studentStatus, StudentStatus.archived);
      expect(archived.groupId, isNull,
          reason: 'Arxivlangan talaba guruhdan chiqariladi');
      expect(archived.groupName, isNull);
      expect(archived.assignedAt, isNull);
      expect(groupRepo.groups.single.currentSize, 2,
          reason: "Guruh sig'imi kamayadi");

      await pump();
      expect(removedEvents, hasLength(1),
          reason: "GroupMemberRemovedEvent tarqaladi — guruh ro'yxati yangilanadi");
    });

    test('arxivlangan talabani qayta tiklash — faol holatga qaytadi', () async {
      // Arxivda, guruhsiz talaba.
      studentRepo.students.add(
        student(status: StudentStatus.archived),
      );

      final restored = await build().execute(
        'M-EDU-2026-000001',
        StudentStatus.active,
      );

      expect(restored.studentStatus, StudentStatus.active);
    });

    test('arxiv → arxiv (takroriy) — ValidationFailure', () async {
      studentRepo.students.add(
        student(status: StudentStatus.archived),
      );

      expect(
        () => build().execute(
          'M-EDU-2026-000001',
          StudentStatus.archived,
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('guruhsiz faol talabani arxivlash — guruh o\'zgarmaydi', () async {
      studentRepo.students.add(student()); // guruhsiz

      final archived = await build().execute(
        'M-EDU-2026-000001',
        StudentStatus.archived,
      );

      expect(archived.studentStatus, StudentStatus.archived);
      expect(archived.groupId, isNull);
      await pump();
      expect(removedEvents, isEmpty,
          reason: "Guruh yo'q bo'lsa GroupMemberRemovedEvent chiqmaydi");
    });
  });
}
