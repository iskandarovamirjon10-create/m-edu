import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../attendance/presentation/providers/attendance_providers.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../payments/presentation/providers/payment_providers.dart';
import '../../../students/presentation/providers/student_providers.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// DASHBOARD HERO STATISTIKA — "No Demo Data" siyosati (spec §5).
///
/// Barcha ko'rsatkichlar real bazadan hisoblanadi. Sparklinelar ham
/// real temporal ma'lumotdan hosil qilinadi (soxta seriya kiritilmaydi):
/// - Talabalar → enrolledAt bo'yicha oylik ro'yxatga olishlar (6 oy)
/// - Davomat → oxirgi 7 kunlik belgilashlar soni
/// - Daromad → oxirgi 6 oylik kirim (MonthlyFinance)
/// - Qarzdorlar → qarzlarning dueDate bo'yicha oylik taqsimoti (6 oy)
/// ═══════════════════════════════════════════════════════════════════════
class DashboardHeroStats {
  final int activeStudents;
  final int totalStudents;
  final double attendancePercent;
  final int monthlyRevenue;
  final int debtorCount;

  /// 6 oylik ro'yxatga olingan talabalar.
  final List<double> studentsTrend;

  /// 7 kunlik davomat belgilashlar.
  final List<double> attendanceTrend;

  /// 6 oylik kirim (so'm).
  final List<double> revenueTrend;

  /// 6 oylik qarzdorlik taqsimoti.
  final List<double> debtTrend;

  /// O'tgan oyga nisbatan daromad o'zgarishi (%).
  final double revenueChangePercent;

  const DashboardHeroStats({
    required this.activeStudents,
    required this.totalStudents,
    required this.attendancePercent,
    required this.monthlyRevenue,
    required this.debtorCount,
    required this.studentsTrend,
    required this.attendanceTrend,
    required this.revenueTrend,
    required this.debtTrend,
    required this.revenueChangePercent,
  });
}

final dashboardHeroStatsProvider = FutureProvider<DashboardHeroStats>((ref) {
  // Version providerlar — ma'lumot o'zgarganda avtomatik qayta hisoblash.
  ref.watch(studentListVersionProvider);
  ref.watch(attendanceVersionProvider);
  ref.watch(paymentListVersionProvider);
  ref.watch(identityListVersionProvider);

  return _computeStats(ref);
});

Future<DashboardHeroStats> _computeStats(Ref ref) async {
  final now = DateTime.now();

  // ─── Talabalar ────────────────────────────────────────────────────────
  final students = await ref.watch(studentListProvider.future);
  final activeStudents = students.where((s) => s.isActive).length;

  // 6 oylik ro'yxatga olishlar trendi.
  final studentsTrend = _monthlySeries(now, 6, (monthStart, monthEnd) =>
      students
          .where((s) =>
              !s.enrolledAt.isBefore(monthStart) &&
              s.enrolledAt.isBefore(monthEnd))
          .length
          .toDouble());

  // ─── Davomat ──────────────────────────────────────────────────────────
  final todayStats = await ref.watch(todayAttendanceStatsProvider.future);
  final attendancePercent = students.isEmpty
      ? 0.0
      : ((todayStats.total / students.length * 100).clamp(0.0, 100.0)).toDouble();

  // Oxirgi 7 kunlik belgilashlar.
  final weekStart = DateTime(now.year, now.month, now.day - 6);
  final entries = await ref
      .watch(attendanceQueriesProvider)
      .fetchBetween(weekStart, now.add(const Duration(days: 1)));
  final attendanceTrend = _dailySeries(now, 7, (dayStart, dayEnd) => entries
      .where((e) =>
          !e.timestamp.isBefore(dayStart) && e.timestamp.isBefore(dayEnd))
      .length
      .toDouble());

  // ─── Daromad ──────────────────────────────────────────────────────────
  final monthlyRevenue = await ref.watch(monthlyCollectedProvider.future);
  final finance = await ref.watch(monthlyFinanceStatsProvider.future);
  final revenueTrend = finance.map((f) => f.income.toDouble()).toList();

  final revenueChangePercent = _percentChange(
    finance.length >= 2 ? finance[finance.length - 2].income : 0,
    finance.isEmpty ? 0 : finance.last.income,
  );

  // ─── Qarzdorlar ───────────────────────────────────────────────────────
  final debtorCount = await ref.watch(debtorCountProvider.future);
  final debts = await ref.watch(outstandingDebtsProvider.future);

  // Qarzlar dueDate bo'yicha oylik taqsimoti.
  final debtTrend = _monthlySeries(now, 6, (monthStart, monthEnd) => debts
      .where((d) =>
          !d.dueDate.isBefore(monthStart) && d.dueDate.isBefore(monthEnd))
      .length
      .toDouble());

  return DashboardHeroStats(
    activeStudents: activeStudents,
    totalStudents: students.length,
    attendancePercent: attendancePercent,
    monthlyRevenue: monthlyRevenue,
    debtorCount: debtorCount,
    studentsTrend: studentsTrend,
    attendanceTrend: attendanceTrend,
    revenueTrend: revenueTrend,
    debtTrend: debtTrend,
    revenueChangePercent: revenueChangePercent,
  );
}

/// Oxirgi [count] oy uchun qiymatlar (eski → yangi).
List<double> _monthlySeries(
  DateTime now,
  int count,
  double Function(DateTime start, DateTime end) valueFor,
) {
  final result = <double>[];
  for (var i = count - 1; i >= 0; i--) {
    final start = DateTime(now.year, now.month - i, 1);
    final end = DateTime(start.year, start.month + 1, 1);
    result.add(valueFor(start, end));
  }
  return result;
}

/// Oxirgi [count] kun uchun qiymatlar (eski → yangi).
List<double> _dailySeries(
  DateTime now,
  int count,
  double Function(DateTime start, DateTime end) valueFor,
) {
  final result = <double>[];
  for (var i = count - 1; i >= 0; i--) {
    final start = DateTime(now.year, now.month, now.day - i);
    final end = start.add(const Duration(days: 1));
    result.add(valueFor(start, end));
  }
  return result;
}

double _percentChange(int previous, int current) {
  if (previous == 0) return current == 0 ? 0 : 100;
  return ((current - previous) / previous * 100);
}

/// Summani formatlaydi: 1.250.000
String formatAmount(int amount) {
  return amount.toString().replaceAllMapped(
        RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
        (Match m) => '${m[1]}.',
      );
}

/// Bugungi davomat taqsimoti — real yozuvlardan (P2, spec §18).
///
/// `todayAttendanceProvider` (real Isar yozuvlari) bo'yicha status
/// darajasida hisoblanadi: present / late / absent / excused.
class TodayAttendanceBreakdown {
  final int present;
  final int late;
  final int absent;
  final int excused;

  /// Bugungi barcha (non-legacy) yozuvlar soni — legacy/notanish status
  /// qiymatlari ham hisobga olinadi (review P2 #2).
  final int total;

  const TodayAttendanceBreakdown({
    required this.present,
    required this.late,
    required this.absent,
    required this.excused,
    required this.total,
  });

  bool get hasEntries => total > 0;

  /// Har bir statusning ulushi (0..1) — visual segment uchun.
  double get presentRatio => total == 0 ? 0 : present / total;
  double get lateRatio => total == 0 ? 0 : late / total;
  double get absentRatio => total == 0 ? 0 : absent / total;
  double get excusedRatio => total == 0 ? 0 : excused / total;
}

/// Bugungi davomat taqsimoti provider'i.
///
/// `attendanceVersionProvider` watch qilinadi — davomat event'i kelganda
/// avtomatik qayta hisoblanadi (event-driven refresh, qo'lda shart emas).
final todayAttendanceBreakdownProvider =
    FutureProvider<TodayAttendanceBreakdown>((ref) async {
  final entries = await ref.watch(todayAttendanceProvider.future);
  var present = 0, late = 0, absent = 0, excused = 0;
  for (final e in entries) {
    switch (e.status) {
      case 'present':
        present++;
        break;
      case 'late':
        late++;
        break;
      case 'absent':
        absent++;
        break;
      case 'excused':
        excused++;
        break;
    }
  }
  return TodayAttendanceBreakdown(
    present: present,
    late: late,
    absent: absent,
    excused: excused,
    total: entries.length,
  );
});
