import 'package:isar/isar.dart';

import '../models/face_record.dart';

/// Isar bilan ishlaydigan yuz bazasi datasource'i.
class IsarFaceDataSource {
  final Isar _db;

  IsarFaceDataSource(this._db);

  Future<void> put(FaceRecord record) {
    return _db.writeTxn(() => _db.faceRecords.put(record));
  }

  Future<FaceRecord?> findByIdentityId(String identityId) {
    return _db.faceRecords
        .filter()
        .identityIdEqualTo(identityId)
        .findFirst();
  }

  Future<List<FaceRecord>> findAll() {
    return _db.faceRecords.where().findAll();
  }

  Future<bool> hasFace(String identityId) async {
    final record = await findByIdentityId(identityId);
    return record != null;
  }

  Future<void> deleteByIdentityId(String identityId) async {
    await _db.writeTxn(() async {
      final record = await findByIdentityId(identityId);
      if (record != null) {
        await _db.faceRecords.delete(record.id);
      }
    });
  }

  /// Identity merge (P0-01): duplicate yuz bazasini survivor'ga ko'chiradi.
  ///
  /// Qoida (bitta writeTxn ichida):
  /// - Survivor'da yuz YO'Q bo'lsa → duplicate'niki repoint qilinadi
  ///   (`identityId` unique indeksi replace:true — xavfsiz).
  /// - Ikkala tomonda ham yuz bor bo'lsa → survivor saqlanadi, duplicate'niki
  ///   O'CHIRILADI (yuz biometrik ma'lumot — bir identity bitta yuz bazasi;
  ///   eski/arxivlangan identity'niki qolishi noto'g'ri).
  ///
  /// Qaytgan qiymat: 1 (ko'chirildi) yoki 0 (hech narsa yo'q edi).
  Future<int> repointIdentityReferences(
    String fromIdentityId,
    String toIdentityId,
  ) async {
    return _db.writeTxn(() async {
      final duplicate = await findByIdentityId(fromIdentityId);
      if (duplicate == null) return 0;

      final primary = await findByIdentityId(toIdentityId);
      if (primary != null) {
        // Survivor yuzi ustun — duplicate'niki olib tashlanadi.
        await _db.faceRecords.delete(duplicate.id);
        return 1;
      }

      duplicate.identityId = toIdentityId;
      duplicate.updatedAt = DateTime.now();
      await _db.faceRecords.put(duplicate);
      return 1;
    });
  }
}
