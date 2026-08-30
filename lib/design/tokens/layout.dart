import 'package:flutter/material.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// M-EDU DESIGN SYSTEM v4.0 — SPACING, RADIUS, SHADOW
/// ═══════════════════════════════════════════════════════════════════════

/// SPACING — 8pt grid rhythm
class DsSpacing {
  DsSpacing._();

  static const double xxs = 2;
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;
  static const double xxxl = 48;
  static const double xxxxl = 64;

  /// Common EdgeInsets
  static const EdgeInsets pageH = EdgeInsets.symmetric(horizontal: 16);
  static const EdgeInsets pageHXl = EdgeInsets.symmetric(horizontal: 24);
  static const EdgeInsets cardAll = EdgeInsets.all(16);
  static const EdgeInsets cardAllLg = EdgeInsets.all(24);
  static const EdgeInsets rowH = EdgeInsets.symmetric(horizontal: 16, vertical: 12);
  static const EdgeInsets rowHSm = EdgeInsets.symmetric(horizontal: 12, vertical: 8);
}

/// BORDER RADIUS
class DsRadius {
  DsRadius._();

  static const double xs = 6;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double full = 999;

  static BorderRadius get xsAll => BorderRadius.circular(xs);
  static BorderRadius get smAll => BorderRadius.circular(sm);
  static BorderRadius get mdAll => BorderRadius.circular(md);
  static BorderRadius get lgAll => BorderRadius.circular(lg);
  static BorderRadius get xlAll => BorderRadius.circular(xl);
  static BorderRadius get fullAll => BorderRadius.circular(full);
}

/// SHADOW / ELEVATION
class DsShadow {
  DsShadow._();

  /// Level 0 — no shadow
  static List<BoxShadow> get none => const [];

  /// Level 1 — subtle card lift
  static List<BoxShadow> get low => const [
        BoxShadow(color: Color(0x0A0F172A), blurRadius: 3, offset: Offset(0, 1)),
      ];

  /// Level 2 — card hover / dropdown
  static List<BoxShadow> get medium => const [
        BoxShadow(color: Color(0x140F172A), blurRadius: 8, offset: Offset(0, 2)),
      ];

  /// Level 3 — popover, modal
  static List<BoxShadow> get high => const [
        BoxShadow(color: Color(0x1A0F172A), blurRadius: 16, offset: Offset(0, 4)),
      ];

  /// Level 4 — floating elements
  static List<BoxShadow> get floating => const [
        BoxShadow(color: Color(0x240F172A), blurRadius: 24, offset: Offset(0, 8)),
      ];

  /// Brand glow — accent-colored glow for hero elements.
  static List<BoxShadow> glow(Color color, {double intensity = 0.35}) => [
        BoxShadow(
          color: color.withValues(alpha: intensity),
          blurRadius: 20,
          offset: const Offset(0, 6),
          spreadRadius: -2,
        ),
      ];
}

/// BREAKPOINTS
enum DsBreakpoint { compact, tablet, desktop, wide }

extension DsBreakpointX on DsBreakpoint {
  static DsBreakpoint fromWidth(double w) {
    if (w < 600) return DsBreakpoint.compact;
    if (w < 900) return DsBreakpoint.tablet;
    if (w < 1440) return DsBreakpoint.desktop;
    return DsBreakpoint.wide;
  }

  bool get isCompact => this == DsBreakpoint.compact;
  bool get isMobile => this == DsBreakpoint.compact;
  bool get isDesktop =>
      this == DsBreakpoint.desktop || this == DsBreakpoint.wide;

  double get horizontalPadding => switch (this) {
        DsBreakpoint.compact => 16,
        DsBreakpoint.tablet => 20,
        DsBreakpoint.desktop => 24,
        DsBreakpoint.wide => 32,
      };

  double get contentMaxWidth => switch (this) {
        DsBreakpoint.compact => double.infinity,
        DsBreakpoint.tablet => double.infinity,
        DsBreakpoint.desktop => 1200,
        DsBreakpoint.wide => 1440,
      };

  bool get showSidebar => this == DsBreakpoint.desktop ||
      this == DsBreakpoint.wide;

  bool get showBottomNav => this == DsBreakpoint.compact;
}

/// Context extension for breakpoint
extension DsBreakpointContextX on BuildContext {
  DsBreakpoint get dsBreakpoint =>
      DsBreakpointX.fromWidth(MediaQuery.sizeOf(this).width);
}
