import 'package:isar/isar.dart';

part 'signed_qr_nonce_record.g.dart';

/// Signed QR replay himoyasi — ishlatilgan nonce'lar (P1.5).
///
/// Bir marta muvaffaqiyatli tasdiqlangan QR kodning nonce'si shu yerda
/// saqlanadi: xuddi shu QR qayta skanerlansa (replay) rad etiladi.
///
/// Yagona nonce invariant writeTxn ichida himoyalanadi (Isar 3'da
/// unique index migration xavfi tufayli indeks ishlatilmaydi — bitta
/// tranzaksiyada tekshirish+saqlash, mavjud yozuv qayta qo'shilmaydi).
///
/// Yozuvlar cheklangan umrga ega — [IsarQrNonceStore.pruneBefore] orqali
/// eskirgan nonce'lar tozalanadi (QR amal muddati o'tgach ular kerak emas).
@collection
class SignedQrNonceRecord {
  Id id = Isar.autoIncrement;

  /// Ishlatilgan nonce (base64url) — takror skanerlashni aniqlash uchun.
  @Index()
  late String nonce;

  /// Nonce tegishli bo'lgan shaxs.
  late String studentId;

  /// Qachon ishlatilgan (replay oynasi).
  late DateTime usedAt;
}
