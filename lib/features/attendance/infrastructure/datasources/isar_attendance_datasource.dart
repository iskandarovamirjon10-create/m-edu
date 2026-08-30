import 'package:isar/isar.dart';

import '../models/attendance_record.dart';

/// Isar bilan ishlaydigan davomat datasource'i (V3 — §14, P0-02).
///
/// DB-level integrity: [putUpsert] barcha find+write amallarini bitta
/// `writeTxn` ichida bajaradi — ikkita parallel belgilash bir-birini
/// yozib o'chira olmaydi. Isar 3'da mavjud duplicate ma'lumot ustida
/// unique index xavfsiz yaratilmagani uchun (migration fail xavfi,
/// §37) invariant shu tranzaksiya orqali himoyalanadi.
///
/// V3 invariant (P0-02): primary yozuv `lessonId` bo'yicha topiladi —
/// bir kunda bir nechta dars bo'lsa har biri alohida yozuv. `lessonId`
/// yo'q legacy (V2) yozuvlar sana darajasida merge qilinadi.
class IsarAttendanceDataSource {
  final Isar _db;

  IsarAttendanceDataSource(this._db);

  /// Primary yozuvni (identityId, lessonId/sana) bo'yicha topib, berilgan
  /// vaqtlarni birlashtiradi: checkIn = eng erta, checkOut = eng kech.
  /// Mavjud bo'lmasa yangi yozuv yaratadi. Barchasi bitta tranzaksiyada.
  Future<AttendanceRecord> putUpsert(AttendanceRecord record) {
    return _db.writeTxn(() async {
      final existing = await _findPrimary(
        record.identityId,
        record.attendanceDate!,
        lessonId: record.lessonId,
      );
      if (existing == null) {
        await _db.attendanceRecords.put(record);
        return record;
      }

      // Merge: check-in/check-out vaqtlarini birlashtirish (§14).
      final newCheckIn = record.checkInAt;
      final newCheckOut = record.checkOutAt;

      if (newCheckIn != null &&
          (existing.checkInAt == null || newCheckIn.isBefore(existing.checkInAt!))) {
        existing.checkInAt = newCheckIn;
        existing.timestamp = newCheckIn;
      }
      if (newCheckOut != null &&
          (existing.checkOutAt == null || newCheckOut.isAfter(existing.checkOutAt!))) {
        existing.checkOutAt = newCheckOut;
      }

      // Usul faqat primary (check-in) yozuvida qoladi — check-out usuli
      // yozuv usulini almashtirmaydi (AttendanceMergePlan qoidasi bilan
      // mos: "primary (check-in) usuli saqlanadi").
      if (existing.method.isEmpty && record.method.isNotEmpty) {
        existing.method = record.method;
      }
      if (record.status != null && record.status!.isNotEmpty) {
        existing.status = record.status;
      }
      // V4: tahrirlangan yozuvlar uchun belgi — history'da "Tahrirlangan"
      // ko'rsatiladi (mavjud yozuvga yangi belgi qo'yilmaydi).
      if (record.editedAt != null) {
        existing.editedAt = record.editedAt;
      }
      if (record.fullName.isNotEmpty) existing.fullName = record.fullName;
      existing.role = record.role;
      existing.attendanceDate = record.attendanceDate;
      // Legacy kundalik yozuv dars aniqlanganda `lessonId` bilan yangilanadi
      // (ikkita yozuv paydo bo'lmaydi — statistika ikki marta hisoblamaydi).
      if (record.lessonId != null) existing.lessonId = record.lessonId;
      existing.confidence = record.confidence ?? existing.confidence;
      existing.source = record.source ?? existing.source;

      await _db.attendanceRecords.put(existing);
      return existing;
    });
  }

  Future<AttendanceRecord?> findByStudentAndDate(
    String identityId,
    DateTime attendanceDate,
  ) {
    return _findPrimary(identityId, attendanceDate);
  }

  /// Aniq dars bo'yicha primary yozuv (V3 — lesson darajasidagi merge).
  Future<AttendanceRecord?> findByStudentAndLesson(
    String identityId,
    String lessonId,
  ) {
    return _db.attendanceRecords
        .filter()
        .identityIdEqualTo(identityId)
        .group(_notLegacyFilter)
        .lessonIdEqualTo(lessonId)
        .findFirst();
  }

  /// Dars bo'yicha BARCHA primary yozuvlar (V3 — dars darajasidagi ro'yxat).
  Future<List<AttendanceRecord>> findByLesson(String lessonId) {
    return _db.attendanceRecords
        .filter()
        .group(_notLegacyFilter)
        .lessonIdEqualTo(lessonId)
        .sortByTimestampDesc()
        .findAll();
  }

  /// Primary yozuvni topadi.
  ///
  /// - [lessonId] berilganda: avval aniq dars yozuvi, topilmasa o'sha
  ///   kundagi `lessonId == null` (legacy V2) yozuv — u yangilanib,
  ///   dars darajasiga ko'tariladi.
  /// - [lessonId] berilmasa: kundalik yozuv `attendanceDate` bo'yicha,
  ///   topilmasa `timestamp` oralig'i bo'yicha (legacy null sanalar).
  Future<AttendanceRecord?> _findPrimary(
    String identityId,
    DateTime date, {
    String? lessonId,
  }) async {
    if (lessonId != null) {
      final byLesson = await _db.attendanceRecords
          .filter()
          .identityIdEqualTo(identityId)
          .group(_notLegacyFilter)
          .lessonIdEqualTo(lessonId)
          .findFirst();
      if (byLesson != null) return byLesson;

      final end = date.add(const Duration(days: 1));

      // Dars yozuvi yo'q — kundalik legacy yozuvga qo'shilamiz (upgrade).
      // Avval V2 (attendanceDate bor), keyin V1 (attendanceDate null,
      // faqat timestamp) — ikkala filial ham `lessonId == null` bilan
      // cheklanadi, dublikat yuzaga kelmaydi (statistika ikki marta
      // hisoblamaydi).
      final legacyV2 = await _db.attendanceRecords
          .filter()
          .identityIdEqualTo(identityId)
          .group(_notLegacyFilter)
          .attendanceDateEqualTo(date)
          .lessonIdIsNull()
          .findFirst();
      if (legacyV2 != null) return legacyV2;

      final legacyV1 = await _db.attendanceRecords
          .filter()
          .identityIdEqualTo(identityId)
          .timestampGreaterThan(date, include: true)
          .timestampLessThan(end)
          .group(_notLegacyFilter)
          .lessonIdIsNull()
          .findFirst();
      if (legacyV1 != null) return legacyV1;

      return null;
    }

    final end = date.add(const Duration(days: 1));

    // Kundalik (dars aniqlanmagan) upsert — kunning istalgan primary
    // yozuvi (shu jumladan dars darajasidagilari) bilan birlashadi. Bu
    // o'tish davri xatti-harakati: P1'da barcha belgilashlar lesson-scoped
    // bo'ladi, kundalik upsert esa faqat legacy oqim uchun qoladi.
    final byDate = await _db.attendanceRecords
        .filter()
        .identityIdEqualTo(identityId)
        .group(_notLegacyFilter)
        .attendanceDateEqualTo(date)
        .findFirst();
    if (byDate != null) return byDate;

    return _db.attendanceRecords
        .filter()
        .identityIdEqualTo(identityId)
        .timestampGreaterThan(date, include: true)
        .timestampLessThan(end)
        .group(_notLegacyFilter)
        .findFirst();
  }

  Future<List<AttendanceRecord>> fetchBetween(
    DateTime from,
    DateTime to,
  ) {
    return _db.attendanceRecords
        .filter()
        .group(_notLegacyFilter)
        .timestampGreaterThan(from, include: true)
        .timestampLessThan(to)
        .sortByTimestampDesc()
        .findAll();
  }

  Future<List<AttendanceRecord>> fetchForIdentity(String identityId) {
    return _db.attendanceRecords
        .filter()
        .identityIdEqualTo(identityId)
        .group(_notLegacyFilter)
        .sortByTimestampDesc()
        .findAll();
  }

  Future<int> countBetween(DateTime from, DateTime to) {
    return _db.attendanceRecords
        .filter()
        .group(_notLegacyFilter)
        .timestampGreaterThan(from, include: true)
        .timestampLessThan(to)
        .count();
  }

  /// Identity merge (P0-01): duplicate identity'ga bog'langan davomat
  /// yozuvlarini survivor'ga ko'chiradi — BIR writeTxn ichida.
  ///
  /// V2 invariant (§14) saqlanadi: agar survivor'da o'sha kunga PRIMARY
  /// yozuv mavjud bo'lsa, vaqtlar birlashtiriladi (check-in=erta,
  /// check-out=kech) va duplicate yozuv `isLegacyMerged` bilan belgilanadi
  /// (fizik o'chirilmaydi — audit izi, qoida §23 bilan mos).
  /// Qaytgan qiymat: ishlov berilgan yozuvlar soni (idempotent).
  Future<int> repointIdentityReferences(
    String fromIdentityId,
    String toIdentityId,
  ) async {
    return _db.writeTxn(() async {
      final records = await _db.attendanceRecords
          .filter()
          .identityIdEqualTo(fromIdentityId)
          .group(_notLegacyFilter)
          .findAll();
      var handled = 0;
      for (final record in records) {
        final date = record.attendanceDate ??
            DateTime(record.timestamp.year, record.timestamp.month,
                record.timestamp.day);
        final target = await _findPrimary(toIdentityId, date);
        if (target == null) {
          record.identityId = toIdentityId;
          await _db.attendanceRecords.put(record);
        } else {
          // Ikkala identity bir kunda belgilangan — vaqtlarni birlashtiramiz.
          final newCheckIn = record.checkInAt;
          if (newCheckIn != null &&
              (target.checkInAt == null ||
                  newCheckIn.isBefore(target.checkInAt!))) {
            target.checkInAt = newCheckIn;
          }
          final newCheckOut = record.checkOutAt;
          if (newCheckOut != null &&
              (target.checkOutAt == null ||
                  newCheckOut.isAfter(target.checkOutAt!))) {
            target.checkOutAt = newCheckOut;
          }
          await _db.attendanceRecords.put(target);

          // Duplicate primary bo'lib qolmaydi — legacy belgisi (§23).
          record.isLegacyMerged = true;
          record.mergedIntoId = target.id;
          await _db.attendanceRecords.put(record);
        }
        handled++;
      }
      return handled;
    });
  }

  /// "Legacy bo'lmagan" filtri: `isLegacyMerged == null` (V1 yozuv, hali
  /// backfill qilinmagan — migration fail bo'lsa ham ko'rinib turadi, §63)
  /// YOKI `isLegacyMerged == false`. Faqat aniq `true` belgilangan legacy
  /// yozuvlar so'rovlardan chiqariladi.
  static QueryBuilder<AttendanceRecord, AttendanceRecord, QAfterFilterCondition>
      _notLegacyFilter(
    QueryBuilder<AttendanceRecord, AttendanceRecord, QFilterCondition> q,
  ) {
    return q.isLegacyMergedIsNull().or().isLegacyMergedEqualTo(false);
  }
}
