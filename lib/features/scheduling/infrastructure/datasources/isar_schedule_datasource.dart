import 'dart:convert';

import 'package:isar/isar.dart';

import '../models/schedule_record.dart';
import '../models/room_record.dart';

/// Isar bilan to'g'ridan-to'g'ri ishlaydigan datasource.
class IsarScheduleDataSource {
  final Isar _db;

  IsarScheduleDataSource(this._db);

  // ==================== Jadval ====================

  Future<ScheduleRecord> insert(ScheduleRecord record) async {
    return _db.writeTxn(() async {
      await _db.scheduleRecords.put(record);
      return record;
    });
  }

  /// Jadvalni yangilaydi: mavjud yozuvning id'sini saqlab REPLACE qiladi
  /// (`scheduleId` unique indeksi buzilmasligi uchun).
  Future<ScheduleRecord> update(ScheduleRecord record) {
    return _db.writeTxn(() async {
      final existing = await _db.scheduleRecords
          .filter()
          .scheduleIdEqualTo(record.scheduleId)
          .findFirst();
      if (existing != null) {
        record.id = existing.id;
      }
      await _db.scheduleRecords.put(record);
      return record;
    });
  }

  Future<ScheduleRecord?> findById(String scheduleId) {
    return _db.scheduleRecords
        .filter()
        .scheduleIdEqualTo(scheduleId)
        .findFirst();
  }

  Future<List<ScheduleRecord>> findAll() {
    return _db.scheduleRecords.where().findAll();
  }

  Future<List<ScheduleRecord>> findByGroupId(String groupId) {
    return _db.scheduleRecords
        .filter()
        .groupIdEqualTo(groupId)
        .findAll();
  }

  Future<List<ScheduleRecord>> findByTeacherId(String teacherId) {
    return _db.scheduleRecords
        .filter()
        .teacherIdEqualTo(teacherId)
        .findAll();
  }

  Future<List<ScheduleRecord>> findByRoomId(String roomId) {
    return _db.scheduleRecords
        .filter()
        .roomIdEqualTo(roomId)
        .findAll();
  }

  Future<List<ScheduleRecord>> findByDay(int dayOfWeek) {
    return _db.scheduleRecords
        .filter()
        .dayOfWeekEqualTo(dayOfWeek)
        .findAll();
  }

  Future<List<ScheduleRecord>> findByDateRange(
    DateTime start,
    DateTime end,
  ) async {
    final all = await _db.scheduleRecords.where().findAll();
    return all.where((s) {
      if (s.specificDate == null) return false;
      return s.specificDate!.isAfter(start) && s.specificDate!.isBefore(end);
    }).toList();
  }

  /// Spec §21: uch o'lchov bo'yicha to'qnashuv (xona / o'qituvchi / guruh)
  /// bir xil mantiq — faqat filter field farq qiladi. Duplicate mantiqni
  /// oldini olish uchun (§41) umumiy helper ishlatiladi: berilgan predicate
  /// bo'yicha `scheduled` jadvallar ustidan vaqt oralig'i ustma-ust tushishini
  /// aniqlaydi.
  Future<bool> _hasConflicting(
    bool Function(ScheduleRecord record) matches, {
    required int dayOfWeek,
    required String startTime,
    required String endTime,
    String? excludeScheduleId,
  }) async {
    final records = await _db.scheduleRecords
        .filter()
        .dayOfWeekEqualTo(dayOfWeek)
        .statusEqualTo('scheduled')
        .findAll();

    for (final record in records) {
      if (!matches(record)) continue;
      if (excludeScheduleId != null &&
          record.scheduleId == excludeScheduleId) {
        continue;
      }
      if (_hasTimeOverlap(startTime, endTime, record.startTime, record.endTime)) {
        return true;
      }
    }
    return false;
  }

  Future<bool> hasConflict({
    required String roomId,
    required int dayOfWeek,
    required String startTime,
    required String endTime,
    String? excludeScheduleId,
  }) {
    return _hasConflicting(
      (record) => record.roomId == roomId,
      dayOfWeek: dayOfWeek,
      startTime: startTime,
      endTime: endTime,
      excludeScheduleId: excludeScheduleId,
    );
  }

  Future<bool> hasTeacherConflict({
    required String teacherId,
    required int dayOfWeek,
    required String startTime,
    required String endTime,
    String? excludeScheduleId,
  }) {
    return _hasConflicting(
      (record) => record.teacherId == teacherId,
      dayOfWeek: dayOfWeek,
      startTime: startTime,
      endTime: endTime,
      excludeScheduleId: excludeScheduleId,
    );
  }

  Future<bool> hasGroupConflict({
    required String groupId,
    required int dayOfWeek,
    required String startTime,
    required String endTime,
    String? excludeScheduleId,
  }) {
    return _hasConflicting(
      (record) => record.groupId == groupId,
      dayOfWeek: dayOfWeek,
      startTime: startTime,
      endTime: endTime,
      excludeScheduleId: excludeScheduleId,
    );
  }

  bool _hasTimeOverlap(
    String start1,
    String end1,
    String start2,
    String end2,
  ) {
    return start1.compareTo(end2) < 0 && end1.compareTo(start2) > 0;
  }

  // ==================== Xonalar ====================

  Future<RoomRecord> insertRoom(RoomRecord record) async {
    return _db.writeTxn(() async {
      await _db.roomRecords.put(record);
      return record;
    });
  }

  /// Xonani yangilaydi: mavjud yozuvning id'sini saqlab REPLACE qiladi
  /// (`roomId` unique indeksi buzilmasligi uchun).
  Future<RoomRecord> updateRoom(RoomRecord record) {
    return _db.writeTxn(() async {
      final existing = await _db.roomRecords
          .filter()
          .roomIdEqualTo(record.roomId)
          .findFirst();
      if (existing != null) {
        record.id = existing.id;
      }
      await _db.roomRecords.put(record);
      return record;
    });
  }

  Future<RoomRecord?> findRoomById(String roomId) {
    return _db.roomRecords
        .filter()
        .roomIdEqualTo(roomId)
        .findFirst();
  }

  Future<List<RoomRecord>> findAllRooms() {
    return _db.roomRecords.where().findAll();
  }

  Future<List<RoomRecord>> findAvailableRooms() {
    return _db.roomRecords
        .filter()
        .statusEqualTo('available')
        .findAll();
  }

  /// Jihozlar JSON'dan `List<String>`'ga aylantiradi.
  static List<String> parseAmenities(String? json) {
    if (json == null || json.isEmpty) return [];
    try {
      return List<String>.from(jsonDecode(json));
    } catch (_) {
      return [];
    }
  }

  /// `List<String>`'ni JSON ga aylantiradi.
  static String encodeAmenities(List<String> items) => jsonEncode(items);
}
