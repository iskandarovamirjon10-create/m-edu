import 'package:flutter/services.dart';

import '../../features/settings/infrastructure/services/secure_settings_store.dart';

/// Tugma bosilganda tebranish uchun yordamchi xizmat.
///
/// Foydalanuvchi sozlamalaridagi "Tebranish bildirishnomalari" sozlamasiga
/// bo'ysunadi — o'chirilgan bo'lsa hech narsa qilmaydi. Desktop (Windows/
/// Linux) va web'da `HapticFeedback` qo'llab-quvvatlanmasa ham ilovani
/// buzmaydi (xato yutiladi — xavfsiz no-op).
class AppHaptics {
  AppHaptics._();

  /// Yengil tebranish — tugma bosish uchun (light impact).
  static Future<void> tap() => _fire(HapticFeedback.lightImpact);

  static Future<void> _fire(Future<void> Function() feedback) async {
    // Sozlamadagi gati: tebranish o'chirilgan bo'lsa — hech narsa.
    if (!await SecureSettingsStore().isVibrationEnabled()) return;
    try {
      await feedback();
    } catch (_) {
      // Desktop/web — haptic qo'llab-quvvatlanmaydi, jim o'tkazib yuboramiz.
    }
  }
}
