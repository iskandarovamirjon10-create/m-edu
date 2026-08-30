import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart' show Icons, IconData;
import 'package:local_auth/local_auth.dart' show BiometricType, LocalAuthentication, AuthenticationOptions;

/// Qurilma biometrikasi (barmoq izi / Face ID) bilan tez kirish xizmati.
///
/// Auth'ning to'liq o'rnini bosmaydi — parol bilan birinchi kirishdan
/// keyin keyingi kirishlarni tezlashtiradi. Biometrik tasdiqlash
/// muvaffaqiyatli bo'lsa, oxirgi hisob sessiyasi tiklanadi.
///
/// Xavfsizlik modeli:
/// - Biometrik kalit qurilmada saqlanmaydi — faqat joriy foydalanuvchi
///   ekanligini tasdiqlaydi (local_auth qurilma darajasida tasdiqlaydi).
/// - Oxirgi hisob email'i [SecureSettingsStore]'da shifrlangan holda
///   saqlanadi va faqat biometrik muvaffaqiyatli bo'lgach ishlatiladi.
class BiometricService {
  BiometricService._();

  static final LocalAuthentication _auth = LocalAuthentication();

  /// Qurilmada biometrik mavjud va ulanganmi?
  ///
  /// Linux'da local_auth qo'llab-quvvatlanmaydi (plugin ro'yxatda yo'q) —
  /// MissingPluginException yutiladi va false qaytadi.
  static Future<bool> isAvailable() async {
    if (kIsWeb) return false;
    try {
      // `||` — ayrim qurilmalarda bitta tekshiruv xato bo'lishi mumkin;
      // biometrik umuman yo'q bo'lsa authenticate() baribir muvaffaqiyatsiz
      // bo'ladi (graceful).
      final canCheck = await _auth.canCheckBiometrics;
      final isDeviceSupported = await _auth.isDeviceSupported();
      return canCheck || isDeviceSupported;
    } catch (_) {
      return false;
    }
  }

  /// Mavjud biometrik turlari (odatda barmoq izi yoki Face ID).
  static Future<List<BiometricType>> availableTypes() async {
    try {
      return await _auth.getAvailableBiometrics();
    } catch (_) {
      return const [];
    }
  }

  /// Foydalanuvchidan biometrik tasdiqlashni so'raydi.
  ///
  /// Muvaffaqiyatli bo'lsa `true`. Foydalanuvchi bekor qilsa yoki
  /// tasdiqlash muvaffaqiyatsiz bo'lsa — `false`.
  static Future<bool> authenticate({
    String reason = 'Tez kirish uchun barmoq izi yoki yuzni tasdiqlang',
  }) async {
    if (kIsWeb) return false;
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
        ),
      );
    } catch (_) {
      return false;
    }
  }

  /// Dizayn uchun: biometrik turiga qarab mos ikona.
  static IconData iconFor(BiometricType type) {
    return switch (type) {
      BiometricType.face => Icons.face_rounded,
      BiometricType.iris => Icons.visibility_rounded,
      BiometricType.strong || BiometricType.weak => Icons.fingerprint,
      _ => Icons.fingerprint,
    };
  }
}
