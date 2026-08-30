import 'package:flutter/material.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// M-EDU DENSITY SYSTEM (Design System 4.0 §9)
///
/// COMPACT / COMFORTABLE / SPACIOUS — UI zichligi.
///   compact     — desktop administratorlar (ma'lumot zichligi yuqori)
///   comfortable — DEFAULT (barcha platformalar uchun muvozanat)
///   spacious    — touch-first foydalanuvchilar (kattaroq target'lar)
///
/// Density faqat SPATIAL qarorlarga ta'sir qiladi: row/control balandligi,
/// padding, gap. Typography ierarxiyasi O'ZGARMAYDI (§9: "They must NOT
/// randomly change typography hierarchy").
///
/// Qiymat [AppDensityScope] orqali context'ga uzatiladi —
/// `context.appDensity` bilan o'qiladi. Feature'lar to'g'ridan-to'g'ri
/// hardcode qiymat ishlatmaydi: [AppDensity.spacing] scale'iga murojaat
/// qiladi.
/// ═══════════════════════════════════════════════════════════════════════

/// UI zichligi rejimi.
enum AppDensity {
  compact,
  comfortable,
  spacious;

  /// Android/iOS interaktiv nazorat elementlari uchun minimal touch
  /// target (Design Constitution v4.0 §G/§AC INVARIANT: 48×48dp).
  /// Vizual glif kichikroq bo'lishi mumkin — hit area kamida 48dp.
  static const double minTouchTarget = 48;

  /// Saqlash/ulash format (SecureSettingsStore).
  String get wire => name;

  /// Wire string'dan — noma'lum qiymatda COMFORTABLE (fail-safe).
  static AppDensity fromWire(String? value) {
    for (final density in AppDensity.values) {
      if (density.wire == value) return density;
    }
    return AppDensity.comfortable;
  }

  /// Row/control balandligi uchun 4px-qadam asosidagi ko'paytuvchi.
  double get scale => switch (this) {
        AppDensity.compact => 0.875,
        AppDensity.comfortable => 1.0,
        AppDensity.spacious => 1.125,
      };

  /// Gap'lardagi ko'paytuvchi (bo'shliqlar yumshoqroq siqiladi).
  double get gapScale => switch (this) {
        AppDensity.compact => 0.75,
        AppDensity.comfortable => 1.0,
        AppDensity.spacious => 1.25,
      };

  /// Standart row balandligi (logical px, 4px ritm).
  double get rowHeight => switch (this) {
        AppDensity.compact => 36,
        AppDensity.comfortable => 44,
        AppDensity.spacious => 52,
      };

  /// Standart control (tugma/input) balandligi.
  double get controlHeight => switch (this) {
        AppDensity.compact => 36,
        AppDensity.comfortable => 44,
        AppDensity.spacious => 52,
      };

  /// List/grid item vertikal paddingsi.
  double get verticalPadding => switch (this) {
        AppDensity.compact => 8,
        AppDensity.comfortable => 12,
        AppDensity.spacious => 16,
      };
}

/// Joriy density qiymatini subtree'ga uzatuvchi scope.
class AppDensityScope extends InheritedWidget {
  final AppDensity density;

  const AppDensityScope({
    super.key,
    required this.density,
    required super.child,
  });

  static AppDensity of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppDensityScope>();
    return scope?.density ?? AppDensity.comfortable;
  }

  @override
  bool updateShouldNotify(AppDensityScope oldWidget) =>
      oldWidget.density != density;
}

/// `context.appDensity` — joriy zichlik (scope bo'lmasa COMFORTABLE).
extension AppDensityContextX on BuildContext {
  AppDensity get appDensity => AppDensityScope.of(this);

  /// [value] ni joriy density scale bilan ko'paytirish (row/control uchun).
  double densityScale(double value) => value * appDensity.scale;

  /// [value] ni joriy density gap scale bilan ko'paytirish (bo'shliqlar).
  double densityGap(double value) => value * appDensity.gapScale;

  /// Sensorli platforma (Android/iOS/Fuchsia) — v4.0 §G touch target
  /// qoidasi faqat shu platformalarga taalluqli; desktop density
  /// rejimlariga tegmaydi (v4.0 §F density — desktop konsepti).
  bool get isTouchPlatform => switch (Theme.of(this).platform) {
        TargetPlatform.android ||
        TargetPlatform.iOS ||
        TargetPlatform.fuchsia =>
          true,
        _ => false,
      };

  /// [height] ni touch platformada kamida [AppDensity.minTouchTarget]
  /// (48dp) qiladi; desktop'da o'zgartirmaydi (C-38).
  double touchTargetFloor(double height) =>
      isTouchPlatform && height < AppDensity.minTouchTarget
          ? AppDensity.minTouchTarget
          : height;

  /// Joriy density bo'yicha interaktiv nazorat balandligi — touch
  /// platformada 48dp pastki chegarasi bilan (C-38).
  double get interactiveControlHeight =>
      touchTargetFloor(appDensity.controlHeight);
}
