/// Signed QR payload — P1.5 (spec §3, QR security).
///
/// QR endi oddiy student ID EMAS: payload tarkibida `studentId` (xavfsiz
/// identifikator), `issuedAt`, `expiresAt`, `nonce` (replay himoyasi) va
/// `signature` (Ed25519) bor. Sensitive ma'lumot plaintext bo'lmaydi —
/// signature barcha maydonlar ustidan hisoblanadi.
///
/// Kanonik format (`~` — maydon ajratuvchi; ISO vaqtlardagi `:` bilan
/// ziddiyatga kirmaydi):
///
/// ```text
/// M-EDU:V2~{studentId}~{issuedAtIso}~{expiresAtIso}~{nonceB64}~{sigB64}
/// ```
///
/// Imzolanadigan qism — `signature`'siz dastlabki 5 maydon (`signedData`).
/// Codec PURE Dart — kriptografiyaga bog'liq emas, unit test oson.
library;

/// Signed QR payload (o'qilgan/qurilgan holat).
class SignedQrPayload {
  /// Xavfsiz student identifikatori (Identity.identityId).
  final String studentId;

  /// Chiqarilgan vaqt (UTC).
  final DateTime issuedAt;

  /// Amal qilish muddati tugash vaqti (UTC).
  final DateTime expiresAt;

  /// Replay himoyasi uchun tasodifiy nonce (base64url, 16 bayt).
  final String nonce;

  /// Ed25519 imzosi (base64url, 64 bayt).
  final String signature;

  const SignedQrPayload({
    required this.studentId,
    required this.issuedAt,
    required this.expiresAt,
    required this.nonce,
    required this.signature,
  });

  /// Imzolanadigan kanonik qism — `signature`'siz.
  String get signedData =>
      '${SignedQrCodec.prefix}~$studentId~${_iso(issuedAt)}~${_iso(expiresAt)}~$nonce';

  /// To'liq QR matni.
  String get encoded => '$signedData~$signature';

  bool isExpiredAt(DateTime now) => !now.isBefore(expiresAt);

  static String _iso(DateTime t) => t.toUtc().toIso8601String();
}

/// Signed QR matnini encode/decode qiluvchi pure codec.
class SignedQrCodec {
  /// Format prefiksi (eski oddiy ID'lar `M-EDU-{id}` — bu prefiksga mos
  /// kelmaydi, shuning uchun avtomatik rad etiladi).
  static const String prefix = 'M-EDU:V2';

  /// Standart amal qilish muddati: 24 soat.
  static const Duration defaultValidity = Duration(hours: 24);

  /// Nonce uzunligi (bayt) — 128-bit xavfsizlik darajasi.
  static const int nonceLengthBytes = 16;

  /// Ed25519 imzo uzunligi (bayt).
  static const int signatureLengthBytes = 64;

  SignedQrCodec._();

  /// Maydonlardan to'liq QR matnini quradi (imzo tashqaridan keladi).
  static String encode({
    required String studentId,
    required DateTime issuedAt,
    required DateTime expiresAt,
    required String nonce,
    required String signature,
  }) {
    return SignedQrPayload(
      studentId: studentId,
      issuedAt: issuedAt,
      expiresAt: expiresAt,
      nonce: nonce,
      signature: signature,
    ).encoded;
  }

  /// QR matnini tahlil qiladi. Format mos bo'lmasa — `null` (yaroqsiz).
  static SignedQrPayload? decode(String raw) {
    final parts = raw.split('~');
    // 6 maydon: prefix, studentId, issuedAt, expiresAt, nonce, signature.
    if (parts.length != 6) return null;
    if (parts[0] != prefix) return null;

    final issuedAt = DateTime.tryParse(parts[2]);
    final expiresAt = DateTime.tryParse(parts[3]);
    if (issuedAt == null || expiresAt == null) return null;
    if (parts[1].isEmpty || parts[4].isEmpty || parts[5].isEmpty) return null;
    // Yaroqsiz o'lchamdagi imzo ham yaroqsiz deb hisoblanadi.
    if (_b64Length(parts[5]) != signatureLengthBytes) return null;
    if (_b64Length(parts[4]) < nonceLengthBytes) return null;

    return SignedQrPayload(
      studentId: parts[1],
      issuedAt: issuedAt,
      expiresAt: expiresAt,
      nonce: parts[4],
      signature: parts[5],
    );
  }

  /// Base64url matnning bayt uzunligini hisoblaydi.
  ///
  /// `=` padding e'tiborga olinmaydi (Dart `base64Url.encode` padding
  /// qo'shishi mumkin — 64-bayt imzo 88 ta belgi + `==` bo'ladi).
  static int _b64Length(String s) {
    final withoutPadding = s.replaceAll('=', '');
    return (withoutPadding.length * 6) ~/ 8;
  }
}
