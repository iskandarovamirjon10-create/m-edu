import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;

/// ═══════════════════════════════════════════════════════════════════════
/// PLATFORM CAPABILITIES — YAGONA MANBA (CONTRACT §B6, §B7)
///
/// Barcha platformaga xos farqlar shu yerda aniqlanadi.
/// Kodda `if (Platform.isWindows)` sochilib yotmasligi kerak —
/// faqat shu abstraksiya orqali tekshirilishi lozim.
///
/// QOIDALAR:
///   1. Har bir imkoniyat uchun tushuntirish (nima uchun yo'q)
///   2. UI'da tushuntirish matni mavjud bo'lishi kerak
///   3. Platform farqi qonuniy bo'lsa — abstraksiya orqali, izohlangan
///   4. Platform farqi bug bo'lsa — tuzatiladi
/// ═══════════════════════════════════════════════════════════════════════

/// Platform imkoniyatlari — bitta yagona manba.
///
/// Har bir xususiyat uchun:
/// - [supported] — bu platformada mavjudmi
/// - [reason] — nima uchun yo'q (agar yo'q bo'lsa)
/// - [uiExplanation] — foydalanuvchiga ko'rsatiladigan tushuntirish
abstract final class PlatformCapabilities {
  // ─── Autentifikatsiya ────────────────────────────────────────────────

  /// Google Sign-In mavjudmi?
  static bool get isGoogleSignInSupported => true;

  /// Biometrik autentifikatsiya mavjudmi?
  ///
  /// Android: fingerprint sensor yoki face sensor
  /// Windows: Windows Hello (agar hardware mavjud bo'lsa)
  /// iOS: Face ID yoki Touch ID
  static bool get isBiometricSupported => !kIsWeb;

  /// Biometrik uchun UI tushuntirishi.
  static String get biometricUnavailableReason {
    if (kIsWeb) return 'Veb-versiyada biometrik kirish qo\'llab-quvvatlanmaydi';
    return 'Bu qurilmada biometrik autentifikatsiya mavjud emas';
  }

  // ─── Kamera / Yuz tanish ─────────────────────────────────────────────

  /// Ichki kamera mavjudmi (mobil qurilmalarda).
  static bool get hasBuiltInCamera =>
      Platform.isAndroid || Platform.isIOS || Platform.isMacOS;

  /// USB/veb-kamera mavjudmi (desktop qurilmalarda).
  static bool get hasUsbCamera =>
      Platform.isWindows || Platform.isLinux;

  /// IP-kamera (Hikvision) mavjudmi — barcha platformalarda.
  static bool get hasIpCamera => true;

  /// Yuz tanish uchun kamera mavjudmi?
  static bool get isFaceRecognitionSupported =>
      hasBuiltInCamera || hasUsbCamera || hasIpCamera;

  /// Kamera topilmagan holatda UI tushuntirishi.
  static String get cameraUnavailableReason {
    if (Platform.isWindows) {
      return 'Kamera topilmadi. USB veb-kamera yoki IP-kamera (Hikvision) ulang.';
    }
    if (Platform.isAndroid) {
      return 'Kamera topilmadi. Ilova kamera ruxsatiga muhtoj.';
    }
    return 'Kamera topilmadi.';
  }

  // ─── Bildirishnomalar ────────────────────────────────────────────────

  /// Push notification (FCM) qo'llab-quvvatlanadimi?
  ///
  /// Android: ha (FCM)
  /// Windows: web-push orqali mumkin (lekin to'liq emas)
  /// iOS: ha (APNs + FCM)
  static bool get isPushNotificationSupported => true;

  /// Tebranish (vibration) mavjudmi?
  ///
  /// Android/iOS: ha
  /// Windows/Linux/macOS: yo'q (hardware cheklov)
  static bool get isVibrationSupported =>
      Platform.isAndroid || Platform.isIOS;

  /// Tebranish yo'q bo'lganda muqobil signal.
  static String get vibrationFallbackDescription {
    if (Platform.isWindows) return 'Ekran miltillashi';
    if (Platform.isLinux) return 'Tizim ogohlantirishi';
    return 'Hech qanday muqobil signal';
  }

  // ─── Printer ─────────────────────────────────────────────────────────

  /// Bluetooth thermal printer mavjudmi?
  ///
  /// Android: ha
  /// Windows: Bluetooth mavjud bo'lsa mumkin (lekin kamdan-kam)
  static bool get isBluetoothPrinterSupported =>
      Platform.isAndroid || Platform.isIOS;

  /// USB printer mavjudmi?
  ///
  /// Windows: ha (USB/Network printer)
  /// Android: yo'q (USB OTG orqali mumkin, lekin kam uchraydi)
  static bool get isUsbPrinterSupported =>
      Platform.isWindows || Platform.isLinux;

  /// Tarmoq (network) printer mavjudmi?
  ///
  /// Windows: ha (IPP/LPD protokol)
  /// Android: yo'q
  static bool get isNetworkPrinterSupported =>
      Platform.isWindows || Platform.isLinux;

  /// Printer mavjud emasligida UI tushuntirishi.
  static String get printerUnavailableReason {
    if (Platform.isWindows) {
      return 'Windows: USB yoki tarmoq printerini ulang. Bluetooth printer ham mumkin.';
    }
    if (Platform.isAndroid) {
      return 'Android: Bluetooth thermal printer ulang.';
    }
    return 'Printer topilmadi.';
  }

  // ─── Fayl tizimi ─────────────────────────────────────────────────────

  /// Backup fayli saqlanadigan joy.
  static String get backupDirectoryDescription {
    if (Platform.isWindows) return 'Documents/M-Edu/Backup';
    if (Platform.isAndroid) return 'Ilova xotirasi (app-specific)';
    if (Platform.isIOS) return 'Ilova xotirasi (app-specific)';
    if (Platform.isMacOS) return '~/Documents/M-Edu/Backup';
    if (Platform.isLinux) return '~/Documents/M-Edu/Backup';
    return 'Ilova xotirasi';
  }

  /// Backup fayl formati — BARCHA platformalarda BIR XIL.
  static String get backupFormat => 'JSON (UTF-8, versioned schema)';

  // ─── Klaviatura navigatsiyasi ────────────────────────────────────────

  /// Klaviatura navigatsiyasi to'liq ishlaydimi?
  ///
  /// Windows/Linux/macOS: ha (Tab, Enter, Esc, Arrow keys)
  /// Android: yo'q (touch-based)
  static bool get isKeyboardNavigationSupported =>
      Platform.isWindows || Platform.isLinux || Platform.isMacOS;

  // ─── Ishga tushirish ─────────────────────────────────────────────────

  /// Platformaga xos ishga tushirish tavsifi.
  static String get startupDescription {
    if (Platform.isWindows) return 'Windows: Isar DB + Firebase + Sync scheduler';
    if (Platform.isAndroid) return 'Android: Isar DB + Firebase + Sync scheduler + Kamera ruxsati';
    return 'Platform: Isar DB + Firebase + Sync scheduler';
  }

  // ─── Umumiy ──────────────────────────────────────────────────────────

  /// Platform nomi (UI uchun).
  static String get platformName {
    if (Platform.isWindows) return 'Windows';
    if (Platform.isAndroid) return 'Android';
    if (Platform.isIOS) return 'iOS';
    if (Platform.isMacOS) return 'macOS';
    if (Platform.isLinux) return 'Linux';
    return 'Web';
  }

  /// Platform farqi qonuniymi yoki bugmi — har bir xususiyat uchun.
  static PlatformDifference classifyFeature(String feature) {
    return switch (feature) {
      'vibration' => PlatformDifference(
          isLegal: true,
          reason: 'Windows/Linux PC tebranmaydi — bu apparat cheklov',
          uiText: 'Tebranish bu qurilmada mavjud emas',
        ),
      'usb_printer' => PlatformDifference(
          isLegal: true,
          reason: 'Android\'da USB printer kam uchraydi, Windows\'da bu asosiy usul',
          uiText: 'USB printer faqat Windows\'da qo\'llab-quvvatlanadi',
        ),
      'bluetooth_printer' => PlatformDifference(
          isLegal: true,
          reason: 'Windows\'da Bluetooth printer kam ishlatiladi',
          uiText: 'Bluetooth printer asosan mobil qurilmalar uchun',
        ),
      'camera_type' => PlatformDifference(
          isLegal: true,
          reason: 'Mobil qurilmalar ichki kamera, Windows tashqi kameradan foydalanadi',
          uiText: 'Kamera turi platformaga qarab farq qilishi mumkin',
        ),
      'biometric_hardware' => PlatformDifference(
          isLegal: true,
          reason: 'Windows Hello faqat mos hardware bo\'lsa ishlaydi',
          uiText: 'Bu qurilmada biometrik autentifikatsiya mavjud emas',
        ),
      _ => PlatformDifference(
          isLegal: false,
          reason: 'Noma\'lum platform farqi — tekshirish kerak',
          uiText: '',
        ),
    };
  }
}

/// Platform farqi tavsifi.
class PlatformDifference {
  final bool isLegal;
  final String reason;
  final String uiText;

  const PlatformDifference({
    required this.isLegal,
    required this.reason,
    required this.uiText,
  });
}
