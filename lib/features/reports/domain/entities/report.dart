import 'package:equatable/equatable.dart';

/// Hisobot turi.
enum ReportType {
  studentStats,
  groupStats,
  revenue,
  debt,
  attendance,
  teacherWorkload,
}

/// Hisobot entity'si (spec §6 #34-37).
///
/// Hisobot quyidagi ma'lumotlarni saqlaydi:
/// - Hisobot ID
/// - Hisobot turi
/// - Sarlavha
/// - Ma'lumotlar (JSON)
/// - Yaratilgan sana
class Report extends Equatable {
  final String reportId;
  final ReportType type;
  final String title;
  final Map<String, dynamic> data;
  final DateTime createdAt;
  final DateTime? startDate;
  final DateTime? endDate;

  const Report({
    required this.reportId,
    required this.type,
    required this.title,
    required this.data,
    required this.createdAt,
    this.startDate,
    this.endDate,
  });

  @override
  List<Object?> get props => [
        reportId,
        type,
        title,
        data,
        createdAt,
        startDate,
        endDate,
      ];
}

/// Talaba statistikasi.
class StudentStats extends Equatable {
  final int totalStudents;
  final int activeStudents;
  final int frozenStudents;
  final int graduatedStudents;
  final int archivedStudents;
  final int newStudentsThisMonth;
  final double averageAttendance;
  final int unpaidCount;

  const StudentStats({
    required this.totalStudents,
    required this.activeStudents,
    required this.frozenStudents,
    required this.graduatedStudents,
    required this.archivedStudents,
    required this.newStudentsThisMonth,
    required this.averageAttendance,
    required this.unpaidCount,
  });

  @override
  List<Object?> get props => [
        totalStudents,
        activeStudents,
        frozenStudents,
        graduatedStudents,
        archivedStudents,
        newStudentsThisMonth,
        averageAttendance,
        unpaidCount,
      ];
}

/// Guruh statistikasi.
class GroupStats extends Equatable {
  final int totalGroups;
  final int activeGroups;
  final int totalCapacity;
  final int totalEnrolled;
  final double occupancyRate;
  final List<GroupDetail> groups;

  const GroupStats({
    required this.totalGroups,
    required this.activeGroups,
    required this.totalCapacity,
    required this.totalEnrolled,
    required this.occupancyRate,
    required this.groups,
  });

  @override
  List<Object?> get props => [
        totalGroups,
        activeGroups,
        totalCapacity,
        totalEnrolled,
        occupancyRate,
        groups,
      ];
}

/// Guruh tafsilotlari.
class GroupDetail extends Equatable {
  final String groupId;
  final String groupName;
  final int capacity;
  final int enrolled;
  final int teachers;

  const GroupDetail({
    required this.groupId,
    required this.groupName,
    required this.capacity,
    required this.enrolled,
    required this.teachers,
  });

  double get occupancyRate =>
      capacity > 0 ? (enrolled / capacity) * 100 : 0;

  @override
  List<Object?> get props => [groupId, groupName, capacity, enrolled, teachers];
}

/// Daromad hisoboti.
class RevenueStats extends Equatable {
  final int totalRevenue;
  final int monthlyRevenue;
  final int pendingAmount;
  final int refundedAmount;
  final List<MonthlyRevenue> monthlyData;
  final Map<String, int> revenueByPaymentType;

  const RevenueStats({
    required this.totalRevenue,
    required this.monthlyRevenue,
    required this.pendingAmount,
    required this.refundedAmount,
    required this.monthlyData,
    required this.revenueByPaymentType,
  });

  @override
  List<Object?> get props => [
        totalRevenue,
        monthlyRevenue,
        pendingAmount,
        refundedAmount,
        monthlyData,
        revenueByPaymentType,
      ];
}

/// Oylik daromad.
class MonthlyRevenue extends Equatable {
  final String month;
  final int amount;

  const MonthlyRevenue({
    required this.month,
    required this.amount,
  });

  @override
  List<Object?> get props => [month, amount];
}

/// Qarzdorlik hisoboti.
class DebtStats extends Equatable {
  final int totalDebt;
  final int overdueDebt;
  final int debtorsCount;
  final List<DebtDetail> debts;

  const DebtStats({
    required this.totalDebt,
    required this.overdueDebt,
    required this.debtorsCount,
    required this.debts,
  });

  @override
  List<Object?> get props => [totalDebt, overdueDebt, debtorsCount, debts];
}

/// Qarzdorlik tafsilotlari.
class DebtDetail extends Equatable {
  final String studentId;
  final String studentName;
  final String? groupName;
  final int amount;
  final DateTime dueDate;
  final bool isOverdue;

  const DebtDetail({
    required this.studentId,
    required this.studentName,
    this.groupName,
    required this.amount,
    required this.dueDate,
    required this.isOverdue,
  });

  @override
  List<Object?> get props =>
      [studentId, studentName, groupName, amount, dueDate, isOverdue];
}
