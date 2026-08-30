import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../../features/auth/presentation/providers/auth_providers.dart';
import '../../../../features/attendance/presentation/providers/attendance_providers.dart';
import '../../../../features/audit/presentation/providers/audit_providers.dart';
import '../../../../features/face_recognition/presentation/providers/face_recognition_providers.dart';
import '../../../../features/payments/presentation/providers/payment_providers.dart';
import '../../../../features/students/presentation/providers/student_providers.dart';
import '../../application/commands/merge_identity_command.dart';
import '../../application/commands/register_identity_command.dart';
import '../../application/commands/update_identity_status_command.dart';
import '../../application/queries/identity_duplicates_query.dart';
import '../../application/queries/identity_queries.dart';
import '../../domain/entities/identity.dart';
import '../../domain/entities/identity_activity.dart';
import '../../domain/repositories/identity_repository.dart';
import '../../domain/services/identity_id_generator.dart';
import '../../infrastructure/datasources/isar_identity_datasource.dart';
import '../../infrastructure/datasources/isar_qr_nonce_store.dart';
import '../../infrastructure/repositories_impl/identity_repository_impl.dart';
import '../../infrastructure/sequence/identity_sequence_generator.dart';
import '../../infrastructure/services/signed_qr_service.dart';

final identityRepositoryProvider = Provider<IdentityRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return IdentityRepositoryImpl(IsarIdentityDataSource(db.instance));
});

final identityIdGeneratorProvider = Provider<IdentityIdGenerator>((ref) {
  // A2/E2: ULID asosidagi generator — qurilmaviy counter EMAS (globally
  // unique). Isar bog'liqligi yo'q (eski IdentitySequenceGenerator(Isar)
  // konstruktori counter'ga bog'liq edi).
  return IdentitySequenceGenerator();
});

/// Signed QR xizmati (Ed25519 imzolash + verify zanjiri, P1.5).
final signedQrServiceProvider = Provider<SignedQrService>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return SignedQrService(nonceStore: IsarQrNonceStore(db.instance));
});

/// Identity uchun joriy signed QR matni (Digital ID Card ko'rsatadi).
///
/// Har bir so'rovda yangi nonce + imzo — QR doim yangi va yagona.
final signedQrPayloadProvider =
    FutureProvider.family<String, String>((ref, identityId) {
  return ref.watch(signedQrServiceProvider).issue(identityId);
});

final registerIdentityCommandProvider = Provider<RegisterIdentityCommand>(
  (ref) => RegisterIdentityCommand(
    repository: ref.watch(identityRepositoryProvider),
    idGenerator: ref.watch(identityIdGeneratorProvider),
    eventBus: ref.watch(eventBusProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

final updateIdentityStatusCommandProvider =
    Provider<UpdateIdentityStatusCommand>(
  (ref) => UpdateIdentityStatusCommand(
    repository: ref.watch(identityRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

final mergeIdentityCommandProvider = Provider<MergeIdentityCommand>(
  (ref) => MergeIdentityCommand(
    repository: ref.watch(identityRepositoryProvider),
    studentRepository: ref.watch(studentRepositoryProvider),
    paymentRepository: ref.watch(paymentRepositoryProvider),
    attendanceRepository: ref.watch(attendanceRepositoryProvider),
    faceRepository: ref.watch(faceRecognitionRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    auditService: ref.watch(auditServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

final identityDuplicatesQueryProvider = Provider<IdentityDuplicatesQuery>(
  (ref) => IdentityDuplicatesQuery(
    repository: ref.watch(identityRepositoryProvider),
  ),
);

final identityQueriesProvider = Provider<IdentityQueries>(
  (ref) => IdentityQueries(repository: ref.watch(identityRepositoryProvider)),
);

/// Ro'yxatlarni yangilash uchun versiya hisoblagichi.
/// Registratsiya/holat o'zgarishidan so'ng `state++` qilinadi.
final identityListVersionProvider = StateProvider<int>((ref) => 0);

final identityListProvider = FutureProvider<List<Identity>>((ref) {
  ref.watch(identityListVersionProvider);
  return ref.watch(identityQueriesProvider).fetchAll();
});

/// Berilgan IDlar bo'yicha identitylar (Phase 16 — sahifalangan browse'da
/// faqat ko'rinadigan sahifa uchun, butun jadvalni yuklamaydi).
final identityByIdsProvider =
    FutureProvider.family<List<Identity>, List<String>>((ref, ids) {
  ref.watch(identityListVersionProvider);
  return ref.watch(identityQueriesProvider).fetchByIds(ids);
});

final studentsListProvider = FutureProvider<List<Identity>>((ref) {
  ref.watch(identityListVersionProvider);
  return ref.watch(identityQueriesProvider).fetchStudents();
});

final teachersListProvider = FutureProvider<List<Identity>>((ref) {
  ref.watch(identityListVersionProvider);
  return ref.watch(identityQueriesProvider).fetchTeachers();
});

final identityDetailProvider =
    FutureProvider.family<Identity?, String>((ref, identityId) {
  ref.watch(identityListVersionProvider);
  return ref.watch(identityQueriesProvider).fetchByIdentityId(identityId);
});

final identityActivitiesProvider =
    FutureProvider.family<List<IdentityActivity>, String>((ref, identityId) {
  ref.watch(identityListVersionProvider);
  return ref.watch(identityQueriesProvider).fetchActivities(identityId);
});

/// Identity uchun potensial dublikatlar (merge/dedup, spec §6 #5).
final identityDuplicatesProvider =
    FutureProvider.family<List<IdentityDuplicateCandidate>, String>(
        (ref, identityId) {
  ref.watch(identityListVersionProvider);
  return ref
      .watch(identityDuplicatesQueryProvider)
      .findDuplicatesFor(identityId);
});
