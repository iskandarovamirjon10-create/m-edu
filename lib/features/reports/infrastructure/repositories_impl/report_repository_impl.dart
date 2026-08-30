import 'dart:convert';

import '../../../../core/extensions/enum_x.dart';
import '../../domain/entities/report.dart';
import '../../domain/repositories/report_repository.dart';
import '../datasources/isar_report_datasource.dart';
import '../models/report_record.dart';
import '../../../attendance/application/services/attendance_statistics_service.dart';
import '../../../students/domain/repositories/student_repository.dart';
import '../../../students/domain/entities/student.dart';
import '../../../groups/domain/repositories/group_repository.dart';
import '../../../teachers/domain/repositories/teacher_repository.dart';
import '../../../payments/domain/repositories/payment_repository.dart';
import '../../../payments/domain/entities/payment.dart';

/// `ReportRepository` interfeysining implementatsiyasi.
///
/// Boshqa feature'lardan ma'lumotlarni yig'ib, hisobotlar tayyorlaydi.
///
/// Phase 5: davomat statistikasi [AttendanceStatisticsService] orqali
/// DERIVED hisoblanadi (Attendance + Schedule source of truth) —
/// Student'dagi eski denormalized `attendancePercentage` emas.
class ReportRepositoryImpl implements ReportRepository {
  final StudentRepository _studentRepository;
  final GroupRepository _groupRepository;
  final TeacherRepository _teacherRepository;
  final PaymentRepository _paymentRepository;
  final AttendanceStatisticsService _attendanceStatistics;
  final ReportDataSource _reportDataSource;

  ReportRepositoryImpl({
    required StudentRepository studentRepository,
    required GroupRepository groupRepository,
    required TeacherRepository teacherRepository,
    required PaymentRepository paymentRepository,
    required AttendanceStatisticsService attendanceStatistics,
    required ReportDataSource reportDataSource,
  })  : _studentRepository = studentRepository,
        _groupRepository = groupRepository,
        _teacherRepository = teacherRepository,
        _paymentRepository = paymentRepository,
        _attendanceStatistics = attendanceStatistics,
        _reportDataSource = reportDataSource;

  @override
  Future<StudentStats> getStudentStats() async {
    final students = await _studentRepository.fetchAll();
    final now = DateTime.now();
    final monthStart = DateTime(now.year, now.month, 1);

    final totalStudents = students.length;
    final activeStudents = students.where((s) => s.isActive).length;
    final frozenStudents = students
        .where((s) => s.studentStatus == StudentStatus.frozen)
        .length;
    final graduatedStudents = students
        .where((s) => s.studentStatus == StudentStatus.graduated)
        .length;
    final archivedStudents = students
        .where((s) => s.studentStatus == StudentStatus.archived)
        .length;
    final newStudentsThisMonth = students
        .where((s) => s.enrolledAt.isAfter(monthStart))
        .length;
    // Phase 5: o'rtacha davomat DERIVED (Attendance + Schedule).
    final attendanceByStudent =
        await _attendanceStatistics.fetchForStudents(students);
    final averageAttendance = students.isEmpty
        ? 0.0
        : students.fold<double>(
              0,
              (sum, s) =>
                  sum + (attendanceByStudent[s.identityId]?.percentage ?? 0),
            ) /
            students.length;
    final unpaidCount = students.where((s) => !s.hasPaid).length;

    return StudentStats(
      totalStudents: totalStudents,
      activeStudents: activeStudents,
      frozenStudents: frozenStudents,
      graduatedStudents: graduatedStudents,
      archivedStudents: archivedStudents,
      newStudentsThisMonth: newStudentsThisMonth,
      averageAttendance: averageAttendance,
      unpaidCount: unpaidCount,
    );
  }

  @override
  Future<GroupStats> getGroupStats() async {
    final groups = await _groupRepository.fetchAll();
    final teachers = await _teacherRepository.fetchAll();

    final totalGroups = groups.length;
    final activeGroups = groups.where((g) => g.isActive).length;
    final totalCapacity =
        groups.fold<int>(0, (sum, g) => sum + g.capacity);
    final totalEnrolled =
        groups.fold<int>(0, (sum, g) => sum + g.currentSize);
    final occupancyRate =
        totalCapacity > 0 ? (totalEnrolled / totalCapacity) * 100 : 0.0;

    final groupDetails = groups.map((g) {
      final groupTeachers = teachers
          .where((t) => t.assignedGroupIds.contains(g.groupId))
          .length;
      return GroupDetail(
        groupId: g.groupId,
        groupName: g.name,
        capacity: g.capacity,
        enrolled: g.currentSize,
        teachers: groupTeachers,
      );
    }).toList();

    return GroupStats(
      totalGroups: totalGroups,
      activeGroups: activeGroups,
      totalCapacity: totalCapacity,
      totalEnrolled: totalEnrolled,
      occupancyRate: occupancyRate,
      groups: groupDetails,
    );
  }

  @override
  Future<RevenueStats> getRevenueStats({
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    final allPayments = await _paymentRepository.fetchAll();
    final now = DateTime.now();
    final monthStart = DateTime(now.year, now.month, 1);
    // endExclusive: keyingi oyning 1-sanasi (spec §12: [start, end)).
    final monthEnd = DateTime(now.year, now.month + 1, 1);

    final completedPayments =
        allPayments.where((p) => p.status == PaymentStatus.completed);

    // AUDIT P1-01: startDate/endDate HAQIQATAN ishlatiladi.
    // - Parametr berilgan bo'lsa → hisobot [start, end) oralig'iga
    //   chegaralanadi (startInclusive, endExclusive).
    // - Berilmagan bo'lsa → eski semantics saqlanadi: "Jami kirim" =
    //   barcha vaqt, "Oylik kirim" = joriy oy.
    final useRange = startDate != null || endDate != null;
    final rangeStart = startDate ?? monthStart;
    final rangeEnd = endDate ?? monthEnd;

    bool inRange(DateTime d) =>
        !d.isBefore(rangeStart) && d.isBefore(rangeEnd);

    final rangePayments =
        completedPayments.where((p) => inRange(p.paymentDate));

    final totalRevenue = (useRange ? rangePayments : completedPayments)
        .fold<int>(0, (sum, p) => sum + p.paidAmount);

    final monthlyRevenue = (useRange
            ? rangePayments
            : completedPayments.where(
                (p) => !p.paymentDate.isBefore(monthStart) &&
                    p.paymentDate.isBefore(monthEnd)))
        .fold<int>(0, (sum, p) => sum + p.paidAmount);

    final pendingAmount = allPayments
        .where((p) => p.status == PaymentStatus.pending)
        .fold<int>(0, (sum, p) => sum + p.paidAmount);

    final refundedAmount = allPayments
        .where((p) => p.status == PaymentStatus.refunded)
        .fold<int>(0, (sum, p) => sum + p.paidAmount);

    // Oylik ma'lumotlar (oxirgi 6 oy — yordamchi trend diagrammasi,
    // sana oralig'iga bog'liq emas).
    final monthlyData = <MonthlyRevenue>[];
    for (int i = 5; i >= 0; i--) {
      final m = DateTime(now.year, now.month - i, 1);
      final mEnd = DateTime(m.year, m.month + 1, 1);
      final mPayments = completedPayments.where((p) =>
          !p.paymentDate.isBefore(m) && p.paymentDate.isBefore(mEnd));
      final mAmount = mPayments.fold<int>(0, (sum, p) => sum + p.paidAmount);
      monthlyData.add(MonthlyRevenue(
        month: '${m.year}-${m.month.toString().padLeft(2, '0')}',
        amount: mAmount,
      ));
    }

    // To'lov turlari bo'yicha (sana oralig'i berilganda — oralikdagi).
    final revenueByPaymentType = <String, int>{};
    final breakdownSource = useRange ? rangePayments : completedPayments;
    for (final type in PaymentType.values) {
      final typePayments =
          breakdownSource.where((p) => p.paymentType == type);
      revenueByPaymentType[type.name] =
          typePayments.fold<int>(0, (sum, p) => sum + p.paidAmount);
    }

    return RevenueStats(
      totalRevenue: totalRevenue,
      monthlyRevenue: monthlyRevenue,
      pendingAmount: pendingAmount,
      refundedAmount: refundedAmount,
      monthlyData: monthlyData,
      revenueByPaymentType: revenueByPaymentType,
    );
  }

  @override
  Future<DebtStats> getDebtStats() async {
    final debts = await _paymentRepository.fetchOutstandingDebts();
    final now = DateTime.now();

    final totalDebt = debts.fold<int>(0, (sum, d) => sum + d.remainingAmount);
    final overdueDebts = debts.where((d) => d.dueDate.isBefore(now)).toList();
    final overdueDebt =
        overdueDebts.fold<int>(0, (sum, d) => sum + d.remainingAmount);
    final debtors =
        debts.map((d) => d.studentIdentityId).toSet().length;

    final debtDetails = debts.map((d) {
      return DebtDetail(
        studentId: d.studentIdentityId,
        studentName: d.studentName ?? 'Noma\'lum',
        groupName: d.groupName,
        amount: d.remainingAmount,
        dueDate: d.dueDate,
        isOverdue: d.dueDate.isBefore(now),
      );
    }).toList();

    return DebtStats(
      totalDebt: totalDebt,
      overdueDebt: overdueDebt,
      debtorsCount: debtors,
      debts: debtDetails,
    );
  }

  @override
  Future<Map<String, dynamic>> getAttendanceStats({String? groupId}) async {
    final students = groupId != null
        ? await _studentRepository.fetchByGroupId(groupId)
        : await _studentRepository.fetchAll();

    if (students.isEmpty) {
      return {
        'averageAttendance': 0.0,
        'excellentCount': 0,
        'goodCount': 0,
        'warningCount': 0,
        'criticalCount': 0,
      };
    }

    // Phase 5: davomat taqsimoti DERIVED (Attendance + Schedule).
    final attendanceByStudent =
        await _attendanceStatistics.fetchForStudents(students);

    var excellent = 0, good = 0, warning = 0, critical = 0;
    var sum = 0.0;
    for (final student in students) {
      final pct = attendanceByStudent[student.identityId]?.percentage ?? 0;
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
    final average = students.isEmpty ? 0.0 : sum / students.length;

    final excellentCount = excellent;
    final goodCount = good;
    final warningCount = warning;
    final criticalCount = critical;

    return {
      'averageAttendance': average,
      'excellentCount': excellentCount,
      'goodCount': goodCount,
      'warningCount': warningCount,
      'criticalCount': criticalCount,
    };
  }

  @override
  Future<Map<String, dynamic>> getTeacherWorkloadStats() async {
    final teachers = await _teacherRepository.fetchAll();

    final totalTeachers = teachers.length;
    final activeTeachers = teachers.where((t) => t.isActive).length;
    final totalHours =
        teachers.fold<int>(0, (sum, t) => sum + t.weeklyHours);
    final maxHours =
        teachers.fold<int>(0, (sum, t) => sum + t.maxWeeklyHours);
    final averageWorkload =
        activeTeachers > 0 ? totalHours / activeTeachers : 0.0;

    return {
      'totalTeachers': totalTeachers,
      'activeTeachers': activeTeachers,
      'totalHours': totalHours,
      'maxHours': maxHours,
      'averageWorkload': averageWorkload,
    };
  }

  // ═══════════════ Saqlangan hisobotlar (AUDIT P1-02) ═══════════════
  // Ilgari: `saveReport` hech narsa yozmasdi, `fetchSavedReports` doim
  // `[]` qaytarardi — FAKE. Endi real Isar persistence (SAVE/LOAD/DELETE).

  @override
  Future<Report> saveReport(Report report) async {
    final record = ReportRecord()
      ..reportId = report.reportId
      ..type = report.type.name
      ..title = report.title
      ..dataJson = jsonEncode(report.data)
      ..startDate = report.startDate
      ..endDate = report.endDate
      ..createdAt = report.createdAt;
    await _reportDataSource.save(record);
    return report;
  }

  @override
  Future<List<Report>> fetchSavedReports({ReportType? type}) async {
    final records = await _reportDataSource.findAll(type: type?.name);
    records.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    // Corrupt tur (eski versiya/restore) yozuv o'tkazib yuboriladi —
    // ro'yxat crash qilmaydi (spec §7, §17).
    return records.map(_toReportEntity).whereType<Report>().toList();
  }

  @override
  Future<void> deleteReport(String reportId) =>
      _reportDataSource.delete(reportId);

  /// [Report]'ga xavfsiz o'giradi. Tur nomuvofiq bo'lsa `null`
  /// (corrupt yozuv o'tkazib yuboriladi — crash YO'Q, spec §7, §17).
  Report? _toReportEntity(ReportRecord record) {
    final type = tryEnumByName(ReportType.values, record.type);
    if (type == null) return null;
    Map<String, dynamic> data = const {};
    try {
      data = (jsonDecode(record.dataJson) as Map).cast<String, dynamic>();
    } catch (_) {
      // Buzilgan data bo'lsa ham ro'yxat buzilmaydi.
    }
    return Report(
      reportId: record.reportId,
      type: type,
      title: record.title,
      data: data,
      createdAt: record.createdAt,
      startDate: record.startDate,
      endDate: record.endDate,
    );
  }
}
