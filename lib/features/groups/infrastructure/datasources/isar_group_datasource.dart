import 'dart:convert';

import 'package:isar/isar.dart';

import '../models/group_record.dart';

/// Isar bilan to'g'ridan-to'g'ri ishlaydigan datasource.
class IsarGroupDataSource {
  final Isar _db;

  IsarGroupDataSource(this._db);

  Future<GroupRecord> insert(GroupRecord record) async {
    return _db.writeTxn(() async {
      await _db.groupRecords.put(record);
      return record;
    });
  }

  Future<GroupRecord> update(GroupRecord record) {
    return _db.writeTxn(() async {
      // Isar `put` id=0 (yangi record) bilan INSERT qiladi — `groupId`
      // unique indeksi buziladi. Mavjud yozuvning id'sini saqlab, REPLACE
      // qilamiz.
      final existing = await _db.groupRecords
          .filter()
          .groupIdEqualTo(record.groupId)
          .findFirst();
      if (existing != null) {
        record.id = existing.id;
      }
      await _db.groupRecords.put(record);
      return record;
    });
  }

  Future<GroupRecord?> findById(String groupId) {
    return _db.groupRecords
        .filter()
        .groupIdEqualTo(groupId)
        .findFirst();
  }

  Future<List<GroupRecord>> findAll() {
    return _db.groupRecords.where().findAll();
  }

  Future<List<GroupRecord>> findActive() {
    return _db.groupRecords
        .filter()
        .statusEqualTo('active')
        .findAll();
  }

  Future<List<GroupRecord>> findByTeacherId(String teacherId) {
    return _db.groupRecords
        .filter()
        .teacherIdEqualTo(teacherId)
        .findAll();
  }

  Future<List<GroupRecord>> findByRoomId(String roomId) {
    return _db.groupRecords
        .filter()
        .roomIdEqualTo(roomId)
        .findAll();
  }

  /// Kunlarni JSON'dan `List<String>`'ga aylantiradi.
  static List<String> parseDaysOfWeek(String? json) {
    if (json == null || json.isEmpty) return [];
    try {
      return List<String>.from(jsonDecode(json));
    } catch (_) {
      return [];
    }
  }

  /// `List<String>`'ni JSON ga aylantiradi.
  static String encodeDaysOfWeek(List<String> days) => jsonEncode(days);
}
