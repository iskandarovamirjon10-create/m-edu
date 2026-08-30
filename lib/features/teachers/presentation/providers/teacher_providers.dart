import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../../features/auth/presentation/providers/auth_providers.dart';
import '../../../audit/presentation/providers/audit_providers.dart';
import '../../../face_recognition/presentation/providers/face_recognition_providers.dart';
import '../../../groups/infrastructure/datasources/isar_group_datasource.dart';
import '../../../groups/infrastructure/repositories_impl/group_repository_impl.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../application/commands/assign_teacher_to_group_command.dart';
import '../../application/commands/delete_teacher_command.dart';
import '../../application/commands/register_teacher_command.dart';
import '../../application/commands/update_teacher_command.dart';
import '../../application/queries/teacher_queries.dart';
import '../../domain/entities/teacher.dart';
import '../../domain/repositories/teacher_repository.dart';
import '../../infrastructure/datasources/isar_teacher_datasource.dart';
import '../../infrastructure/repositories_impl/teacher_repository_impl.dart';

/// Teacher repository provider.
final teacherRepositoryProvider = Provider<TeacherRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return TeacherRepositoryImpl(IsarTeacherDataSource(db.instance));
});

/// Teacher queries provider.
final teacherQueriesProvider = Provider<TeacherQueries>(
  (ref) => TeacherQueries(repository: ref.watch(teacherRepositoryProvider)),
);

/// Register teacher command provider.
final registerTeacherCommandProvider = Provider<RegisterTeacherCommand>(
  (ref) => RegisterTeacherCommand(
    repository: ref.watch(teacherRepositoryProvider),
    identityRepository: ref.watch(identityRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Update teacher command provider (profil tahriri — spec §15).
final updateTeacherCommandProvider = Provider<UpdateTeacherCommand>(
  (ref) => UpdateTeacherCommand(
    repository: ref.watch(teacherRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Delete teacher command provider (hard delete).
final deleteTeacherCommandProvider = Provider<DeleteTeacherCommand>(
  (ref) {
    final db = ref.watch(appDatabaseProvider);
    return DeleteTeacherCommand(
      teacherRepository: ref.watch(teacherRepositoryProvider),
      identityRepository: ref.watch(identityRepositoryProvider),
      groupRepository:
          GroupRepositoryImpl(IsarGroupDataSource(db.instance)),
      faceRepository: ref.watch(faceRecognitionRepositoryProvider),
      eventBus: ref.watch(eventBusProvider),
      auditService: ref.watch(auditServiceProvider),
      actorRole: ref.watch(actorRoleProvider),
    );
  },
);

/// Assign teacher to group command provider.
final assignTeacherToGroupCommandProvider =
    Provider<AssignTeacherToGroupCommand>(
  (ref) => AssignTeacherToGroupCommand(
    repository: ref.watch(teacherRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Ro'yxatlarni yangilash uchun versiya hisoblagichi.
final teacherListVersionProvider = StateProvider<int>((ref) => 0);

/// Barcha o'qituvchilar ro'yxati.
final teacherListProvider = FutureProvider<List<Teacher>>((ref) {
  ref.watch(teacherListVersionProvider);
  return ref.watch(teacherQueriesProvider).fetchAll();
});

/// Faol o'qituvchilar ro'yxati.
final activeTeachersProvider = FutureProvider<List<Teacher>>((ref) {
  ref.watch(teacherListVersionProvider);
  return ref.watch(teacherQueriesProvider).fetchActive();
});

/// O'qituvchi tafsilotlari.
final teacherDetailProvider =
    FutureProvider.family<Teacher?, String>((ref, identityId) {
  ref.watch(teacherListVersionProvider);
  return ref.watch(teacherQueriesProvider).fetchByIdentityId(identityId);
});

/// Guruhdagi o'qituvchilar ro'yxati.
final teachersByGroupProvider =
    FutureProvider.family<List<Teacher>, String>((ref, groupId) {
  ref.watch(teacherListVersionProvider);
  return ref.watch(teacherQueriesProvider).fetchByGroupId(groupId);
});

/// O'qituvchilar soni.
final teacherCountProvider = FutureProvider<int>((ref) {
  ref.watch(teacherListVersionProvider);
  return ref.watch(teacherQueriesProvider).countAll();
});

/// Faol o'qituvchilar soni.
final activeTeacherCountProvider = FutureProvider<int>((ref) {
  ref.watch(teacherListVersionProvider);
  return ref.watch(teacherQueriesProvider).countActive();
});
