import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

import 'package:m_edu/features/homework/infrastructure/models/homework_submission_record.dart';
import 'package:m_edu/features/homework/infrastructure/repositories_impl/homework_submission_repository.dart';
import 'package:m_edu/features/homework/presentation/providers/homework_submission_providers.dart';

/// Spec SCREEN 23: talaba topshirish holati (✓ / ○ / \"Kechikib topshirdi\").
void main() {
  late _FakeHomeworkSubmissionRepository repository;
  late MarkHomeworkSubmissionCommand command;

  setUp(() {
    repository = _FakeHomeworkSubmissionRepository();
    command = MarkHomeworkSubmissionCommand(
      repository: repository,
      actorRole: UserRole.superAdmin,
    );
  });

  group('MarkHomeworkSubmissionCommand', () {
    test('muddatdan oldin topshirish — submitted + isLate=false', () async {
      final record = await command.execute(
        homeworkId: 'HW-1',
        studentId: 'M-EDU-2026-000001',
        studentName: 'Ali Valiyev',
        submitted: true,
        dueDate: DateTime.now().add(const Duration(days: 1)),
      );

      expect(record.submitted, isTrue);
      expect(record.isLate, isFalse);
      expect(record.submittedAt, isNotNull);
    });

    test('muddatdan keyin topshirish — "Kechikib topshirdi" (isLate=true)',
        () async {
      final record = await command.execute(
        homeworkId: 'HW-1',
        studentId: 'M-EDU-2026-000001',
        studentName: 'Ali Valiyev',
        submitted: true,
        dueDate: DateTime.now().subtract(const Duration(days: 1)),
      );

      expect(record.submitted, isTrue);
      expect(record.isLate, isTrue);
    });

    test('qayta ochish (○) — submitted=false, submittedAt tozalanadi', () async {
      await command.execute(
        homeworkId: 'HW-1',
        studentId: 'M-EDU-2026-000001',
        studentName: 'Ali Valiyev',
        submitted: true,
        dueDate: DateTime.now().add(const Duration(days: 1)),
      );

      final record = await command.execute(
        homeworkId: 'HW-1',
        studentId: 'M-EDU-2026-000001',
        studentName: 'Ali Valiyev',
        submitted: false,
        dueDate: DateTime.now().add(const Duration(days: 1)),
      );

      expect(record.submitted, isFalse);
      expect(record.submittedAt, isNull);
      expect(record.isLate, isFalse);
    });

    test('bir talaba uchun bitta primary yozuv (upsert)', () async {
      await command.execute(
        homeworkId: 'HW-1',
        studentId: 'M-EDU-2026-000001',
        studentName: 'Ali Valiyev',
        submitted: true,
        dueDate: DateTime.now(),
      );
      await command.execute(
        homeworkId: 'HW-1',
        studentId: 'M-EDU-2026-000001',
        studentName: 'Ali Valiyev',
        submitted: true,
        dueDate: DateTime.now(),
      );

      expect(repository.records, hasLength(1));
    });

    test('staff ruxsatsiz — FormatException (fail-closed)', () async {
      final staffCommand = MarkHomeworkSubmissionCommand(
        repository: repository,
        actorRole: UserRole.staff,
      );

      expect(
        () => staffCommand.execute(
          homeworkId: 'HW-1',
          studentId: 'M-EDU-2026-000001',
          studentName: 'Ali Valiyev',
          submitted: true,
          dueDate: DateTime.now(),
        ),
        throwsA(isA<FormatException>()),
      );
    });
  });
}

/// Xotiradagi fake — command'lar faqat shu interfeysni ishlatadi.
class _FakeHomeworkSubmissionRepository implements HomeworkSubmissionRepository {
  final List<HomeworkSubmissionRecord> records;

  _FakeHomeworkSubmissionRepository({List<HomeworkSubmissionRecord>? records})
      : records = records ?? [];

  @override
  Future<HomeworkSubmissionRecord> put(HomeworkSubmissionRecord record) async {
    final i = records.indexWhere(
      (r) =>
          r.homeworkId == record.homeworkId && r.studentId == record.studentId,
    );
    if (i < 0) {
      records.add(record);
      return record;
    }
    records[i] = record;
    return record;
  }

  @override
  Future<List<HomeworkSubmissionRecord>> fetchByHomework(
    String homeworkId,
  ) async =>
      records.where((r) => r.homeworkId == homeworkId).toList();

  @override
  Future<void> deleteByHomework(String homeworkId) async {
    records.removeWhere((r) => r.homeworkId == homeworkId);
  }
}
