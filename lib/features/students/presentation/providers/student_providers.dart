import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../../features/auth/presentation/providers/auth_providers.dart';
import '../../../audit/presentation/providers/audit_providers.dart';
import '../../../face_recognition/presentation/providers/face_recognition_providers.dart';
import '../../../groups/infrastructure/datasources/isar_group_datasource.dart';
import '../../../groups/infrastructure/repositories_impl/group_repository_impl.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../application/commands/delete_student_command.dart';
import '../../application/commands/register_student_command.dart';
import '../../application/commands/update_student_command.dart';
import '../../application/commands/update_student_status_command.dart';
import '../../application/queries/student_queries.dart';
import '../../domain/entities/student.dart';
import '../../domain/repositories/student_repository.dart';
import '../../infrastructure/datasources/isar_student_datasource.dart';
import '../../infrastructure/repositories_impl/student_repository_impl.dart';

/// Student repository provider.
final studentRepositoryProvider = Provider<StudentRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return StudentRepositoryImpl(IsarStudentDataSource(db.instance));
});

/// Student queries provider.
final studentQueriesProvider = Provider<StudentQueries>(
  (ref) => StudentQueries(repository: ref.watch(studentRepositoryProvider)),
);

/// Register student command provider.
final registerStudentCommandProvider = Provider<RegisterStudentCommand>(
  (ref) => RegisterStudentCommand(
    repository: ref.watch(studentRepositoryProvider),
    identityRepository: ref.watch(identityRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    auditService: ref.watch(auditServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Delete student command provider (hard delete).
///
/// Eslatma: proyeksiya (EventSyncCoordinator) o'z tizim instansiyasini
/// `superAdmin` bilan quradi — bu provider UI amallari uchun.
final deleteStudentCommandProvider = Provider<DeleteStudentCommand>(
  (ref) {
    final db = ref.watch(appDatabaseProvider);
    return DeleteStudentCommand(
      studentRepository: ref.watch(studentRepositoryProvider),
      identityRepository: ref.watch(identityRepositoryProvider),
      groupRepository: GroupRepositoryImpl(IsarGroupDataSource(db.instance)),
      faceRepository: ref.watch(faceRecognitionRepositoryProvider),
      eventBus: ref.watch(eventBusProvider),
      auditService: ref.watch(auditServiceProvider),
      actorRole: ref.watch(actorRoleProvider),
    );
  },
);

/// Update student status command provider.
///
/// Arxivlash yaxlitligi (audit): arxivlangan talaba guruhdan ham
/// chiqariladi — `groupRepository` shu maqsadda uzatiladi (group
/// `currentSize--` va a'zolar ro'yxatidan chiqishi uchun).
final updateStudentStatusCommandProvider = Provider<UpdateStudentStatusCommand>(
  (ref) {
    final db = ref.watch(appDatabaseProvider);
    return UpdateStudentStatusCommand(
      repository: ref.watch(studentRepositoryProvider),
      eventBus: ref.watch(eventBusProvider),
      auditService: ref.watch(auditServiceProvider),
      groupRepository: GroupRepositoryImpl(IsarGroupDataSource(db.instance)),
      actorRole: ref.watch(actorRoleProvider),
    );
  },
);

/// Update student (ota-ona/izoh/akademik yil) command provider.
final updateStudentCommandProvider = Provider<UpdateStudentCommand>(
  (ref) => UpdateStudentCommand(
    repository: ref.watch(studentRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    auditService: ref.watch(auditServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

// Eslatma: `transferStudentCommandProvider` group_providers.dart da —
// o'tkazish guruhga bog'liq operatsiya va shu orqali student ↔ group
// provider sirkulyar importi oldi olinadi.

/// Ro'yxatlarni yangilash uchun versiya hisoblagichi.
final studentListVersionProvider = StateProvider<int>((ref) => 0);

/// Barcha talabalar ro'yxati.
final studentListProvider = FutureProvider<List<Student>>((ref) {
  ref.watch(studentListVersionProvider);
  return ref.watch(studentQueriesProvider).fetchAll();
});

/// Sahifalangan ro'yxat (Phase 16 — student list scale).
///
/// Bitta sahifa (offset..offset+limit) olinadi — butun jadval emas.
/// Infinite-scroll oqimida har bir sahifa alohida yuklanadi.
final studentPageProvider =
    FutureProvider.family<List<Student>, ({int offset, int limit})>(
        (ref, page) {
  ref.watch(studentListVersionProvider);
  return ref
      .watch(studentQueriesProvider)
      .fetchPage(offset: page.offset, limit: page.limit);
});

/// Faol talabalar ro'yxati.
final activeStudentsProvider = FutureProvider<List<Student>>((ref) {
  ref.watch(studentListVersionProvider);
  return ref.watch(studentQueriesProvider).fetchActive();
});

/// To'lov qilmagan talabalar ro'yxati.
final unpaidStudentsProvider = FutureProvider<List<Student>>((ref) {
  ref.watch(studentListVersionProvider);
  return ref.watch(studentQueriesProvider).fetchUnpaid();
});

/// Guruhdagi talabalar ro'yxati.
final studentsByGroupProvider =
    FutureProvider.family<List<Student>, String>((ref, groupId) {
  ref.watch(studentListVersionProvider);
  return ref.watch(studentQueriesProvider).fetchByGroupId(groupId);
});

/// Talaba tafsilotlari.
final studentDetailProvider =
    FutureProvider.family<Student?, String>((ref, identityId) {
  ref.watch(studentListVersionProvider);
  return ref.watch(studentQueriesProvider).fetchByIdentityId(identityId);
});

/// Talaba soni.
final studentCountProvider = FutureProvider<int>((ref) {
  ref.watch(studentListVersionProvider);
  return ref.watch(studentQueriesProvider).countAll();
});

/// Faol talaba soni.
final activeStudentCountProvider = FutureProvider<int>((ref) {
  ref.watch(studentListVersionProvider);
  return ref.watch(studentQueriesProvider).countActive();
});

/// To'lov qilmagan talaba soni.
final unpaidStudentCountProvider = FutureProvider<int>((ref) {
  ref.watch(studentListVersionProvider);
  return ref.watch(studentQueriesProvider).countUnpaid();
});
