import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/security/permissions.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../../features/audit/presentation/providers/audit_providers.dart';
import '../../../attendance/presentation/providers/attendance_statistics_providers.dart';
import '../../../crm/presentation/providers/lead_providers.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../notifications/presentation/providers/notification_providers.dart';
import '../../../payments/presentation/providers/payment_providers.dart';
import '../../../scheduling/presentation/providers/schedule_providers.dart';
import '../../application/services/student_360_aggregator.dart';
import '../../domain/student_360/student_360.dart';
import 'student_providers.dart';

/// Student 360 aggregator provider.
///
/// Barcha kerakli repository'lar va service'larni birlashtirib, identityId
/// bo'yicha Student 360 aggregate qaytaradi.
///
/// INAVLIDATSIYA (F5, F6, F23 fix):
/// 1. [studentListVersionProvider] (LIST) — barcha studentlar
///    ro'yxati o'zgarganda.
/// 2. [student360VersionProvider] (PER-STUDENT DETAIL) — bitta
///    student'ga tegishli har qanday yozuv o'zgarganda.
///    UI yoki command'lar shu provider'ni ++ qilishi kerak
///    (to'lov, attendance, identity update, va h.k. so'ng).
final student360AggregatorProvider = Provider<Student360Aggregator>((ref) {
  return Student360Aggregator(
    studentRepository: ref.watch(studentRepositoryProvider),
    identityRepository: ref.watch(identityRepositoryProvider),
    attendanceStatisticsService:
        ref.watch(attendanceStatisticsServiceProvider),
    paymentRepository: ref.watch(paymentRepositoryProvider),
    leadRepository: ref.watch(leadRepositoryProvider),
    scheduleRepository: ref.watch(scheduleRepositoryProvider),
    notificationRepository: ref.watch(notificationRepositoryProvider),
    auditRepository: ref.watch(auditRepositoryProvider),
  );
});

/// Per-student invalidation version (F23).
///
/// O'qish: `ref.watch(student360VersionProvider(identityId))`
/// O'zgartirish: `ref.read(student360VersionProvider(identityId).notifier).state++`
///
/// Bu — [studentListVersionProvider] dan farqli: har bir student uchun
/// alohida hisoblagich, shuning uchun bitta student'ning o'zgarishi
/// boshqa studentlarning cache'ini invalidatsiya qilmaydi.
final student360VersionProvider =
    StateProvider.family<int, String>((ref, identityId) => 0);

/// Student 360 snapshot provider — family by identityId.
///
/// Async — [Student360Aggregator.aggregate] ni chaqiradi. Xato bo'lsa
/// (NotFoundFailure) UI tomonidan ushlanadi.
///
/// F5/F23 fix: per-student invalidation watched.
///
/// F25 fix (RBAC enforcement at provider boundary): `studentsView`
/// permission kerak. parent/student rollari — DENY. teacher — global
/// allow (group-scoped check hozircha yo'q, M-EDU single-org semantics).
/// UI hiding yetarli emas — provider o'zi authorization qiladi.
final student360Provider =
    FutureProvider.family<Student360, String>((ref, identityId) async {
  // RBAC enforcement — F25.
  // Bu provider `studentsView` permission talab qiladi. Faqat
  // tegishli rol'li foydalanuvchilar Student 360 ma'lumotini olishi mumkin.
  // (UI tugmani yashirish yetarli emas, spec §32.)
  final role = ref.watch(actorRoleProvider);
  if (!Permissions.can(role, AppPermission.studentsView)) {
    throw const PermissionDeniedFailure(
      "Student 360 ko'rish uchun ruxsat yo'q",
    );
  }

  // LIST version — barcha studentlar o'zgarganda.
  ref.watch(studentListVersionProvider);
  // DETAIL version — faqat shu student o'zgarganda.
  ref.watch(student360VersionProvider(identityId));
  final aggregator = ref.watch(student360AggregatorProvider);
  return aggregator.aggregate(identityId);
});
