import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/commands/delete_report_command.dart';
import '../../application/queries/monthly_report_queries.dart';
import '../../application/queries/report_queries.dart';
import '../../domain/entities/monthly_attendance_summary.dart';
import '../../domain/entities/report.dart';
import '../../domain/repositories/report_repository.dart';
import '../../../../core/di/core_providers.dart';
import '../../infrastructure/datasources/isar_report_datasource.dart';
import '../../infrastructure/repositories_impl/report_repository_impl.dart';
import '../../../attendance/presentation/providers/attendance_providers.dart';
import '../../../audit/presentation/providers/audit_providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../attendance/presentation/providers/attendance_statistics_providers.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../scheduling/presentation/providers/schedule_providers.dart';
import '../../../students/presentation/providers/student_providers.dart';
import '../../../groups/presentation/providers/group_providers.dart';
import '../../../teachers/presentation/providers/teacher_providers.dart';
import '../../../payments/presentation/providers/payment_providers.dart';

/// Report repository provider.
final reportRepositoryProvider = Provider<ReportRepository>((ref) {
  return ReportRepositoryImpl(
    studentRepository: ref.watch(studentRepositoryProvider),
    groupRepository: ref.watch(groupRepositoryProvider),
    teacherRepository: ref.watch(teacherRepositoryProvider),
    paymentRepository: ref.watch(paymentRepositoryProvider),
    // Phase 5: davomat statistikasi Attendance + Schedule'dan DERIVED.
    attendanceStatistics: ref.watch(attendanceStatisticsServiceProvider),
    // AUDIT P1-02: saqlangan hisobotlar real Isar persistence.
    reportDataSource:
        IsarReportDataSource(ref.watch(appDatabaseProvider).instance),
  );
});

/// Report queries provider.
final reportQueriesProvider = Provider<ReportQueries>(
  (ref) => ReportQueries(repository: ref.watch(reportRepositoryProvider)),
);

/// Hisobot o'chirish command'i (RBAC: reportsDelete).
///
/// AUDIT F2: ilgari `reportQueriesProvider.deleteReport` query orqali
/// RBACsiz bajarilardi — endi command orqali application layer'da
/// authorization majburiy.
final deleteReportCommandProvider = Provider<DeleteReportCommand>(
  (ref) => DeleteReportCommand(
    repository: ref.watch(reportRepositoryProvider),
    auditService: ref.watch(auditServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Talaba statistikasi.
///
/// C-03: Barcha hisobotlar o'ziga tegishli version providerlarini watch
/// qiladi — ma'lumot o'zgarganda (yangi talaba/to'lov/davomat) hisobot
/// avtomatik qayta hisoblanadi, qo'lda refresh talab qilinmaydi (§79).
final studentStatsProvider = FutureProvider<StudentStats>((ref) {
  ref.watch(studentListVersionProvider);
  ref.watch(teacherListVersionProvider);
  // Phase 5: o'rtacha davomat Attendance + Schedule'dan DERIVED —
  // davomat yoki jadval o'zgarsa dashboard avtomatik yangilanadi
  // ("profil/dashboard eski qolmasin", §25).
  ref.watch(attendanceVersionProvider);
  ref.watch(scheduleListVersionProvider);
  return ref.watch(reportQueriesProvider).getStudentStats();
});

/// Guruh statistikasi.
final groupStatsProvider = FutureProvider<GroupStats>((ref) {
  ref.watch(groupListVersionProvider);
  return ref.watch(reportQueriesProvider).getGroupStats();
});

/// Daromad hisoboti.
final revenueStatsProvider = FutureProvider<RevenueStats>((ref) {
  ref.watch(paymentListVersionProvider);
  return ref.watch(reportQueriesProvider).getRevenueStats();
});

/// Qarzdorlik hisoboti.
final debtStatsProvider = FutureProvider<DebtStats>((ref) {
  ref.watch(paymentListVersionProvider);
  return ref.watch(reportQueriesProvider).getDebtStats();
});

/// Davomat hisoboti.
final attendanceStatsProvider = FutureProvider<Map<String, dynamic>>((ref) {
  ref.watch(attendanceVersionProvider);
  ref.watch(scheduleListVersionProvider);
  ref.watch(studentListVersionProvider);
  return ref.watch(reportQueriesProvider).getAttendanceStats();
});

/// O'qituvchi yuklamasi.
final teacherWorkloadProvider = FutureProvider<Map<String, dynamic>>((ref) {
  ref.watch(teacherListVersionProvider);
  return ref.watch(reportQueriesProvider).getTeacherWorkloadStats();
});

/// Saqlangan hisobotlar.
///
/// AUDIT P1-02: saqlash/o'chirishdan keyin version oshiriladi — ro'yxat
/// avtomatik yangilanadi (EventSync pattern'i bilan bir xil usul).
final savedReportsVersionProvider = StateProvider<int>((ref) => 0);

final savedReportsProvider = FutureProvider<List<Report>>((ref) {
  ref.watch(savedReportsVersionProvider);
  return ref.watch(reportQueriesProvider).fetchSavedReports();
});

/// Oylik davomat hisoboti query'si (necha kun kelgan/kelmagan).
final monthlyReportQueriesProvider = Provider<MonthlyReportQueries>((ref) {
  return MonthlyReportQueries(
    studentRepository: ref.watch(studentRepositoryProvider),
    identityRepository: ref.watch(identityRepositoryProvider),
    attendanceRepository: ref.watch(attendanceRepositoryProvider),
  );
});

/// Berilgan oy uchun oylik davomat hisoboti.
final monthlyAttendanceReportProvider =
    FutureProvider.family<List<MonthlyAttendanceSummary>, (int, int)>((
  ref,
  yearMonth,
) {
  ref.watch(attendanceVersionProvider);
  ref.watch(studentListVersionProvider);
  return ref
      .watch(monthlyReportQueriesProvider)
      .fetchForMonth(yearMonth.$1, yearMonth.$2);
});
