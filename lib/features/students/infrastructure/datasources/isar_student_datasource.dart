import 'package:isar/isar.dart';

import '../models/student_record.dart';

/// Isar bilan to'g'ridan-to'g'ri ishlaydigan datasource.
class IsarStudentDataSource {
  final Isar _db;

  IsarStudentDataSource(this._db);

  Future<StudentRecord> insert(StudentRecord record) async {
    return _db.writeTxn(() async {
      await _db.studentRecords.put(record);
      return record;
    });
  }

  Future<StudentRecord> update(StudentRecord record) {
    return _db.writeTxn(() async {
      // Isar `put` id=0 (yangi record) bilan INSERT qiladi — `identityId`
      // unique indeksi buziladi (Unique index violated). Mavjud yozuvning
      // id'sini saqlab, REPLACE qilamiz (update = find → id copy → put).
      final existing = await _db.studentRecords
          .filter()
          .identityIdEqualTo(record.identityId)
          .findFirst();
      if (existing != null) {
        record.id = existing.id;
      }
      await _db.studentRecords.put(record);
      return record;
    });
  }

  Future<StudentRecord?> findByIdentityId(String identityId) {
    return _db.studentRecords
        .filter()
        .identityIdEqualTo(identityId)
        .findFirst();
  }

  /// Talabani butunlay o'chiradi (hard delete).
  ///
  /// To'lov/davomat tarixi (identityId orqali) arxiv sifatida qoladi —
  /// moliyaviy hisobotlar buzilmasligi uchun. Guruh currentSize
  /// `removeStudentFromGroup` oqimi orqali kamaytiriladi (command ichida).
  Future<void> deleteByIdentityId(String identityId) async {
    await _db.writeTxn(() async {
      final record = await _db.studentRecords
          .filter()
          .identityIdEqualTo(identityId)
          .findFirst();
      if (record != null) {
        await _db.studentRecords.delete(record.id);
      }
    });
  }

  Future<List<StudentRecord>> findAll() {
    return _db.studentRecords.where().sortByEnrolledAtDesc().findAll();
  }

  /// Sahifalangan o'qish (Phase 16 — student list scale).
  ///
  /// Butun jadvalni xotiraga yuklamasdan, faqat kerakli oyna (offset..
  /// offset+limit) Isar so'rovida olinadi. Katta bazalarda (10 000+)
  /// boshlang'ich render va scroll xotirasi cheklangan bo'lib qoladi.
  Future<List<StudentRecord>> findPage({
    required int offset,
    required int limit,
  }) {
    return _db.studentRecords
        .where()
        .sortByEnrolledAtDesc()
        .offset(offset)
        .limit(limit)
        .findAll();
  }

  /// Butun jadvalni yuklamasdan yozuvlar soni (Isar `count()` — indeks
  /// bo'yicha, `findAll().length` kabi emas).
  Future<int> countAll() => _db.studentRecords.count();

  Future<List<StudentRecord>> findByGroupId(String groupId) {
    return _db.studentRecords
        .filter()
        .groupIdEqualTo(groupId)
        .sortByStudentNumber()
        .findAll();
  }

  Future<List<StudentRecord>> findByStatus(String status) {
    return _db.studentRecords
        .filter()
        .studentStatusEqualTo(status)
        .sortByEnrolledAtDesc()
        .findAll();
  }

  Future<List<StudentRecord>> findActive() {
    return _db.studentRecords
        .filter()
        .studentStatusEqualTo('active')
        .sortByEnrolledAtDesc()
        .findAll();
  }

  Future<List<StudentRecord>> findUnpaid() {
    return _db.studentRecords
        .filter()
        .paymentStatusEqualTo(false)
        .sortByEnrolledAtDesc()
        .findAll();
  }

  Future<int> getMaxStudentNumber() async {
    final all = await _db.studentRecords.where().findAll();
    if (all.isEmpty) return 1;
    return all.map((s) => s.studentNumber).reduce((a, b) => a > b ? a : b) + 1;
  }

  /// Identity merge (P0-01): duplicate identity'ga bog'langan student
  /// yozuvlarini survivor'ga ko'chiradi. Bitta writeTxn ichida.
  ///
  /// Konflikt qoidasi: primary'da StudentRecord ALLAQACHON mavjud bo'lsa
  /// — duplicate'niki `archived` qilinadi (ma'lumot yo'qolmaydi, `identityId`
  /// unique indeksi buzilmaydi). Bo'lmasa — `identityId` repoint qilinadi.
  ///
  /// Qaytgan qiymat: ishlov berilgan yozuvlar soni (idempotent — qayta
  /// chaqirilsa 0 qaytaradi).
  Future<int> repointIdentityReferences(
    String fromIdentityId,
    String toIdentityId,
  ) async {
    return _db.writeTxn(() async {
      final records = await _db.studentRecords
          .filter()
          .identityIdEqualTo(fromIdentityId)
          .findAll();
      if (records.isEmpty) return 0;

      final targetExists = await _db.studentRecords
          .filter()
          .identityIdEqualTo(toIdentityId)
          .findFirst();

      for (final record in records) {
        if (targetExists != null) {
          // Primary profili ustun — duplicate'niki arxivlanadi.
          record.studentStatus = 'archived';
          record.completedAt = DateTime.now();
          record.syncVersion += 1;
          record.pendingSync = true;
        } else {
          record.identityId = toIdentityId;
          record.syncVersion += 1;
          record.pendingSync = true;
        }
        await _db.studentRecords.put(record);
      }
      return records.length;
    });
  }
}
