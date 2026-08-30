import 'package:isar/isar.dart';

import '../../../../core/error/failures.dart';
import '../models/identity_activity_record.dart';
import '../models/identity_record.dart';

/// Isar bilan to'g'ridan-to'g'ri ishlaydigan datasource.
///
/// Repository bu yerda `IdentityRecord`'larni saqlaydi, mapping esa
/// `IdentityRepositoryImpl` darajasida amalga oshiriladi.
class IsarIdentityDataSource {
  final Isar _db;

  IsarIdentityDataSource(this._db);

  Future<IdentityRecord> insert(IdentityRecord record) async {
    return _db.writeTxn(() async {
      final existing = await _db.identityRecords
          .filter()
          .identityIdEqualTo(record.identityId)
          .findFirst();
      if (existing != null) {
        throw DuplicateIdentityFailure(
          'Bu ID allaqachon ro\'yxatdan o\'tkazilgan: ${record.identityId}',
        );
      }
      // TOCTOU (AUDIT): telefon yagonaligi tekshiruvi command darajasidagi
      // alohida read'da emas — INSERT TRanzaksiyasi ICHIDA amalga oshiriladi.
      // Isar write txn'lar serializatsiyalangani uchun ikkita parallel
      // registratsiya bir xil telefon bilan o'tib keta olmaydi (check-then-
      // insert race yo'q). Unique index qo'shilmadi — eski ma'lumotda
      // duplicate telefon bo'lsa migration fail xavfi (payments §37 qoidasi).
      final phone = record.phone;
      if (phone != null && phone.isNotEmpty) {
        final byPhone = await _db.identityRecords
            .filter()
            .phoneEqualTo(phone)
            .findFirst();
        if (byPhone != null && byPhone.identityId != record.identityId) {
          throw DuplicateIdentityFailure(
            'Bu telefon raqami allaqachon ro\'yxatdan o\'tkazilgan: '
            '${byPhone.identityId} (${byPhone.firstName} ${byPhone.lastName})',
          );
        }
      }
      await _db.identityRecords.put(record);
      return record;
    });
  }

  Future<IdentityRecord> update(IdentityRecord record) {
    return _db.writeTxn(() async {
      // Isar `put` id=0 (yangi record) bilan INSERT qiladi — `identityId`
      // unique indeksi buziladi. Mavjud yozuvning id'sini saqlab, REPLACE
      // qilamiz.
      final existing = await _db.identityRecords
          .filter()
          .identityIdEqualTo(record.identityId)
          .findFirst();
      if (existing != null) {
        record.id = existing.id;
      }
      // TOCTOU: telefon yagonaligi tahrirlashda ham txn ichida tekshiriladi
      // (o'z telefonini saqlash — ruxsat; boshqa identity'ning telefonini
      // o'zlashtirish — rad).
      final phone = record.phone;
      if (phone != null && phone.isNotEmpty) {
        final byPhone = await _db.identityRecords
            .filter()
            .phoneEqualTo(phone)
            .findFirst();
        if (byPhone != null && byPhone.identityId != record.identityId) {
          throw DuplicateIdentityFailure(
            'Bu telefon raqami allaqachon boshqa shaxsga tegishli: '
            '${byPhone.identityId} (${byPhone.firstName} ${byPhone.lastName})',
          );
        }
      }
      await _db.identityRecords.put(record);
      return record;
    });
  }

  Future<IdentityRecord?> findByIdentityId(String identityId) {
    return _db.identityRecords
        .filter()
        .identityIdEqualTo(identityId)
        .findFirst();
  }

  Future<IdentityRecord?> findByPhone(String normalizedPhone) {
    return _db.identityRecords
        .filter()
        .phoneEqualTo(normalizedPhone)
        .findFirst();
  }

  /// Identity'ni butunlay o'chiradi (hard delete) — shaxs profili va uning
  /// activity timeline'ini birga o'chiradi.
  Future<void> deleteByIdentityId(String identityId) async {
    await _db.writeTxn(() async {
      final record = await _db.identityRecords
          .filter()
          .identityIdEqualTo(identityId)
          .findFirst();
      if (record != null) {
        await _db.identityRecords.delete(record.id);
      }
      // Timeline (audit-log) yozuvlarini ham tozalaymiz.
      final activities = await _db.identityActivityRecords
          .filter()
          .identityIdEqualTo(identityId)
          .findAll();
      for (final activity in activities) {
        await _db.identityActivityRecords.delete(activity.id);
      }
    });
  }

  Future<List<IdentityRecord>> findAll() {
    return _db.identityRecords.where().sortByCreatedAtDesc().findAll();
  }

  /// Berilgan IDlar bo'yicha yozuvlarni qaytaradi (Phase 16 — sahifalangan
  /// browse'da faqat ko'rinadigan sahifadagi identitylar olinadi, butun
  /// jadval emas). Isar `anyOf` list-filtri indeks orqali ishlaydi.
  Future<List<IdentityRecord>> findByIds(List<String> identityIds) {
    if (identityIds.isEmpty) return Future.value(const []);
    return _db.identityRecords
        .filter()
        .anyOf(identityIds, (q, id) => q.identityIdEqualTo(id))
        .findAll();
  }

  Future<List<IdentityRecord>> findByRole(String role) {
    return _db.identityRecords
        .filter()
        .roleEqualTo(role)
        .sortByCreatedAtDesc()
        .findAll();
  }

  Future<List<IdentityRecord>> findByStatus(String status) {
    return _db.identityRecords
        .filter()
        .statusEqualTo(status)
        .sortByCreatedAtDesc()
        .findAll();
  }

  Future<void> recordActivity(IdentityActivityRecord activity) {
    return _db.writeTxn(() => _db.identityActivityRecords.put(activity));
  }

  /// `fromIdentityId` ga tegishli barcha activity yozuvlarini
  /// `toIdentityId` ga ko'chiradi (merge paytida timeline ko'chirish).
  Future<int> repointActivities(
    String fromIdentityId,
    String toIdentityId,
  ) async {
    return _db.writeTxn(() async {
      final records = await _db.identityActivityRecords
          .filter()
          .identityIdEqualTo(fromIdentityId)
          .findAll();
      for (final record in records) {
        record.identityId = toIdentityId;
        await _db.identityActivityRecords.put(record);
      }
      return records.length;
    });
  }

  Future<List<IdentityActivityRecord>> findActivities(String identityId) {
    return _db.identityActivityRecords
        .filter()
        .identityIdEqualTo(identityId)
        .sortByOccurredAtDesc()
        .findAll();
  }
}
