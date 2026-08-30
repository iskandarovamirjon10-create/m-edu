import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../application/commands/add_grade_command.dart';
import '../../application/commands/delete_grade_command.dart';
import '../../application/queries/grade_queries.dart';
import '../../domain/entities/grade.dart';
import '../../domain/repositories/grade_repository.dart';
import '../../infrastructure/datasources/isar_grade_datasource.dart';
import '../../infrastructure/repositories_impl/grade_repository_impl.dart';

/// Grade repository provider.
final gradeRepositoryProvider = Provider<GradeRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return GradeRepositoryImpl(IsarGradeDataSource(db.instance));
});

/// Grade queries provider.
final gradeQueriesProvider = Provider<GradeQueries>(
  (ref) => GradeQueries(repository: ref.watch(gradeRepositoryProvider)),
);

/// Add grade command provider (RBAC: gradesCreate).
final addGradeCommandProvider = Provider<AddGradeCommand>(
  (ref) => AddGradeCommand(
    repository: ref.watch(gradeRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Delete grade command provider (RBAC: gradesCreate).
final deleteGradeCommandProvider = Provider<DeleteGradeCommand>(
  (ref) => DeleteGradeCommand(
    repository: ref.watch(gradeRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Baholar ro'yxati versiyasi — qo'shilgan/o'chirilgandan keyin oshiriladi.
final gradeListVersionProvider = StateProvider<int>((ref) => 0);

/// Barcha baholar (sana bo'yicha kamayish tartibida).
final gradeListProvider = FutureProvider<List<Grade>>((ref) {
  ref.watch(gradeListVersionProvider);
  return ref.watch(gradeQueriesProvider).fetchAll();
});

/// O'quvchi bo'yicha baholar.
final gradesByStudentProvider =
    FutureProvider.family<List<Grade>, String>((ref, studentIdentityId) {
  ref.watch(gradeListVersionProvider);
  return ref.watch(gradeQueriesProvider).fetchByStudent(studentIdentityId);
});

/// O'quvchining fanlar bo'yicha guruhlangan baholari.
final subjectGroupsForStudentProvider =
    FutureProvider.family<List<SubjectGradeGroup>, String>((
  ref,
  studentIdentityId,
) {
  ref.watch(gradeListVersionProvider);
  return ref
      .watch(gradeQueriesProvider)
      .subjectGroupsForStudent(studentIdentityId);
});

/// O'quvchilarning o'rtacha baho reytingi.
final gradeSummariesProvider = FutureProvider<List<StudentGradeSummary>>((ref) {
  ref.watch(gradeListVersionProvider);
  return ref.watch(gradeQueriesProvider).studentSummaries();
});
