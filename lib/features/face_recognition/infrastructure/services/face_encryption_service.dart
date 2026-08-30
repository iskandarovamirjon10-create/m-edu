import 'dart:convert';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../../core/services/app_logger.dart';

/// Yuz imzolarini (biometrik ma'lumot) shifrlash xizmati (H-03).
///
/// Face signature — sensitive biometric data: Isar'da plaintext
/// saqlanmasligi uchun [AesGcm] (AES-256-GCM) bilan shifrlanadi.
///
/// Encryption key **source code'ga hardcode qilinmaydi** — Android
/// Keystore/secure storage (flutter_secure_storage) orqali qurilmada
/// yaratiladi va saqlanadi. Boshqa qurilmalarga ko'chirilmaydi (bu
/// local-only biometric bazaning at-rest himoyasi uchun maqsadli
/// yechim).
///
/// ⚠️ AGAR secure storage kalitni saqlay olmasa, sessiya kaliti
/// yaratiladi. Qayta ishga tushganda yangi kalit — eski enrolled
/// yuzlar O'QILMAYDI (enrollment qayta kerak). Bu holat log qilinadi.
class FaceEncryptionService {
  static const _keyStorageName = 'm_edu_face_encryption_key';

  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  final AesGcm _algorithm = AesGcm.with256bits();

  SecretKey? _cachedKey;

  /// O'qish/yozish uchun shifrlash kalitini ta'minlaydi.
  ///
  /// Kalit faqat bir marta yaratiladi va secure storage'da saqlanadi.
  Future<SecretKey> _getKey() async {
    if (_cachedKey != null) return _cachedKey!;

    try {
      final stored = await _storage.read(key: _keyStorageName);
      if (stored != null && stored.isNotEmpty) {
        final raw = base64Decode(stored);
        if (raw.length == 32) {
          return _cachedKey = SecretKey(raw);
        }
      }
    } catch (e) {
      // Secure storage o'qib bo'lmadi — yangi kalit yaratamiz.
      AppLogger.warning('FaceEncryption: key read failed (${e.runtimeType}) — generating session key');
    }

    // Yangi tasodifiy 256-bit kalit.
    final key = await _algorithm.newSecretKey();
    try {
      final bytes = await key.extractBytes();
      await _storage.write(
        key: _keyStorageName,
        value: base64Encode(bytes),
      );
    } catch (e) {
      // Kalit saqlanmadi — sessiya davomida ishlaydi, qayta ishga
      // tushganda yangisi yaratiladi (eski imzolar o'qilmaydi; bu
      // holat kamdan-kam, lekin xavfsizlik uchun plaintext qayta
      // saqlashdan yaxshiroq).
      AppLogger.error('FaceEncryption: key persist failed (${e.runtimeType}) — enrollment data may be lost on restart');
    }
    return _cachedKey = key;
  }

  /// Imzo vektorini shifrlab, saqlash uchun bayt massiviga aylantiradi.
  ///
  /// Format: [12-byte nonce][ciphertext][16-byte MAC] — [SecretBox]'ning
  /// TO'LIQ tarkibi. AES-GCM'da authentication tag (MAC) decrypt uchun
  /// majburiy: tag saqlanmasa decrypt har doim muvaffaqiyatsiz bo'ladi
  /// va integrity tekshiruvi yo'qoladi.
  Future<Uint8List> encrypt(List<double> vector) async {
    final key = await _getKey();
    final json = jsonEncode(vector);
    final box = await _algorithm.encrypt(
      utf8.encode(json),
      secretKey: key,
    );

    final nonce = box.nonce;
    final mac = box.mac.bytes;
    final combined =
        Uint8List(nonce.length + box.cipherText.length + mac.length);
    combined.setRange(0, nonce.length, nonce);
    combined.setRange(
      nonce.length,
      nonce.length + box.cipherText.length,
      box.cipherText,
    );
    combined.setRange(
      nonce.length + box.cipherText.length,
      combined.length,
      mac,
    );
    return combined;
  }

  /// Shifrlangan imzoni asl vektorga qaytaradi.
  ///
  /// Format: [12-byte nonce][ciphertext][16-byte MAC]. MAC tekshiriladi —
  /// ma'lumot buzilgan yoki kalit o'zgargan bo'lsa `null` qaytadi.
  ///
  /// Eslatma: H-03'ning eski (buzuq) formati — tag'siz `nonce+ciphertext`
  /// — decrypt bo'lmaydi (u shunday ham hech qachon ochilmas edi), lekin
  /// xato tashlamaydi: `null` qaytadi va yuz qayta enroll qilinadi.
  Future<List<double>?> decrypt(Uint8List blob) async {
    if (blob.isEmpty) return null;
    try {
      final key = await _getKey();
      // Birinchi 12 bayt — nonce, oxirgi 16 bayt — MAC/tag
      // (AesGcm uchun standart o'lchamlar).
      const nonceLength = 12;
      const macLength = 16;
      if (blob.length <= nonceLength + macLength) return null;
      final nonce = blob.sublist(0, nonceLength);
      final mac = blob.sublist(blob.length - macLength);
      final cipherText = blob.sublist(nonceLength, blob.length - macLength);
      final clear = await _algorithm.decrypt(
        SecretBox(cipherText, nonce: nonce, mac: Mac(mac)),
        secretKey: key,
      );
      final decoded = jsonDecode(utf8.decode(clear)) as List<dynamic>;
      return decoded.map((e) => (e as num).toDouble()).toList();
    } catch (e) {
      // Kalit o'zgarganda yoki ma'lumot buzilganda — null qaytaramiz,
      // app ishdan chiqmaydi. Foydalanuvchi yuzni qayta enroll qiladi.
      // P1-01 FIX: structured logging — silent catch emas, monitoring uchun
      // qayta ishlash xatosi log qilinadi (biometrik ma'lumot emas).
      AppLogger.warning('FaceEncryption: decrypt failed (${e.runtimeType}) — signature may need re-enrollment');
      return null;
    }
  }
}
