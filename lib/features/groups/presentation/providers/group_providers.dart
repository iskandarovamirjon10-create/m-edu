import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../../features/auth/presentation/providers/auth_providers.dart';
import '../../../students/application/commands/transfer_student_command.dart';
import '../../../students/presentation/providers/student_providers.dart';
import '../../application/commands/assign_student_to_group_command.dart';
import '../../application/commands/create_group_command.dart';
import '../../application/commands/remove_student_from_group_command.dart';
import '../../application/commands/update_group_command.dart';
import '../../application/queries/group_queries.dart';
import '../../domain/entities/group.dart';
import '../../domain/repositories/group_repository.dart';
import '../../infrastructure/datasources/isar_group_datasource.dart';
import '../../infrastructure/repositories_impl/group_repository_impl.dart';

/// Group repository provider.
final groupRepositoryProvider = Provider<GroupRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return GroupRepositoryImpl(IsarGroupDataSource(db.instance));
});

/// Group queries provider.
final groupQueriesProvider = Provider<GroupQueries>(
  (ref) => GroupQueries(repository: ref.watch(groupRepositoryProvider)),
);

/// Create group command provider.
final createGroupCommandProvider = Provider<CreateGroupCommand>(
  (ref) => CreateGroupCommand(
    repository: ref.watch(groupRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Update group command provider.
final updateGroupCommandProvider = Provider<UpdateGroupCommand>(
  (ref) => UpdateGroupCommand(
    groupRepository: ref.watch(groupRepositoryProvider),
    studentRepository: ref.watch(studentRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// O'quvchini guruhga qo'shish command provider.
final assignStudentToGroupCommandProvider =
    Provider<AssignStudentToGroupCommand>(
  (ref) => AssignStudentToGroupCommand(
    groupRepository: ref.watch(groupRepositoryProvider),
    studentRepository: ref.watch(studentRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// O'quvchini guruhdan chiqarish command provider.
final removeStudentFromGroupCommandProvider =
    Provider<RemoveStudentFromGroupCommand>(
  (ref) => RemoveStudentFromGroupCommand(
    groupRepository: ref.watch(groupRepositoryProvider),
    studentRepository: ref.watch(studentRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Talabani guruhga o'tkazish command provider.
///
/// Shu yerda joylashishi sababi: o'tkazish guruhga bog'liq operatsiya va
/// `student_providers.dart` ga qo'ysak student ↔ group provider sirkulyar
/// importi yuzaga keladi (group_providers allaqachon student_providers
/// import qiladi).
final transferStudentCommandProvider = Provider<TransferStudentCommand>(
  (ref) => TransferStudentCommand(
    repository: ref.watch(studentRepositoryProvider),
    groupRepository: ref.watch(groupRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Ro'yxatlarni yangilash uchun versiya hisoblagichi.
final groupListVersionProvider = StateProvider<int>((ref) => 0);

/// Barcha guruhlar ro'yxati.
final groupListProvider = FutureProvider<List<Group>>((ref) {
  ref.watch(groupListVersionProvider);
  return ref.watch(groupQueriesProvider).fetchAll();
});

/// Faol guruhlar ro'yxati.
final activeGroupsProvider = FutureProvider<List<Group>>((ref) {
  ref.watch(groupListVersionProvider);
  return ref.watch(groupQueriesProvider).fetchActive();
});

/// Guruh tafsilotlari.
final groupDetailProvider =
    FutureProvider.family<Group?, String>((ref, groupId) {
  ref.watch(groupListVersionProvider);
  return ref.watch(groupQueriesProvider).fetchById(groupId);
});

/// Guruhlar soni.
final groupCountProvider = FutureProvider<int>((ref) {
  ref.watch(groupListVersionProvider);
  return ref.watch(groupQueriesProvider).countAll();
});

/// Faol guruhlar soni.
final activeGroupCountProvider = FutureProvider<int>((ref) {
  ref.watch(groupListVersionProvider);
  return ref.watch(groupQueriesProvider).countActive();
});
