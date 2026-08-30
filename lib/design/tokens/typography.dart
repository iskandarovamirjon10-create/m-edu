import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// M-EDU DESIGN SYSTEM v4.0 — TYPOGRAPHY
///
/// Scale (based on 1.25 modular ratio):
///   display  — 32px/700 — login hero, onboarding
///   h1       — 24px/700 — page title
///   h2       — 18px/600 — section/card title
///   h3       — 16px/600 — subsection
///   body     — 14px/400 — default text
///   bodySm   — 13px/400 — compact list text
///   caption  — 12px/500 — labels, metadata
///   overline — 11px/600 — UPPERCASE badges
///   numeric  — 24px/700 — KPI values (tabular figures)
///
/// Font: Inter (Google Fonts) — clean, professional, excellent readability
/// ═══════════════════════════════════════════════════════════════════════

class DsType {
  DsType._();

  static TextStyle _base({
    required double size,
    required FontWeight weight,
    double? height,
    double letterSpacing = 0,
    List<FontFeature>? fontFeatures,
  }) =>
      GoogleFonts.inter(
        fontSize: size,
        fontWeight: weight,
        height: height ?? 1.4,
        letterSpacing: letterSpacing,
        fontFeatures: fontFeatures,
      );

  static TextStyle _tabular(TextStyle s) => s.copyWith(
        fontFeatures: const [FontFeature.tabularFigures()],
      );

  // ─── Scale ──────────────────────────────────────────────────────────

  /// 32px/700 — hero, onboarding
  static TextStyle display({Color? color}) => _base(
        size: 32,
        weight: FontWeight.w700,
        height: 1.2,
        letterSpacing: -0.02,
      ).copyWith(color: color);

  /// 24px/700 — page title
  static TextStyle h1({Color? color}) => _base(
        size: 24,
        weight: FontWeight.w700,
        height: 1.25,
        letterSpacing: -0.01,
      ).copyWith(color: color);

  /// 18px/600 — section title
  static TextStyle h2({Color? color}) => _base(
        size: 18,
        weight: FontWeight.w600,
        height: 1.3,
      ).copyWith(color: color);

  /// 16px/600 — subsection
  static TextStyle h3({Color? color}) => _base(
        size: 16,
        weight: FontWeight.w600,
        height: 1.35,
      ).copyWith(color: color);

  /// 14px/400 — body text
  static TextStyle body({Color? color}) => _base(
        size: 14,
        weight: FontWeight.w400,
        height: 1.5,
      ).copyWith(color: color);

  /// 14px/600 — emphasized body
  static TextStyle bodyStrong({Color? color}) => _base(
        size: 14,
        weight: FontWeight.w600,
        height: 1.5,
      ).copyWith(color: color);

  /// 13px/400 — compact list text
  static TextStyle bodySm({Color? color}) => _base(
        size: 13,
        weight: FontWeight.w400,
        height: 1.45,
      ).copyWith(color: color);

  /// 12px/500 — caption, metadata
  static TextStyle caption({Color? color}) => _base(
        size: 12,
        weight: FontWeight.w500,
        height: 1.4,
        letterSpacing: 0.01,
      ).copyWith(color: color);

  /// 11px/600 UPPERCASE — badges, overlines
  static TextStyle overline({Color? color}) => _base(
        size: 11,
        weight: FontWeight.w600,
        height: 1.3,
        letterSpacing: 0.06,
      ).copyWith(color: color);

  // ─── Numeric (tabular figures) ──────────────────────────────────────

  /// 24px/700 tabular — KPI display
  static TextStyle statLarge({Color? color}) => _tabular(_base(
        size: 24,
        weight: FontWeight.w700,
        height: 1.2,
        letterSpacing: -0.01,
      )).copyWith(color: color);

  /// 18px/600 tabular — stat value
  static TextStyle statValue({Color? color}) => _tabular(_base(
        size: 18,
        weight: FontWeight.w600,
        height: 1.3,
      )).copyWith(color: color);

  /// 14px/600 tabular — stat label
  static TextStyle statLabel({Color? color}) => _tabular(_base(
        size: 14,
        weight: FontWeight.w600,
        height: 1.4,
      )).copyWith(color: color);

  /// 12px/500 — inline labels, tags
  static TextStyle label({Color? color}) => _base(
        size: 12,
        weight: FontWeight.w500,
        height: 1.35,
      ).copyWith(color: color);

  /// 13px/600 monospace — code, IDs
  static TextStyle mono({Color? color, double size = 13}) =>
      GoogleFonts.jetBrainsMono(
        fontSize: size,
        fontWeight: FontWeight.w600,
        height: 1.3,
        color: color,
        fontFeatures: const [FontFeature.tabularFigures()],
      );
}
