import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';

import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/features/grades/application/commands/add_grade_command.dart';
import 'package:m_edu/features/grades/application/commands/delete_grade_command.dart';
import 'package:m_edu/features/grades/domain/events/grade_events.dart';
import 'package:m_edu/features/grades/infrastructure/datasources/isar_grade_datasource.dart';
import 'package:m_edu/features/grades/infrastructure/models/grade_record.dart';
import 'package:m_edu/features/grades/infrastructure/repositories_impl/grade_repository_impl.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

void main() {
  late Isar isar;
  late Directory tempDir;
  late GradeRepositoryImpl repository;
  late EventBus bus;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('m_edu_grade_test');
    isar = await Isar.open([GradeRecordSchema], directory: tempDir.path);
    repository = GradeRepositoryImpl(IsarGradeDataSource(isar));
    bus = EventBus();
  });

  tearDown(() async {
    await isar.close();
    bus.dispose();
    try {
      await tempDir.delete(recursive: true);
    } catch (_) {}
  });

  AddGradeCommand command(UserRole role) => AddGradeCommand(
        repository: repository,
        eventBus: bus,
        actorRole: role,
      );

  AddGradeRequest request() => AddGradeRequest(
        studentIdentityId: 'M-EDU-2026-000001',
        studentName: 'Ali Valiyev',
        groupId: 'GRP-001',
        groupName: 'Matematika',
        subjectId: 'SUBJ-001',
        subjectName: 'Matematika',
        value: 5,
        comment: 'A\'lo',
        date: DateTime(2026, 8, 10),
      );

  test('AddGradeCommand teacher baho qo\'shadi → ALLOW + event', () async {
    final events = <GradeAddedEvent>[];
    bus.on<GradeAddedEvent>().listen(events.add);

    final grade = await command(UserRole.teacher).execute(request());
    await Future<void>.delayed(Duration.zero);

    expect(grade.gradeId, startsWith('GRD-'));
    expect(grade.studentName, 'Ali Valiyev');
    expect(grade.value, 5);
    expect(grade.subjectName, 'Matematika');
    expect(events, hasLength(1));
    expect(events.single.grade.studentIdentityId, 'M-EDU-2026-000001');

    // Repository'da saqlangan.
    final saved = await repository.fetchById(grade.gradeId);
    expect(saved, isNotNull);
    expect(saved!.value, 5);
  });

  test('AddGradeCommand ruxsatsiz rol → PermissionDeniedFailure', () {
    expect(
      () => command(UserRole.student).execute(request()),
      throwsA(isA<PermissionDeniedFailure>()),
    );
  });

  test('AddGradeCommand noto\'g\'ri baho → ValidationFailure', () {
    expect(
      () => command(UserRole.admin)
          .execute(request().copyWithValue(6)),
      throwsA(isA<ValidationFailure>()),
    );
  });

  test('AddGradeCommand bo\'sh o\'quvchi → ValidationFailure', () {
    final req = AddGradeRequest(
      studentIdentityId: '  ',
      studentName: 'X',
      subjectId: 'S1',
      subjectName: 'S',
      value: 4,
      date: DateTime(2026, 8, 10),
    );
    expect(
      () => command(UserRole.admin).execute(req),
      throwsA(isA<ValidationFailure>()),
    );
  });

  test('studentSummaries o\'rtacha/eng yaxshi/past to\'g\'ri hisoblanadi', () async {
    final cmd = command(UserRole.admin);
    await cmd.execute(request().copyWithValue(5, subjectName: 'Matematika'));
    await cmd.execute(request().copyWithValue(3, subjectName: 'Fizika'));

    final summaries = await repository.studentSummaries();
    expect(summaries, hasLength(1));
    expect(summaries.single.average, closeTo(4.0, 0.001));
    expect(summaries.single.bestGrade, 5);
    expect(summaries.single.lowestGrade, 3);
    expect(summaries.single.gradeCount, 2);
  });

  test('chegara qiymatlar: 2 va 5 qabul qilinadi, 1 va 6 rad etiladi', () async {
    final cmd = command(UserRole.admin);

    // Qabul qilinadigan chegara qiymatlar.
    final low = await cmd.execute(request().copyWithValue(2));
    final high = await cmd.execute(request().copyWithValue(5));
    expect(low.value, 2);
    expect(high.value, 5);

    // Rad etiladigan chegara qiymatlar.
    expect(
      () => cmd.execute(request().copyWithValue(1)),
      throwsA(isA<ValidationFailure>()),
    );
    expect(
      () => cmd.execute(request().copyWithValue(6)),
      throwsA(isA<ValidationFailure>()),
    );
  });

  test('bo\'sh fan → ValidationFailure', () async {
    final req = AddGradeRequest(
      studentIdentityId: 'M-EDU-2026-000001',
      studentName: 'Ali',
      subjectId: '   ',
      subjectName: 'S',
      value: 4,
      date: DateTime(2026, 8, 10),
    );
    expect(
      () => command(UserRole.admin).execute(req),
      throwsA(isA<ValidationFailure>()),
    );
  });

  test('izoh faqat bo\'sh joy bo\'lsa null saqlanadi (trim)', () async {
    final req = request().copyWithValue(4);
    final grade = await command(UserRole.admin).execute(
      AddGradeRequest(
        studentIdentityId: req.studentIdentityId,
        studentName: req.studentName,
        groupId: req.groupId,
        groupName: req.groupName,
        subjectId: req.subjectId,
        subjectName: req.subjectName,
        value: req.value,
        comment: '   ',
        date: req.date,
      ),
    );
    expect(grade.comment, isNull);
  });

  group('DeleteGradeCommand', () {
    DeleteGradeCommand deleteCommand(UserRole role) => DeleteGradeCommand(
          repository: repository,
          eventBus: bus,
          actorRole: role,
        );

    test('baho o\'chiriladi + GradeDeletedEvent yuboriladi', () async {
      final grade = await command(UserRole.admin).execute(request());
      final events = <GradeDeletedEvent>[];
      bus.on<GradeDeletedEvent>().listen(events.add);

      await deleteCommand(UserRole.admin).execute(grade.gradeId);
      await Future<void>.delayed(Duration.zero);

      expect(await repository.fetchById(grade.gradeId), isNull);
      expect(events, hasLength(1));
      expect(events.single.gradeId, grade.gradeId);
    });

    test('ruxsatsiz rol → PermissionDeniedFailure', () {
      expect(
        () => deleteCommand(UserRole.student).execute('GRD-any'),
        throwsA(isA<PermissionDeniedFailure>()),
      );
    });

    test('mavjud bo\'lmagan baho → no-op, xato tashlamaydi', () async {
      await deleteCommand(UserRole.admin).execute('GRD-NOPE');
      // Hech qanday exception, hech qanday event — muvaffaqiyatli no-op.
    });
  });
}

extension on AddGradeRequest {
  AddGradeRequest copyWithValue(int value, {String? subjectName}) {
    return AddGradeRequest(
      studentIdentityId: studentIdentityId,
      studentName: studentName,
      groupId: groupId,
      groupName: groupName,
      subjectId: subjectId,
      subjectName: subjectName ?? this.subjectName,
      value: value,
      comment: comment,
      date: date,
    );
  }
}
