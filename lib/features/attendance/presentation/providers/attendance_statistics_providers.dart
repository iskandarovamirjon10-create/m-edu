import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../features/scheduling/presentation/providers/schedule_providers.dart';
import '../../../../features/students/presentation/providers/student_providers.dart';
import '../../application/services/attendance_statistics_service.dart';
import '../providers/attendance_providers.dart';

/// AttendanceStatisticsService provider.
final attendanceStatisticsServiceProvider =
    Provider<AttendanceStatisticsService>((ref) {
  return AttendanceStatisticsService(
    attendanceRepository: ref.watch(attendanceRepositoryProvider),
    scheduleRepository: ref.watch(scheduleRepositoryProvider),
  );
});

/// Bitta student uchun derived davomat statistikasi (GRANULAR, Phase 5).
///
/// `attendanceVersionProvider`'ni watch QILMAYDI — aks holda har bir
/// davomat event'ida barcha studentlar qayta hisoblanardi (taqiqlangan).
/// Buning o'rniga [EventSyncCoordinator] `AttendanceMarkedEvent` kelganda
/// faqat shu studentning provider'ini `ref.invalidate` qiladi — targeted
/// invalidation (user talabi, §5).
///
/// Student topilmasa (masalan, teacher identity) — 0 statistika qaytadi,
/// UI'da 0% ko'rsatiladi (xato emas).
final studentAttendanceStatsProvider =
    FutureProvider.family<AttendanceStatistics, String>((ref, identityId) async {
  final student = await ref.watch(studentDetailProvider(identityId).future);
  if (student == null) {
    return const AttendanceStatistics(
      scheduledLessons: 0,
      presentLessons: 0,
      lateLessons: 0,
      excusedLessons: 0,
      absentLessons: 0,
    );
  }
  return ref.watch(attendanceStatisticsServiceProvider).fetchForStudent(student);
});

/// GURUH bo'yicha derived davomat statistikasi (P1.5).
///
/// Guruhdagi barcha studentlarning lesson-instance statistikasi
/// yig'indisi — real repository'dan hisoblanadi (hardcoded 0/1/2 yo'q).
/// `attendanceVersionProvider` watch qilinadi — davomat event'i kelganda
/// avtomatik yangilanadi (qo'lda refresh shart emas).
///
/// Guruhda student bo'lmasa — bo'sh statistika (xato emas).
final groupAttendanceStatsProvider =
    FutureProvider.family<AttendanceStatistics, String>(
        (ref, groupId) async {
  ref.watch(attendanceVersionProvider);
  ref.watch(studentListVersionProvider);
  final students =
      await ref.watch(studentsByGroupProvider(groupId).future);
  if (students.isEmpty) {
    return const AttendanceStatistics(
      scheduledLessons: 0,
      presentLessons: 0,
      lateLessons: 0,
      excusedLessons: 0,
      absentLessons: 0,
    );
  }
  final statsMap = await ref
      .watch(attendanceStatisticsServiceProvider)
      .fetchForStudents(students);

  var scheduled = 0, present = 0, late = 0, excused = 0, absent = 0;
  for (final s in statsMap.values) {
    scheduled += s.scheduledLessons;
    present += s.presentLessons;
    late += s.lateLessons;
    excused += s.excusedLessons;
    absent += s.absentLessons;
  }
  return AttendanceStatistics(
    scheduledLessons: scheduled,
    presentLessons: present,
    lateLessons: late,
    excusedLessons: excused,
    absentLessons: absent,
  );
});

/// Dashboard aggregate (spec §25): barcha studentlar uchun o'rtacha
/// davomat + taqsimot. Alohida aggregate query — har student uchun
/// alohida provider ishlatilmaydi (N+1 yo'q, §96).
///
/// `attendanceVersion` va `studentListVersion`'ni watch qiladi — davomat
/// yoki student ro'yxati o'zgarganda dashboard avtomatik yangilanadi
/// (qo'lda refresh shart emas, §25).
class AttendanceSummary {
  final double averagePercentage;
  final int excellentCount; // >= 90
  final int goodCount; // 70..89
  final int warningCount; // 50..69
  final int criticalCount; // < 50

  const AttendanceSummary({
    required this.averagePercentage,
    required this.excellentCount,
    required this.goodCount,
    required this.warningCount,
    required this.criticalCount,
  });
}

final attendanceSummaryProvider = FutureProvider<AttendanceSummary>((ref) {
  ref.watch(attendanceVersionProvider);
  ref.watch(studentListVersionProvider);
  ref.watch(scheduleListVersionProvider);

  return _buildSummary(ref);
});

Future<AttendanceSummary> _buildSummary(Ref ref) async {
  final students = await ref.watch(studentListProvider.future);
  final stats = await ref
      .watch(attendanceStatisticsServiceProvider)
      .fetchForStudents(students);

  if (stats.isEmpty) {
    return const AttendanceSummary(
      averagePercentage: 0,
      excellentCount: 0,
      goodCount: 0,
      warningCount: 0,
      criticalCount: 0,
    );
  }

  var sum = 0.0;
  var excellent = 0, good = 0, warning = 0, critical = 0;
  for (final s in stats.values) {
    final pct = s.percentage;
    sum += pct;
    if (pct >= 90) {
      excellent++;
    } else if (pct >= 70) {
      good++;
    } else if (pct >= 50) {
      warning++;
    } else {
      critical++;
    }
  }

  return AttendanceSummary(
    averagePercentage: sum / stats.length,
    excellentCount: excellent,
    goodCount: good,
    warningCount: warning,
    criticalCount: critical,
  );
}
