import '../../domain/entities/report.dart';
import '../../domain/repositories/report_repository.dart';

/// Hisobot o'qish operatsiyalari (CQRS queries).
class ReportQueries {
  final ReportRepository _repository;

  ReportQueries({required ReportRepository repository})
      : _repository = repository;

  Future<StudentStats> getStudentStats() => _repository.getStudentStats();

  Future<GroupStats> getGroupStats() => _repository.getGroupStats();

  Future<RevenueStats> getRevenueStats({DateTime? startDate, DateTime? endDate}) =>
      _repository.getRevenueStats(startDate: startDate, endDate: endDate);

  Future<DebtStats> getDebtStats() => _repository.getDebtStats();

  Future<Map<String, dynamic>> getAttendanceStats({String? groupId}) =>
      _repository.getAttendanceStats(groupId: groupId);

  Future<Map<String, dynamic>> getTeacherWorkloadStats() =>
      _repository.getTeacherWorkloadStats();

  Future<List<Report>> fetchSavedReports({ReportType? type}) =>
      _repository.fetchSavedReports(type: type);

  /// Hisobotni saqlaydi (AUDIT P1-02: real persistence).
  Future<Report> saveReport(Report report) => _repository.saveReport(report);

  /// Saqlangan hisobotni o'chiradi (AUDIT P1-02: DELETE).
  Future<void> deleteReport(String reportId) =>
      _repository.deleteReport(reportId);
}
