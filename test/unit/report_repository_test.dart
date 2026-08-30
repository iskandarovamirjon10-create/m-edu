import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/attendance/application/services/attendance_statistics_service.dart';
import 'package:m_edu/features/payments/domain/entities/debt.dart';
import 'package:m_edu/features/payments/domain/entities/payment.dart';
import 'package:m_edu/features/reports/domain/entities/report.dart';
import 'package:m_edu/features/reports/infrastructure/datasources/isar_report_datasource.dart';
import 'package:m_edu/features/reports/infrastructure/models/report_record.dart';
import 'package:m_edu/features/reports/infrastructure/repositories_impl/report_repository_impl.dart';

import '../helpers/fake_repositories.dart';

/// ReportDataSource uchun xotira ichidagi fake.
class _FakeReportDataSource implements ReportDataSource {
  final List<ReportRecord> records = [];

  @override
  Future<ReportRecord> save(ReportRecord record) async {
    records.add(record);
    return record;
  }

  @override
  Future<List<ReportRecord>> findAll({String? type}) async {
    if (type != null && type.isNotEmpty) {
      return records.where((r) => r.type == type).toList();
    }
    return List.of(records);
  }

  @override
  Future<void> delete(String reportId) async {
    records.removeWhere((r) => r.reportId == reportId);
  }
}

Payment _payment({
  required String id,
  required int amount,
  PaymentStatus status = PaymentStatus.completed,
  PaymentType type = PaymentType.cash,
  DateTime? date,
  int discount = 0,
  int lateFee = 0,
}) {
  return Payment(
    paymentId: id,
    studentIdentityId: 'M-EDU-2026-000001',
    amount: amount,
    paymentType: type,
    status: status,
    paymentDate: date ?? DateTime(2026, 8, 10),
    discountAmount: discount,
    lateFee: lateFee,
  );
}

void main() {
  group('ReportRepositoryImpl.getRevenueStats', () {
    ReportRepositoryImpl buildRepo(List<Payment> payments) {
      return ReportRepositoryImpl(
        studentRepository: FakeStudentRepository(),
        groupRepository: FakeGroupRepository(),
        teacherRepository: FakeTeacherRepository(),
        paymentRepository: FakePaymentRepository(payments: payments),
        attendanceStatistics: AttendanceStatisticsService(
          attendanceRepository: FakeAttendanceRepository(),
          scheduleRepository: FakeScheduleRepository(),
        ),
        reportDataSource: _FakeReportDataSource(),
      );
    }

    test('jami kirim — faqat completed to\'lovlar (paidAmount = amount - discount + lateFee)', () async {
      final repo = buildRepo([
        _payment(id: 'P1', amount: 100000, discount: 10000),
        _payment(id: 'P2', amount: 200000, lateFee: 5000),
        _payment(id: 'P3', amount: 999999, status: PaymentStatus.pending),
        _payment(id: 'P4', amount: 999999, status: PaymentStatus.failed),
        _payment(id: 'P5', amount: 999999, status: PaymentStatus.cancelled),
      ]);

      final stats = await repo.getRevenueStats();

      // P1: 100000-10000=90000, P2: 200000+5000=205000 → 295000
      expect(stats.totalRevenue, 295000);
      expect(stats.pendingAmount, 999999);
      expect(stats.refundedAmount, 0);
    });

    test('date-range: [start, end) oralig\'i — oldingi/keyingi to\'lovlar kirmaydi', () async {
      final repo = buildRepo([
        _payment(id: 'P1', amount: 1000, date: DateTime(2026, 7, 31)), // startdan oldin
        _payment(id: 'P2', amount: 2000, date: DateTime(2026, 8, 1)), // ichida
        _payment(id: 'P3', amount: 3000, date: DateTime(2026, 8, 31)), // ichida (end-1)
        _payment(id: 'P4', amount: 4000, date: DateTime(2026, 9, 1)), // end — KIRMAYDI
      ]);

      final stats = await repo.getRevenueStats(
        startDate: DateTime(2026, 8, 1),
        endDate: DateTime(2026, 9, 1),
      );

      expect(stats.totalRevenue, 5000);
    });

    test('date-range faqat end berilganda — [oy boshi, end) oralig\'i', () async {
      // endDate berilganda rangeStart = joriy oy boshi (hujjatlashtirilgan
      // semantics), endDate esa yuqori chegara (exclusive).
      final now = DateTime.now();
      final monthStart = DateTime(now.year, now.month, 1);
      final repo = buildRepo([
        // Oydan oldin — [monthStart, end) ichida emas → kirmaydi.
        _payment(
          id: 'P1',
          amount: 1000,
          date: monthStart.subtract(const Duration(days: 20)),
        ),
        // Oy ichida, endDate dan oldin → kiradi.
        _payment(id: 'P2', amount: 2000, date: monthStart.add(const Duration(days: 2))),
        // endDate dan keyin → kirmaydi.
        _payment(
          id: 'P3',
          amount: 4000,
          date: monthStart.add(const Duration(days: 45)),
        ),
      ]);
      final endDate = monthStart.add(const Duration(days: 30));

      final stats = await repo.getRevenueStats(endDate: endDate);

      expect(stats.totalRevenue, 2000);
    });

    test('to\'lov turlari bo\'yicha bo\'linish (range ichida)', () async {
      final repo = buildRepo([
        _payment(id: 'P1', amount: 1000, type: PaymentType.cash),
        _payment(id: 'P2', amount: 2000, type: PaymentType.card),
        _payment(id: 'P3', amount: 4000, type: PaymentType.card),
      ]);

      final stats = await repo.getRevenueStats();

      expect(stats.revenueByPaymentType['cash'], 1000);
      expect(stats.revenueByPaymentType['card'], 6000);
      expect(stats.revenueByPaymentType['transfer'], 0);
    });

    test('monthlyData — oxirgi 6 oy uchun summa yig\'iladi', () async {
      final now = DateTime.now();
      final thisMonth = DateTime(now.year, now.month, 15);
      final lastMonth = DateTime(now.year, now.month - 1, 10);
      final repo = buildRepo([
        _payment(id: 'P1', amount: 5000, date: thisMonth),
        _payment(id: 'P2', amount: 7000, date: lastMonth),
      ]);

      final stats = await repo.getRevenueStats();

      expect(stats.monthlyData.length, 6);
      final current = stats.monthlyData
          .firstWhere((m) => m.month == '${now.year}-${now.month.toString().padLeft(2, '0')}');
      expect(current.amount, 5000);
    });
  });

  group('ReportRepositoryImpl.getDebtStats', () {
    test('jami qarz, muddati o\'tgan qarz, qarzdorlar soni', () async {
      final now = DateTime.now();
      final repo = ReportRepositoryImpl(
        studentRepository: FakeStudentRepository(),
        groupRepository: FakeGroupRepository(),
        teacherRepository: FakeTeacherRepository(),
        paymentRepository: FakePaymentRepository(
          debts: [
            _debt(
              id: 'D1',
              studentId: 'S1',
              remaining: 100000,
              dueDate: now.subtract(const Duration(days: 3)), // overdue
            ),
            _debt(
              id: 'D2',
              studentId: 'S1',
              remaining: 50000,
              dueDate: now.add(const Duration(days: 3)), // kelajak
            ),
            _debt(
              id: 'D3',
              studentId: 'S2',
              remaining: 200000,
              dueDate: now.subtract(const Duration(days: 1)), // overdue
            ),
          ],
        ),
        attendanceStatistics: AttendanceStatisticsService(
          attendanceRepository: FakeAttendanceRepository(),
          scheduleRepository: FakeScheduleRepository(),
        ),
        reportDataSource: _FakeReportDataSource(),
      );

      final stats = await repo.getDebtStats();

      expect(stats.totalDebt, 350000);
      expect(stats.overdueDebt, 300000);
      // 2 ta alohida qarzdor (S1, S2).
      expect(stats.debtorsCount, 2);
      expect(stats.debts.length, 3);
      expect(stats.debts.where((d) => d.isOverdue).length, 2);
    });
  });

  group('ReportRepositoryImpl — saqlangan hisobotlar (SAVE/LOAD/DELETE)', () {
    test('saveReport → fetchSavedReports round-trip, JSON saqlanadi', () async {
      final datasource = _FakeReportDataSource();
      final repo = ReportRepositoryImpl(
        studentRepository: FakeStudentRepository(),
        groupRepository: FakeGroupRepository(),
        teacherRepository: FakeTeacherRepository(),
        paymentRepository: FakePaymentRepository(),
        attendanceStatistics: AttendanceStatisticsService(
          attendanceRepository: FakeAttendanceRepository(),
          scheduleRepository: FakeScheduleRepository(),
        ),
        reportDataSource: datasource,
      );
      final report = Report(
        reportId: 'RPT-1',
        type: ReportType.revenue,
        title: 'Avgust hisoboti',
        data: {'totalRevenue': 12345},
        createdAt: DateTime(2026, 8, 10),
        startDate: DateTime(2026, 8, 1),
        endDate: DateTime(2026, 9, 1),
      );

      await repo.saveReport(report);
      final loaded = await repo.fetchSavedReports();

      expect(loaded.length, 1);
      expect(loaded.single.reportId, 'RPT-1');
      expect(loaded.single.type, ReportType.revenue);
      expect(loaded.single.data['totalRevenue'], 12345);
      expect(loaded.single.startDate, DateTime(2026, 8, 1));
    });

    test('fetchSavedReports(type:) bo\'yicha filter', () async {
      final datasource = _FakeReportDataSource();
      final repo = ReportRepositoryImpl(
        studentRepository: FakeStudentRepository(),
        groupRepository: FakeGroupRepository(),
        teacherRepository: FakeTeacherRepository(),
        paymentRepository: FakePaymentRepository(),
        attendanceStatistics: AttendanceStatisticsService(
          attendanceRepository: FakeAttendanceRepository(),
          scheduleRepository: FakeScheduleRepository(),
        ),
        reportDataSource: datasource,
      );
      await repo.saveReport(Report(
        reportId: 'R1',
        type: ReportType.revenue,
        title: 'A',
        data: const {},
        createdAt: DateTime(2026, 8, 1),
      ));
      await repo.saveReport(Report(
        reportId: 'R2',
        type: ReportType.debt,
        title: 'B',
        data: const {},
        createdAt: DateTime(2026, 8, 2),
      ));

      final revenue = await repo.fetchSavedReports(type: ReportType.revenue);
      expect(revenue.length, 1);
      expect(revenue.single.reportId, 'R1');
    });

    test('deleteReport — hisobot o\'chiriladi', () async {
      final datasource = _FakeReportDataSource();
      final repo = ReportRepositoryImpl(
        studentRepository: FakeStudentRepository(),
        groupRepository: FakeGroupRepository(),
        teacherRepository: FakeTeacherRepository(),
        paymentRepository: FakePaymentRepository(),
        attendanceStatistics: AttendanceStatisticsService(
          attendanceRepository: FakeAttendanceRepository(),
          scheduleRepository: FakeScheduleRepository(),
        ),
        reportDataSource: datasource,
      );
      await repo.saveReport(Report(
        reportId: 'R1',
        type: ReportType.attendance,
        title: 'A',
        data: const {},
        createdAt: DateTime(2026, 8, 1),
      ));

      await repo.deleteReport('R1');

      expect(await repo.fetchSavedReports(), isEmpty);
    });
  });
}

Debt _debt({
  required String id,
  required String studentId,
  required int remaining,
  required DateTime dueDate,
}) {
  return Debt(
    debtId: id,
    studentIdentityId: studentId,
    dueDate: dueDate,
    totalAmount: remaining,
    paidAmount: 0,
    remainingAmount: remaining,
    status: DebtStatus.outstanding,
    billingPeriod: '2026-08',
  );
}
