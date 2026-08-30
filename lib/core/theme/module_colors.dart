import 'package:flutter/material.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// MODUL AKSENT RANGLARI — Liquid Glass Design System v3.1 (§1.4)
///
/// Har bir modul o'ziga xos aksent rangga ega (docs/LIQUID_GLASS_TOKENS.md).
/// Bu ranglar tema'ga bog'liq EMAS — identity/aksent ranglar, dark mode'da
/// ham o'zgarmaydi (spec: dark palitra faqat neutral/glass ni qamraydi).
///
/// Qoida: hardcoded rang yozilmaydi — modul kontekstida faqat shu
/// tokenlar ishlatiladi.
/// ═══════════════════════════════════════════════════════════════════════
class AppModuleColors {
  AppModuleColors._();

  /// Student — asosiy brend rangi bilan bir xil (eng markaziy modul).
  static const Color student = Color(0xFF4A6CF7);

  /// Teacher — zumrad yashil.
  static const Color teacher = Color(0xFF00B37E);

  /// Attendance — to'q sariq.
  static const Color attendance = Color(0xFFFF9500);

  /// Payment — yashil (moliyaviy — pul rangi).
  static const Color payment = Color(0xFF34C759);

  /// Payment qarzdorlik — qizil (salbiy holat).
  static const Color paymentDebt = Color(0xFFFF3B30);

  /// Schedule — binafsha.
  static const Color schedule = Color(0xFFAF52DE);

  /// Reports — och ko'k.
  static const Color reports = Color(0xFF5AC8FA);

  /// CRM/Leads — pushti-qizil.
  static const Color crm = Color(0xFFFF6482);

  /// Certificates — oltin sariq (premium/yutuq hissi).
  static const Color certificates = Color(0xFFFFD60A);

  /// Grades — firuza.
  static const Color grades = Color(0xFF30D5C8);

  /// Inventory — neytral kulrang.
  static const Color inventory = Color(0xFF8E8E93);

  /// Notifications.
  static const Color notifications = Color(0xFFFF9F0A);
}

/// ═══════════════════════════════════════════════════════════════════════
/// KAMERA / FACE UI RANGLARI — Liquid Glass Design System v3.1 (§1.6)
///
/// Face recognition va kamera oqimlaridagi maxsus holat ranglari.
/// Tema'ga bog'liq emas (camera.spec §1.6).
/// ═══════════════════════════════════════════════════════════════════════
class AppCameraColors {
  AppCameraColors._();

  /// Yuz skanerlash animatsiyasi doira rangi (pulsating).
  static const Color scanning = Color(0xFF4A6CF7);

  /// Tanish muvaffaqiyatli.
  static const Color success = Color(0xFF34C759);

  /// Tanish muvaffaqiyatsiz.
  static const Color failed = Color(0xFFFF3B30);

  /// Jonlilik tekshiruvi jarayonida (ko'z pirpiratish so'ralganda).
  static const Color livenessCheck = Color(0xFFFFD60A);
}
