import 'dart:convert';

import 'package:isar/isar.dart';

import '../models/teacher_record.dart';

/// Isar bilan to'g'ridan-to'g'ri ishlaydigan datasource.
class IsarTeacherDataSource {
  final Isar _db;

  IsarTeacherDataSource(this._db);

  Future<TeacherRecord> insert(TeacherRecord record) async {
    return _db.writeTxn(() async {
      await _db.teacherRecords.put(record);
      return record;
    });
  }

  Future<TeacherRecord> update(TeacherRecord record) {
    return _db.writeTxn(() async {
      // Isar `put` id=0 (yangi record) bilan INSERT qiladi — `identityId`
      // unique indeksi buziladi. Mavjud yozuvning id'sini saqlab, REPLACE
      // qilamiz.
      final existing = await _db.teacherRecords
          .filter()
          .identityIdEqualTo(record.identityId)
          .findFirst();
      if (existing != null) {
        record.id = existing.id;
      }
      await _db.teacherRecords.put(record);
      return record;
    });
  }

  Future<TeacherRecord?> findByIdentityId(String identityId) {
    return _db.teacherRecords
        .filter()
        .identityIdEqualTo(identityId)
        .findFirst();
  }

  /// O'qituvchini butunlay o'chiradi (hard delete).
  ///
  /// Guruhlar o'qituvchi ID bilan bog'langan — command qatlami guruhlardagi
  /// `teacherId` havolalarini tozalaydi ([DeleteTeacherCommand]).
  Future<void> deleteByIdentityId(String identityId) async {
    await _db.writeTxn(() async {
      final record = await _db.teacherRecords
          .filter()
          .identityIdEqualTo(identityId)
          .findFirst();
      if (record != null) {
        await _db.teacherRecords.delete(record.id);
      }
    });
  }

  Future<List<TeacherRecord>> findAll() {
    return _db.teacherRecords.where().sortByTeacherNumber().findAll();
  }

  Future<List<TeacherRecord>> findActive() {
    return _db.teacherRecords
        .filter()
        .statusEqualTo('active')
        .sortByTeacherNumber()
        .findAll();
  }

  Future<List<TeacherRecord>> findByGroupId(String groupId) {
    return _db.teacherRecords
        .filter()
        .assignedGroupIdsJsonContains(groupId)
        .findAll();
  }

  Future<List<TeacherRecord>> findBySpecialization(String specialization) {
    return _db.teacherRecords
        .filter()
        .specializationEqualTo(specialization)
        .findAll();
  }

  Future<int> getMaxTeacherNumber() async {
    final all = await _db.teacherRecords.where().findAll();
    if (all.isEmpty) return 1;
    return all.map((t) => t.teacherNumber).reduce((a, b) => a > b ? a : b) + 1;
  }

  /// Guruh ID'larini JSON'dan `List<String>`'ga aylantiradi.
  static List<String> parseGroupIds(String? json) {
    if (json == null || json.isEmpty) return [];
    try {
      return List<String>.from(jsonDecode(json));
    } catch (_) {
      return [];
    }
  }

  /// `List<String>`'ni JSON ga aylantiradi.
  static String encodeGroupIds(List<String> ids) => jsonEncode(ids);
}
