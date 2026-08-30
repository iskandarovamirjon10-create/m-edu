import '../../domain/entities/attendance_entry.dart';
import '../../domain/repositories/attendance_repository.dart';

/// Kunlik davomat statistikasi.
class AttendanceStats {
  final int total;
  final int faceCount;
  final int qrCount;
  final int manualCount;

  const AttendanceStats({
    required this.total,
    required this.faceCount,
    required this.qrCount,
    required this.manualCount,
  });
}

/// Davomat o'qish operatsiyalari (CQRS queries).
class AttendanceQueries {
  final AttendanceRepository _repository;

  AttendanceQueries({required AttendanceRepository repository})
      : _repository = repository;

  Future<List<AttendanceEntry>> fetchToday() => _repository.fetchToday();

  Future<List<AttendanceEntry>> fetchForDate(DateTime date) =>
      _repository.fetchForDate(date);

  Future<List<AttendanceEntry>> fetchForIdentity(String identityId) =>
      _repository.fetchForIdentity(identityId);

  /// Dars (lesson instance) bo'yicha yozuvlar — V3 (P1).
  Future<List<AttendanceEntry>> fetchByLesson(String lessonId) =>
      _repository.fetchByLesson(lessonId);

  Future<List<AttendanceEntry>> fetchBetween(DateTime from, DateTime to) =>
      _repository.fetchBetween(from, to);

  Future<bool> hasRecordedToday(String identityId) =>
      _repository.hasRecordedToday(identityId);

  /// Bugungi statistika.
  Future<AttendanceStats> fetchTodayStats() async {
    final today = await _repository.fetchToday();
    var face = 0, qr = 0, manual = 0;
    for (final entry in today) {
      switch (entry.method) {
        case 'face':
          face++;
        case 'qr':
          qr++;
        case 'manual':
          manual++;
      }
    }
    return AttendanceStats(
      total: today.length,
      faceCount: face,
      qrCount: qr,
      manualCount: manual,
    );
  }
}
