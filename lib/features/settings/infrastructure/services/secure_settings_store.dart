import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Maxfiy sozlamalar ombori (H-06 yechimi).
///
/// Hikvision kamera paroli va Telegram bot tokeni endi Isar'da plaintext
/// saqlanmaydi — qurilmaning shifrlangan xotirasiga (Android Keystore
/// orqali flutter_secure_storage) ko'chiriladi.
///
/// Migratsiya: birinchi o'qishda Isar'da qolgan eski plaintext qiymat
/// avtomatik shu yerga ko'chirilib, Isar'dagi maydon tozalanadi
/// (`SettingsRepositoryImpl.getSettings` ga qarang).
class SecureSettingsStore {
  static const _keyBiometricEnabled = 'm_edu_secure_biometric_enabled';
  static const _keyLastEmail = 'm_edu_secure_last_email';
  static const _keyVibrationEnabled = 'm_edu_secure_vibration_enabled';
  static const _keyDensity = 'm_edu_secure_density';
  static const _keyHikvisionPassword = 'm_edu_secure_hikvision_password';
  static const _keyTelegramBotToken = 'm_edu_secure_telegram_bot_token';

  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  // ─── Biometrik tez kirish ─────────────────────────────────────────────

  /// Biometrik kirish yoqilganmi?
  Future<bool> isBiometricEnabled() async {
    try {
      final value = await _storage.read(key: _keyBiometricEnabled);
      return value == 'true';
    } catch (_) {
      return false;
    }
  }

  Future<void> setBiometricEnabled(bool enabled) async {
    try {
      if (enabled) {
        await _storage.write(key: _keyBiometricEnabled, value: 'true');
      } else {
        await _storage.delete(key: _keyBiometricEnabled);
      }
    } catch (_) {
      // UI bloklanmaydi.
    }
  }

  /// Oxirgi muvaffaqiyatli kirgan hisob email'i.
  ///
  /// Biometrik kirish uchun kerak: parolni qayta so'ramasdan, biometrik
  /// tasdiqlangach shu hisobni tiklashi mumkin.
  Future<String?> readLastEmail() async {
    try {
      return await _storage.read(key: _keyLastEmail);
    } catch (_) {
      return null;
    }
  }

  Future<void> writeLastEmail(String? email) async {
    try {
      if (email == null || email.isEmpty) {
        await _storage.delete(key: _keyLastEmail);
      } else {
        await _storage.write(key: _keyLastEmail, value: email);
      }
    } catch (_) {
      // UI bloklanmaydi.
    }
  }

  // ─── Tebranish bildirishnomalari ───────────────────────────────────────

  /// Hodisalarda telefon tebranishi yoqilganmi? (default: true)
  ///
  /// Yoqilgan holat "default" hisoblanadi — qiymat omborda yozilmagan
  /// bo'lsa ham `true` qaytariladi (yangi qurilmalar uchun ham ishlaydi).
  Future<bool> isVibrationEnabled() async {
    try {
      final value = await _storage.read(key: _keyVibrationEnabled);
      return value != 'false';
    } catch (_) {
      return true;
    }
  }

  Future<void> setVibrationEnabled(bool enabled) async {
    try {
      if (enabled) {
        await _storage.delete(key: _keyVibrationEnabled);
      } else {
        await _storage.write(key: _keyVibrationEnabled, value: 'false');
      }
    } catch (_) {
      // UI bloklanmaydi.
    }
  }

  // ─── UI zichligi (Design System 4.0 §9) ────────────────────────────────

  /// Joriy density rejimi (default: COMFORTABLE).
  ///
  /// Isar sxemasini o'zgartirmasdan secure storage'da saqlanadi —
  /// tebranish/biometrik kabi UI-preference (migratsiya talab qilmaydi).
  Future<String?> readDensity() async {
    try {
      return await _storage.read(key: _keyDensity);
    } catch (_) {
      return null;
    }
  }

  Future<void> writeDensity(String wire) async {
    try {
      await _storage.write(key: _keyDensity, value: wire);
    } catch (_) {
      // UI bloklanmaydi.
    }
  }

  // ─── Hikvision kamera paroli ───────────────────────────────────────────

  Future<String?> readHikvisionPassword() async {
    try {
      return await _storage.read(key: _keyHikvisionPassword);
    } catch (_) {
      return null;
    }
  }

  Future<void> writeHikvisionPassword(String? password) async {
    try {
      if (password == null || password.isEmpty) {
        await _storage.delete(key: _keyHikvisionPassword);
      } else {
        await _storage.write(key: _keyHikvisionPassword, value: password);
      }
    } catch (_) {
      // Ombor ishlamay qolsa UI bloklanmaydi — parol saqlanmagan bo'ladi.
    }
  }

  // ─── Telegram bot tokeni ───────────────────────────────────────────────

  Future<String?> readTelegramBotToken() async {
    try {
      return await _storage.read(key: _keyTelegramBotToken);
    } catch (_) {
      return null;
    }
  }

  Future<void> writeTelegramBotToken(String? token) async {
    try {
      if (token == null || token.isEmpty) {
        await _storage.delete(key: _keyTelegramBotToken);
      } else {
        await _storage.write(key: _keyTelegramBotToken, value: token);
      }
    } catch (_) {
      // Yuqoridagi kabi — xato yutiladi, UI buzilmaydi.
    }
  }
}
