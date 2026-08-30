import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../settings/domain/entities/app_settings.dart';
import '../../infrastructure/datasources/isar_homework_submission_datasource.dart';
import '../../infrastructure/models/homework_submission_record.dart';
import '../../infrastructure/repositories_impl/homework_submission_repository.dart';

final homeworkSubmissionRepositoryProvider =
    Provider<HomeworkSubmissionRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return HomeworkSubmissionRepository(
    IsarHomeworkSubmissionDataSource(db.instance),
  );
});

/// Topshiriq versiyasi — belgilash/o'zgarishda oshiriladi.
final homeworkSubmissionVersionProvider = StateProvider<int>((ref) => 0);

/// Vazifa bo'yicha topshiriqlar (talaba ismi bo'yicha tartiblangan).
final homeworkSubmissionsProvider =
    FutureProvider.family<List<HomeworkSubmissionRecord>, String>(
  (ref, homeworkId) {
    ref.watch(homeworkSubmissionVersionProvider);
    return ref
        .watch(homeworkSubmissionRepositoryProvider)
        .fetchByHomework(homeworkId);
  },
);

/// TALABA topshirish holatini belgilash command'i (spec §23).
///
/// - `submitted == true` — ✓ topshirdi (`submittedAt` = hozir,
///   `isLate` = topshirish vaqti muddatdan keyin).
/// - `submitted == false` — ○ topshirmagan (qayta ochish).
class MarkHomeworkSubmissionCommand {
  final HomeworkSubmissionRepository _repository;
  final UserRole _actorRole;

  MarkHomeworkSubmissionCommand({
    required HomeworkSubmissionRepository repository,
    required UserRole actorRole,
  })  : _repository = repository,
        _actorRole = actorRole;

  Future<HomeworkSubmissionRecord> execute({
    required String homeworkId,
    required String studentId,
    required String studentName,
    required bool submitted,
    required DateTime dueDate,
    String? note,
  }) async {
    if (_actorRole != UserRole.superAdmin &&
        _actorRole != UserRole.director &&
        _actorRole != UserRole.admin &&
        _actorRole != UserRole.manager &&
        _actorRole != UserRole.teacher) {
      throw const FormatException(
        "Topshirish holatini o'zgartirish uchun ruxsat yetarli emas",
      );
    }

    final now = DateTime.now();
    return _repository.put(
      HomeworkSubmissionRecord()
        ..homeworkId = homeworkId
        ..studentId = studentId
        ..studentName = studentName
        ..submitted = submitted
        ..submittedAt = submitted ? now : null
        ..isLate = submitted && now.isAfter(dueDate)
        ..note = submitted ? note : null,
    );
  }
}

final markHomeworkSubmissionCommandProvider =
    Provider<MarkHomeworkSubmissionCommand>((ref) {
  return MarkHomeworkSubmissionCommand(
    repository: ref.watch(homeworkSubmissionRepositoryProvider),
    actorRole: ref.watch(actorRoleProvider),
  );
});
