import 'dart:convert';
import 'dart:math';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../domain/services/signed_qr_codec.dart';
import '../datasources/isar_qr_nonce_store.dart';

/// Signed QR natijasi (verify zanjiri).
enum SignedQrVerificationStatus {
  /// Imzo to'g'ri, amal qilmagan, replay emas — davom etish mumkin.
  valid,

  /// Format noto'g'ri yoki imzo buzilgan — "QR kod yaroqsiz".
  malformed,

  /// Imzo tasdiqlanmadi (kalit mos emas / ma'lumot buzilgan).
  invalidSignature,

  /// Amal qilish muddati tugagan — "QR kod muddati tugagan".
  expired,

  /// Shu nonce avval ishlatilgan — replay hujumi.
  replay,
}

/// Signed QR tekshiruv natijasi.
class SignedQrVerificationResult {
  final SignedQrVerificationStatus status;

  /// `valid` bo'lganda — tasdiqlangan student identifikatori.
  final String? studentId;

  const SignedQrVerificationResult(this.status, [this.studentId]);

  bool get isValid => status == SignedQrVerificationStatus.valid;
}

/// Signed QR — Ed25519 asosidagi imzolash va tekshirish (P1.5).
///
/// Imzolash kaliti **source code'ga hardcode qilinmaydi** — qurilmada
/// yaratiladi va flutter_secure_storage (Android Keystore / iOS Keychain)
/// orqali saqlanadi. Kalit yo'qolsa (yangi qurilma/kalit) — eski QR'lar
/// rad etiladi, yangi QR karta'dan olinadi (yuz bazasidagi kabi xavfsiz
/// xatti-harakat; plaintext fallback yo'q).
///
/// Verify zanjiri (spec §6):
/// ```text
/// QR → parse → signature verify → expiry check → replay protection
///   → student resolve → activeLesson resolve → attendance command
/// ```
class SignedQrService {
  static const String _keyStorageName = 'm_edu_signed_qr_signing_key';

  final FlutterSecureStorage _storage;
  final IsarQrNonceStore _nonceStore;
  final Ed25519 _algorithm = Ed25519();
  final Random _random = Random.secure();

  SimpleKeyPair? _cachedKeyPair;

  /// Oxirgi nonce tozalash vaqti — soatiga ko'pi bilan 1 marta (isrofgarchilik
  /// yo'q, lekin to'plam cheksiz o'smaydi).
  DateTime? _lastPrunedAt;

  SignedQrService({
    FlutterSecureStorage storage = const FlutterSecureStorage(),
    required IsarQrNonceStore nonceStore,
  })  : _storage = storage,
        _nonceStore = nonceStore;

  /// Student uchun yangi signed QR matnini chiqaradi.
  ///
  /// Har bir chiqarishda yangi tasodifiy nonce ishlatiladi — bir xil
  /// student uchun chiqarilgan ikki QR bir-biridan farq qiladi va
  /// (nonce replay himoyasi tufayli) faqat bir marta ishlatilishi mumkin.
  Future<String> issue(
    String studentId, {
    DateTime? now,
    Duration? validity,
  }) async {
    await _pruneIfDue();
    final issuedAt = (now ?? DateTime.now()).toUtc();
    final keyPair = await _getKeyPair();
    final nonce = _randomNonce();

    final payload = SignedQrPayload(
      studentId: studentId,
      issuedAt: issuedAt,
      expiresAt: issuedAt.add(validity ?? SignedQrCodec.defaultValidity),
      nonce: nonce,
      signature: '',
    );

    final signature = await _algorithm.sign(
      utf8.encode(payload.signedData),
      keyPair: keyPair,
    );

    return SignedQrCodec.encode(
      studentId: payload.studentId,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      nonce: payload.nonce,
      signature: base64Url.encode(signature.bytes),
    );
  }

  /// QR matnini to'liq tekshiradi (parse → imzo → muddat → replay).
  Future<SignedQrVerificationResult> verify(
    String raw,
    DateTime now,
  ) async {
    await _pruneIfDue();
    final payload = SignedQrCodec.decode(raw);
    if (payload == null) {
      return const SignedQrVerificationResult(
        SignedQrVerificationStatus.malformed,
      );
    }

    // ── 1) Imzo tekshiruvi ─────────────────────────────────────────────
    List<int> signatureBytes;
    try {
      signatureBytes = base64Url.decode(payload.signature);
    } on FormatException {
      return const SignedQrVerificationResult(
        SignedQrVerificationStatus.invalidSignature,
      );
    }
    // cryptography 2.x: public key `Signature` ichida ko'chib yuradi —
    // verify o'sha kalitga nisbatan tekshiradi.
    final keyPair = await _getKeyPair();
    final publicKey = await keyPair.extractPublicKey();
    final verified = await _algorithm.verify(
      utf8.encode(payload.signedData),
      signature: Signature(signatureBytes, publicKey: publicKey),
    );
    if (!verified) {
      return const SignedQrVerificationResult(
        SignedQrVerificationStatus.invalidSignature,
      );
    }

    // ── 2) Amal qilish muddati ─────────────────────────────────────────
    if (payload.isExpiredAt(now)) {
      return const SignedQrVerificationResult(
        SignedQrVerificationStatus.expired,
      );
    }

    // ── 3) Replay himoyasi ─────────────────────────────────────────────
    if (await _nonceStore.contains(payload.nonce)) {
      return const SignedQrVerificationResult(
        SignedQrVerificationStatus.replay,
      );
    }
    await _nonceStore.add(payload.nonce, payload.studentId, now.toUtc());

    return SignedQrVerificationResult(
      SignedQrVerificationStatus.valid,
      payload.studentId,
    );
  }

  /// Eskirgan nonce yozuvlarini tozalaydi (saqlangan QR muddatidan oldingi).
  ///
  /// `issue`/`verify` ichidan soatiga ko'pi bilan bir marta chaqiriladi —
  /// nonce to'plami cheksiz o'smaydi, lekin har skanerlashda DB yuklanmaydi.
  Future<int> pruneExpiredNonces({Duration? maxAge}) async {
    final cutoff = DateTime.now()
        .subtract(maxAge ?? SignedQrCodec.defaultValidity)
        .toUtc();
    return _nonceStore.pruneBefore(cutoff);
  }

  Future<void> _pruneIfDue() async {
    final now = DateTime.now();
    final last = _lastPrunedAt;
    if (last != null && now.difference(last) < const Duration(hours: 1)) {
      return;
    }
    _lastPrunedAt = now;
    try {
      await pruneExpiredNonces();
    } catch (_) {
      // Tozalash muvaffaqiyatsiz bo'lsa keyingi chaqiruvda qayta uriniladi
      // (attendance yozuvi bloklanmaydi).
    }
  }

  Future<SimpleKeyPair> _getKeyPair() async {
    if (_cachedKeyPair != null) return _cachedKeyPair!;

    try {
      final stored = await _storage.read(key: _keyStorageName);
      if (stored != null && stored.isNotEmpty) {
        final seed = base64Url.decode(stored);
        if (seed.length == 32) {
          return _cachedKeyPair = await _algorithm.newKeyPairFromSeed(seed);
        }
      }
    } catch (_) {
      // Secure storage o'qib bo'lmadi — yangi kalit yaratamiz.
    }

    // Yangi tasodifiy 256-bit seed (Ed25519: private key = seed).
    final keyPair = await _algorithm.newKeyPair();
    final seed = await keyPair.extractPrivateKeyBytes();
    try {
      await _storage.write(
        key: _keyStorageName,
        value: base64Url.encode(seed),
      );
    } catch (_) {
      // Kalit saqlanmadi — sessiya davomida ishlaydi, qayta ishga
      // tushganda yangisi yaratiladi (eski QR'lar rad etiladi — xavfsiz
      // default, plaintext fallback yo'q).
    }
    return _cachedKeyPair = keyPair;
  }

  /// 128-bit tasodifiy nonce (base64url).
  String _randomNonce() {
    final bytes = List<int>.generate(SignedQrCodec.nonceLengthBytes, (_) {
      return _random.nextInt(256);
    });
    return base64Url.encode(bytes);
  }
}
