import '../../domain/entities/attendance_entry.dart';
import '../models/attendance_record.dart';
import '../../domain/repositories/attendance_repository.dart';
import '../datasources/isar_attendance_datasource.dart';

/// [AttendanceRepository] interfeysining Isar asosidagi implementatsiyasi.
///
/// V2 (spec §14): [record] upsert — bitta tranzaksiyada find+merge,
/// dublikat yaratilmaydi.
class AttendanceRepositoryImpl implements AttendanceRepository {
  final IsarAttendanceDataSource _datasource;

  AttendanceRepositoryImpl(this._datasource);

  @override
  Future<AttendanceEntry> record(AttendanceEntry entry) async {
    final record = _toRecord(entry);
    final saved = await _datasource.putUpsert(record);
    return _toEntity(saved);
  }

  @override
  Future<AttendanceEntry?> fetchByStudentAndDate(
    String identityId,
    DateTime attendanceDate,
  ) async {
    final record = await _datasource.findByStudentAndDate(
      identityId,
      attendanceDate,
    );
    return record == null ? null : _toEntity(record);
  }

  @override
  Future<AttendanceEntry?> fetchByStudentAndLesson(
    String identityId,
    String lessonId,
  ) async {
    final record = await _datasource.findByStudentAndLesson(
      identityId,
      lessonId,
    );
    return record == null ? null : _toEntity(record);
  }

  @override
  Future<List<AttendanceEntry>> fetchByLesson(String lessonId) async {
    final records = await _datasource.findByLesson(lessonId);
    return records.map(_toEntity).toList();
  }

  @override
  Future<bool> hasRecordedToday(String identityId) async {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final record = await _datasource.findByStudentAndDate(identityId, today);
    return record != null;
  }

  @override
  Future<List<AttendanceEntry>> fetchToday() async {
    final now = DateTime.now();
    final start = DateTime(now.year, now.month, now.day);
    final end = start.add(const Duration(days: 1));
    final records = await _datasource.fetchBetween(start, end);
    return records.map(_toEntity).toList();
  }

  @override
  Future<List<AttendanceEntry>> fetchForDate(DateTime date) async {
    final start = DateTime(date.year, date.month, date.day);
    final end = start.add(const Duration(days: 1));
    final records = await _datasource.fetchBetween(start, end);
    return records.map(_toEntity).toList();
  }

  @override
  Future<List<AttendanceEntry>> fetchForIdentity(String identityId) async {
    final records = await _datasource.fetchForIdentity(identityId);
    return records.map(_toEntity).toList();
  }

  @override
  Future<List<AttendanceEntry>> fetchBetween(DateTime from, DateTime to) async {
    final records = await _datasource.fetchBetween(from, to);
    return records.map(_toEntity).toList();
  }

  @override
  Future<int> countToday() async {
    final now = DateTime.now();
    final start = DateTime(now.year, now.month, now.day);
    final end = start.add(const Duration(days: 1));
    return _datasource.countBetween(start, end);
  }

  @override
  Future<int> repointIdentityReferences(
    String fromIdentityId,
    String toIdentityId,
  ) =>
      _datasource.repointIdentityReferences(fromIdentityId, toIdentityId);

  AttendanceRecord _toRecord(AttendanceEntry entry) {
    final checkIn = entry.checkInAt ?? entry.attendanceDate;
    return AttendanceRecord()
      ..identityId = entry.identityId
      ..timestamp = checkIn
      ..attendanceDate = entry.attendanceDate
      ..lessonId = entry.lessonId
      ..checkInAt = entry.checkInAt
      ..checkOutAt = entry.checkOutAt
      ..fullName = entry.fullName
      ..role = entry.role
      ..method = entry.method
      ..status = entry.status
      ..confidence = entry.confidence
      ..source = entry.source
      ..isLegacyMerged = entry.isLegacyMerged
      ..mergedIntoId = entry.mergedIntoId
      ..editedAt = entry.editedAt;
  }

  AttendanceEntry _toEntity(AttendanceRecord record) {
    // Legacy (V1) yozuvlarda yangi maydonlar null — timestamp'dan hosil qilamiz.
    final hasV2Date = record.attendanceDate != null;
    final attendanceDate = record.attendanceDate ??
        DateTime(record.timestamp.year, record.timestamp.month, record.timestamp.day);
    // AUDIT P0: V2 record'da `checkInAt` aniq null bo'lishi mumkin (absent/
    // excused — check-in yo'q). Faqat LEGACY (V1, attendanceDate null)
    // yozuvlarda timestamp'ga tushamiz — aks holda absent talaba yarim
    // tunda "kirgan" bo'lib ko'rinardi (test ochib berdi).
    final checkIn = record.checkInAt ?? (hasV2Date ? null : record.timestamp);
    return AttendanceEntry(
      id: record.id,
      identityId: record.identityId,
      fullName: record.fullName,
      role: record.role,
      attendanceDate: attendanceDate,
      lessonId: record.lessonId,
      checkInAt: checkIn,
      checkOutAt: record.checkOutAt,
      method: record.method,
      status: record.status ?? 'present',
      confidence: record.confidence,
      source: record.source,
      isLegacyMerged: record.isLegacyMerged ?? false,
      mergedIntoId: record.mergedIntoId,
      editedAt: record.editedAt,
    );
  }
}
