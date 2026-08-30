import 'package:flutter/widgets.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// M-EDU RESPONSIVE GRID (Design System 4.0 §10)
///
/// Breakpointlar DEVICE NOMI bilan emas, AVAILABLE WIDTH bilan aniqlanadi:
///   COMPACT       < 600px      — mobil
///   TABLET        600–899px    — planshet (collapsible nav)
///   DESKTOP       900–1439px   — sidebar + workspace
///   WIDE DESKTOP  ≥ 1440px     — maksimal kontent kengligi cheklanadi
///
/// `context.appBreakpoint` — joriy mode (LayoutBuilder/MediaQuery asosida).
/// Sahifalar shu tokenlar bilan ishlaydi — device nomlariga bog'lanmaydi.
///
/// Grid qoidalari (12-column professional grid):
///   contentMaxWidth — kontentning maksimal kengligi (wide'da cheklanadi)
///   horizontalPadding — sahifa chetlari
///   columnCount / gutter — grid hisob-kitoblari uchun
///   sidebar behavior — §11-12: desktop'da sidebar, tablet'da collapsible,
///                      mobile'da bottom nav
/// ═══════════════════════════════════════════════════════════════════════

/// Breakpoint rejimi.
enum AppBreakpoint {
  compact,
  tablet,
  desktop,
  wideDesktop;

  /// Joriy kenglikdan rejimni aniqlash.
  static AppBreakpoint fromWidth(double width) {
    if (width < 600) return AppBreakpoint.compact;
    if (width < 900) return AppBreakpoint.tablet;
    if (width < 1440) return AppBreakpoint.desktop;
    return AppBreakpoint.wideDesktop;
  }

  /// Kontent maksimal kengligi (wide desktop'da chiziq haddan tashqari
  /// uzun bo'lmasligi uchun).
  double get contentMaxWidth => switch (this) {
        AppBreakpoint.compact => double.infinity,
        AppBreakpoint.tablet => double.infinity,
        AppBreakpoint.desktop => 1440,
        AppBreakpoint.wideDesktop => 1600,
      };

  /// Sahifa chetlari — horizontal padding (4px ritm).
  double get horizontalPadding => switch (this) {
        AppBreakpoint.compact => 20,
        AppBreakpoint.tablet => 24,
        AppBreakpoint.desktop => 32,
        AppBreakpoint.wideDesktop => 32,
      };

  /// 12-column grid: qancha ustun ko'rinadi.
  int get columnCount => switch (this) {
        AppBreakpoint.compact => 4,
        AppBreakpoint.tablet => 8,
        AppBreakpoint.desktop => 12,
        AppBreakpoint.wideDesktop => 12,
      };

  /// Grid gutter'i.
  double get gutter => switch (this) {
        AppBreakpoint.compact => 12,
        AppBreakpoint.tablet => 16,
        AppBreakpoint.desktop => 20,
        AppBreakpoint.wideDesktop => 24,
      };

  /// Sidebar xatti-harakati (§11-12).
  AppSidebarBehavior get sidebar => switch (this) {
        AppBreakpoint.compact => AppSidebarBehavior.bottomNavigation,
        AppBreakpoint.tablet => AppSidebarBehavior.collapsible,
        AppBreakpoint.desktop => AppSidebarBehavior.visible,
        AppBreakpoint.wideDesktop => AppSidebarBehavior.visible,
      };

  // ─── Qulay nomlar ─────────────────────────────────────────────────────
  bool get isMobile => this == AppBreakpoint.compact;
  bool get isTablet => this == AppBreakpoint.tablet;
  bool get isDesktop =>
      this == AppBreakpoint.desktop || this == AppBreakpoint.wideDesktop;

  /// Sahifa padding'i (EdgeInsets).
  EdgeInsets get pagePadding => EdgeInsets.symmetric(
        horizontal: horizontalPadding,
        vertical: 24,
      );
}

/// Sidebar ko'rinishi (§11-12).
enum AppSidebarBehavior {
  /// Mobil — pastki navigatsiya.
  bottomNavigation,

  /// Tablet — collapsible navigation.
  collapsible,

  /// Desktop — doimiy ko'rinadigan sidebar.
  visible,
}

/// `context.appBreakpoint` — joriy rejim.
extension AppBreakpointContextX on BuildContext {
  AppBreakpoint get appBreakpoint =>
      AppBreakpoint.fromWidth(MediaQuery.sizeOf(this).width);

  /// Eski `width >= 900` qoidalari bilan moslik uchun qulaylik.
  bool get isDesktopBreakpoint => appBreakpoint.isDesktop;
}
