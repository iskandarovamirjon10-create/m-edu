import 'package:isar/isar.dart';

import '../models/signed_qr_nonce_record.dart';

/// Signed QR nonce'larini saqlash (replay himoyasi, P1.5).
///
/// Offline-first va restart-xavfsiz: ishlatilgan nonce'lar Isar'da
/// saqlanadi — ilova qayta ishga tushganda ham xuddi shu QR takror
/// skanerlanmasligi kafolatlanadi.
class IsarQrNonceStore {
  final Isar _db;

  IsarQrNonceStore(this._db);

  /// Nonce avval ishlatilganmi? (replay aniqlash)
  Future<bool> contains(String nonce) async {
    final found =
        await _db.signedQrNonceRecords.filter().nonceEqualTo(nonce).findFirst();
    return found != null;
  }

  /// Ishlatilgan nonce'ni qayd qiladi (bitta writeTxn — race-xavfsiz).
  Future<void> add(String nonce, String studentId, DateTime usedAt) {
    return _db.writeTxn(() async {
      final existing = await _db.signedQrNonceRecords
          .filter()
          .nonceEqualTo(nonce)
          .findFirst();
      if (existing != null) return;
      await _db.signedQrNonceRecords.put(
        SignedQrNonceRecord()
          ..nonce = nonce
          ..studentId = studentId
          ..usedAt = usedAt,
      );
    });
  }

  /// [before] sanasidan oldin ishlatilgan nonce'lar (amal muddati o'tgan
  /// QR kodlar uchun) tozalanadi — to'plam cheksiz o'smaydi.
  Future<int> pruneBefore(DateTime before) async {
    return _db.writeTxn(() async {
      final expired = await _db.signedQrNonceRecords
          .filter()
          .usedAtLessThan(before)
          .findAll();
      if (expired.isEmpty) return 0;
      await _db.signedQrNonceRecords
          .deleteAll(expired.map((e) => e.id).toList());
      return expired.length;
    });
  }
}
