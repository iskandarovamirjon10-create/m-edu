import 'package:isar/isar.dart';

import '../models/attendance_session_record.dart';

/// Attendance session datasource — bitta writeTxn ichida find+merge.
///
/// Duplicate himoyasi DB darajasida: `lessonId` bo'yicha mavjud sessiya
/// yangilanadi, yangisi yaratilmaydi (P1.5 #4).
class IsarAttendanceSessionDataSource {
  final Isar _db;

  IsarAttendanceSessionDataSource(this._db);

  /// Sessiyani saqlaydi (lessonId bo'yicha upsert — bitta writeTxn).
  Future<AttendanceSessionRecord> putUpsert(
    AttendanceSessionRecord record,
  ) {
    return _db.writeTxn(() async {
      final existing = await _db.attendanceSessionRecords
          .filter()
          .lessonIdEqualTo(record.lessonId)
          .findFirst();
      if (existing == null) {
        await _db.attendanceSessionRecords.put(record);
        return record;
      }
      // Merge: yangi holat/vaqtlar mavjud yozuvga qo'shiladi.
      existing.openedAt = record.openedAt;
      if (record.closedAt != null) existing.closedAt = record.closedAt;
      existing.status = record.status;
      await _db.attendanceSessionRecords.put(existing);
      return existing;
    });
  }

  /// Sessiyani faqat YO'Q bo'lsa yaratadi (bitta writeTxn — race-xavfsiz).
  ///
  /// Parallel ikkita `openForLesson` chaqiruvi bir-biriga urilsa ham
  /// bittasi yaratadi, ikkinchisi `null` oladi — event bir marta chiqadi.
  Future<AttendanceSessionRecord?> putIfAbsent(
    AttendanceSessionRecord record,
  ) {
    return _db.writeTxn(() async {
      final existing = await _db.attendanceSessionRecords
          .filter()
          .lessonIdEqualTo(record.lessonId)
          .findFirst();
      if (existing != null) return null;
      await _db.attendanceSessionRecords.put(record);
      return record;
    });
  }

  Future<AttendanceSessionRecord?> findByLesson(String lessonId) {
    return _db.attendanceSessionRecords
        .filter()
        .lessonIdEqualTo(lessonId)
        .findFirst();
  }

  Future<List<AttendanceSessionRecord>> findActive() {
    // active + notStarted — hali yopilmagan sessiyalar.
    return _db.attendanceSessionRecords
        .filter()
        .statusEqualTo('active')
        .or()
        .statusEqualTo('notStarted')
        .findAll();
  }

  Future<AttendanceSessionRecord?> closeByLesson(
    String lessonId,
    DateTime closedAt,
  ) {
    return _db.writeTxn(() async {
      final existing = await _db.attendanceSessionRecords
          .filter()
          .lessonIdEqualTo(lessonId)
          .findFirst();
      if (existing == null) return null;
      existing.status = 'completed';
      existing.closedAt = closedAt;
      await _db.attendanceSessionRecords.put(existing);
      return existing;
    });
  }
}
