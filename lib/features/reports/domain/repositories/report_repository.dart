import '../entities/report.dart';

/// Hisobot o'qish uchun repository interfeysi.
abstract class ReportRepository {
  /// Talaba statistikasini qaytaradi.
  Future<StudentStats> getStudentStats();

  /// Guruh statistikasini qaytaradi.
  Future<GroupStats> getGroupStats();

  /// Daromad hisobotini qaytaradi.
  Future<RevenueStats> getRevenueStats({DateTime? startDate, DateTime? endDate});

  /// Qarzdorlik hisobotini qaytaradi.
  Future<DebtStats> getDebtStats();

  /// Davomat hisobotini qaytaradi.
  Future<Map<String, dynamic>> getAttendanceStats({String? groupId});

  /// O'qituvchi yuklamasini qaytaradi.
  Future<Map<String, dynamic>> getTeacherWorkloadStats();

  /// Hisobotni saqlaydi (tarix uchun — real Isar persistence).
  Future<Report> saveReport(Report report);

  /// Saqlangan hisobotlarni qaytaradi.
  Future<List<Report>> fetchSavedReports({ReportType? type});

  /// Saqlangan hisobotni o'chiradi (AUDIT P1-02: DELETE).
  Future<void> deleteReport(String reportId);
}
