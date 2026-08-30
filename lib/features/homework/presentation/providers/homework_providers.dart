import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../settings/domain/entities/app_settings.dart';
import '../../domain/entities/homework.dart';
import '../../infrastructure/datasources/isar_homework_datasource.dart';
import '../../infrastructure/repositories_impl/homework_repository_impl.dart';
import '../../infrastructure/repositories_impl/homework_submission_repository.dart';
import 'homework_submission_providers.dart';

final homeworkRepositoryProvider = Provider<HomeworkRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return HomeworkRepository(IsarHomeworkDataSource(db.instance));
});

/// Ro'yxat versiyasi — vazifa qo'shilgan/o'zgartirilganda oshiriladi.
final homeworkListVersionProvider = StateProvider<int>((ref) => 0);

/// Barcha uy vazifalari (muddat bo'yicha kamayish tartibida).
final homeworkListProvider = FutureProvider<List<Homework>>((ref) {
  ref.watch(homeworkListVersionProvider);
  return ref.watch(homeworkRepositoryProvider).fetchAll();
});

/// Bitta vazifa tafsiloti.
final homeworkDetailProvider =
    FutureProvider.family<Homework?, String>((ref, homeworkId) {
  ref.watch(homeworkListVersionProvider);
  return ref.watch(homeworkRepositoryProvider).fetchById(homeworkId);
});

/// Guruh bo'yicha uy vazifalari.
final homeworkByGroupProvider =
    FutureProvider.family<List<Homework>, String>((ref, groupId) {
  ref.watch(homeworkListVersionProvider);
  return ref.watch(homeworkRepositoryProvider).fetchByGroup(groupId);
});

/// Yangi vazifa yaratish — RBAC: homeworkCreate.
class CreateHomeworkCommand {
  final HomeworkRepository _repository;
  final UserRole _actorRole;

  CreateHomeworkCommand({
    required HomeworkRepository repository,
    required UserRole actorRole,
  })  : _repository = repository,
        _actorRole = actorRole;

  Future<Homework> execute({
    required String groupId,
    String? groupName,
    required String subjectName,
    required String title,
    required String description,
    required DateTime dueDate,
    String? createdByName,
  }) async {
    if (_actorRole != UserRole.superAdmin &&
        _actorRole != UserRole.director &&
        _actorRole != UserRole.admin &&
        _actorRole != UserRole.manager &&
        _actorRole != UserRole.teacher) {
      throw const FormatException(
        'Uy vazifasi yaratish uchun ruxsat yetarli emas',
      );
    }
    return _repository.create(
      Homework(
        homeworkId: '',
        groupId: groupId,
        groupName: groupName,
        subjectName: subjectName.trim(),
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate,
        createdByName: createdByName,
        createdAt: DateTime.now(),
      ),
    );
  }
}

final createHomeworkCommandProvider = Provider<CreateHomeworkCommand>((ref) {
  return CreateHomeworkCommand(
    repository: ref.watch(homeworkRepositoryProvider),
    actorRole: ref.watch(actorRoleProvider),
  );
});

/// Vazifani tahrirlash (spec SCREEN 24 — Create/Edit).
class UpdateHomeworkCommand {
  final HomeworkRepository _repository;
  final UserRole _actorRole;

  UpdateHomeworkCommand({
    required HomeworkRepository repository,
    required UserRole actorRole,
  })  : _repository = repository,
        _actorRole = actorRole;

  Future<Homework> execute({
    required String homeworkId,
    required String subjectName,
    required String title,
    required String description,
    required DateTime dueDate,
  }) async {
    if (_actorRole != UserRole.superAdmin &&
        _actorRole != UserRole.director &&
        _actorRole != UserRole.admin &&
        _actorRole != UserRole.manager &&
        _actorRole != UserRole.teacher) {
      throw const FormatException(
        'Uy vazifasini tahrirlash uchun ruxsat yetarli emas',
      );
    }
    final existing = await _repository.fetchById(homeworkId);
    if (existing == null) {
      throw const FormatException('Uy vazifasi topilmadi');
    }
    return _repository.update(
      existing.copyWith(
        subjectName: subjectName.trim(),
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate,
      ),
    );
  }
}

final updateHomeworkCommandProvider = Provider<UpdateHomeworkCommand>((ref) {
  return UpdateHomeworkCommand(
    repository: ref.watch(homeworkRepositoryProvider),
    actorRole: ref.watch(actorRoleProvider),
  );
});

/// Vazifani bajarilgan deb belgilash / holatini o'zgartirish.
class CompleteHomeworkCommand {
  final HomeworkRepository _repository;
  final UserRole _actorRole;

  CompleteHomeworkCommand({
    required HomeworkRepository repository,
    required UserRole actorRole,
  })  : _repository = repository,
        _actorRole = actorRole;

  Future<Homework> execute(String homeworkId, bool isCompleted) async {
    if (_actorRole != UserRole.superAdmin &&
        _actorRole != UserRole.director &&
        _actorRole != UserRole.admin &&
        _actorRole != UserRole.manager &&
        _actorRole != UserRole.teacher) {
      throw const FormatException(
        'Uy vazifasi holatini o\'zgartirish uchun ruxsat yetarli emas',
      );
    }
    final list = await _repository.fetchAll();
    Homework? existing;
    for (final h in list) {
      if (h.homeworkId == homeworkId) {
        existing = h;
        break;
      }
    }
    if (existing == null) {
      throw const FormatException('Uy vazifasi topilmadi');
    }
    return _repository.update(existing.copyWith(isCompleted: isCompleted));
  }
}

final completeHomeworkCommandProvider = Provider<CompleteHomeworkCommand>(
  (ref) => CompleteHomeworkCommand(
    repository: ref.watch(homeworkRepositoryProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Vazifani o'chirish.
class DeleteHomeworkCommand {
  final HomeworkRepository _repository;
  final HomeworkSubmissionRepository _submissionRepository;
  final UserRole _actorRole;

  DeleteHomeworkCommand({
    required HomeworkRepository repository,
    required HomeworkSubmissionRepository submissionRepository,
    required UserRole actorRole,
  })  : _repository = repository,
        _submissionRepository = submissionRepository,
        _actorRole = actorRole;

  Future<void> execute(String homeworkId) async {
    if (_actorRole != UserRole.superAdmin &&
        _actorRole != UserRole.director &&
        _actorRole != UserRole.admin &&
        _actorRole != UserRole.manager &&
        _actorRole != UserRole.teacher) {
      throw const FormatException(
        'Uy vazifasini o\'chirish uchun ruxsat yetarli emas',
      );
    }
    // Vazifa bilan birga unga tegishli barcha topshiriqlar o'chiriladi
    // (spec SCREEN 23: "Bu vazifa va unga tegishli N ta topshiriq").
    await _submissionRepository.deleteByHomework(homeworkId);
    await _repository.delete(homeworkId);
  }
}

final deleteHomeworkCommandProvider = Provider<DeleteHomeworkCommand>((ref) {
  return DeleteHomeworkCommand(
    repository: ref.watch(homeworkRepositoryProvider),
    submissionRepository: ref.watch(homeworkSubmissionRepositoryProvider),
    actorRole: ref.watch(actorRoleProvider),
  );
});
