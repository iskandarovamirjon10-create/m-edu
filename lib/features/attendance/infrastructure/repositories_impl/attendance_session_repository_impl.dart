import '../../domain/entities/attendance_session.dart';
import '../../domain/repositories/attendance_session_repository.dart';
import '../datasources/isar_attendance_session_datasource.dart';
import '../models/attendance_session_record.dart';

/// [AttendanceSessionRepository] interfeysining Isar asosidagi implementatsiyasi.
class AttendanceSessionRepositoryImpl implements AttendanceSessionRepository {
  final IsarAttendanceSessionDataSource _datasource;

  AttendanceSessionRepositoryImpl(this._datasource);

  @override
  Future<AttendanceSession> upsert(AttendanceSession session) async {
    final saved = await _datasource.putUpsert(_toRecord(session));
    return _toEntity(saved);
  }

  @override
  Future<AttendanceSession?> fetchByLesson(String lessonId) async {
    final record = await _datasource.findByLesson(lessonId);
    return record == null ? null : _toEntity(record);
  }

  @override
  Future<AttendanceSession?> createIfAbsent(AttendanceSession session) async {
    final record = await _datasource.putIfAbsent(_toRecord(session));
    return record == null ? null : _toEntity(record);
  }

  @override
  Future<List<AttendanceSession>> fetchActive() async {
    final records = await _datasource.findActive();
    return records.map(_toEntity).toList();
  }

  @override
  Future<AttendanceSession?> closeByLesson(
    String lessonId,
    DateTime closedAt,
  ) async {
    final record = await _datasource.closeByLesson(lessonId, closedAt);
    return record == null ? null : _toEntity(record);
  }

  AttendanceSessionRecord _toRecord(AttendanceSession session) {
    return AttendanceSessionRecord()
      ..sessionId = session.sessionId
      ..lessonId = session.lessonId
      ..groupId = session.groupId
      ..openedAt = session.openedAt
      ..closedAt = session.closedAt
      ..status = session.status.name;
  }

  AttendanceSession _toEntity(AttendanceSessionRecord record) {
    return AttendanceSession(
      sessionId: record.sessionId,
      lessonId: record.lessonId,
      groupId: record.groupId,
      openedAt: record.openedAt,
      closedAt: record.closedAt,
      status: AttendanceSessionStatus.values.firstWhere(
        (s) => s.name == record.status,
        orElse: () => AttendanceSessionStatus.completed,
      ),
    );
  }
}
