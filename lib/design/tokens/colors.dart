import 'package:flutter/material.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// M-EDU DESIGN SYSTEM v4.0 — COLOR TOKENS
///
/// Single source of truth for ALL colors in the app.
/// Rules:
///   • No dark/black backgrounds — light theme: warm neutral, dark theme: soft slate
///   • All semantic colors have fg + bg + soft variants
///   • WCAG AA contrast (4.5:1 minimum for body text)
///   • No hardcoded Color() outside this file
/// ═══════════════════════════════════════════════════════════════════════

@immutable
class DsColors extends ThemeExtension<DsColors> {
  // ─── Text ────────────────────────────────────────────────────────────
  final Color textPrimary;
  final Color textSecondary;
  final Color textTertiary;
  final Color textDisabled;
  final Color textOnAccent;

  // ─── Surfaces ────────────────────────────────────────────────────────
  final Color scaffold;
  final Color surface;
  final Color surfaceRaised;
  final Color surfaceOverlay;
  final Color fill;
  final Color card;

  // ─── Accent (brand) ──────────────────────────────────────────────────
  final Color accent;
  final Color accentHover;
  final Color accentPressed;
  final Color accentSoft;
  final Color accentOnAccent;

  // ─── Semantic: Success ───────────────────────────────────────────────
  final Color success;
  final Color successBg;
  final Color successOnBg;

  // ─── Semantic: Warning ───────────────────────────────────────────────
  final Color warning;
  final Color warningBg;
  final Color warningOnBg;

  // ─── Semantic: Error ─────────────────────────────────────────────────
  final Color error;
  final Color errorBg;
  final Color errorOnBg;

  // ─── Semantic: Info ──────────────────────────────────────────────────
  final Color info;
  final Color infoBg;
  final Color infoOnBg;

  // ─── Borders ─────────────────────────────────────────────────────────
  final Color border;
  final Color borderStrong;
  final Color borderFocus;

  // ─── Dividers & Separators ──────────────────────────────────────────
  final Color divider;
  final Color dividerStrong;

  // ─── Overlays ────────────────────────────────────────────────────────
  final Color overlay;
  final Color scrim;

  // ─── Navigation ──────────────────────────────────────────────────────
  final Color navBg;
  final Color navIndicator;

  // ─── Gradients ───────────────────────────────────────────────────────
  final LinearGradient accentGradient;
  final LinearGradient scaffoldGradient;

  const DsColors({
    required this.textPrimary,
    required this.textSecondary,
    required this.textTertiary,
    required this.textDisabled,
    required this.textOnAccent,
    required this.scaffold,
    required this.surface,
    required this.surfaceRaised,
    required this.surfaceOverlay,
    required this.fill,
    required this.card,
    required this.accent,
    required this.accentHover,
    required this.accentPressed,
    required this.accentSoft,
    required this.accentOnAccent,
    required this.success,
    required this.successBg,
    required this.successOnBg,
    required this.warning,
    required this.warningBg,
    required this.warningOnBg,
    required this.error,
    required this.errorBg,
    required this.errorOnBg,
    required this.info,
    required this.infoBg,
    required this.infoOnBg,
    required this.border,
    required this.borderStrong,
    required this.borderFocus,
    required this.divider,
    required this.dividerStrong,
    required this.overlay,
    required this.scrim,
    required this.navBg,
    required this.navIndicator,
    required this.accentGradient,
    required this.scaffoldGradient,
  });

  // ═══════════════════════════════════════════════════════════════════════
  // LIGHT THEME — warm neutral, SaaS/fintech professional
  // ═══════════════════════════════════════════════════════════════════════
  static const light = DsColors(
    // Text
    textPrimary: Color(0xFF1A1D23),     // near-black but warm
    textSecondary: Color(0xFF555B66),   // medium gray
    textTertiary: Color(0xFF8B919A),    // light gray
    textDisabled: Color(0xFFBFC3C9),    // very light
    textOnAccent: Color(0xFFFFFFFF),

    // Surfaces — NO pure white bg, use warm off-whites
    scaffold: Color(0xFFF4F5F7),        // warm light gray
    surface: Color(0xFFFFFFFF),         // cards/elevated surfaces
    surfaceRaised: Color(0xFFFFFFFF),   // elevated cards
    surfaceOverlay: Color(0xFFF8F9FB),  // subtle overlay
    fill: Color(0xFFEDEEF2),            // input backgrounds
    card: Color(0xFFFFFFFF),

    // Accent — Sky Blue (professional, trustworthy)
    accent: Color(0xFF3274D9),          // primary blue
    accentHover: Color(0xFF2862BE),     // darker on hover
    accentPressed: Color(0xFF1F4F9E),   // darkest on press
    accentSoft: Color(0xFFE8F0FE),      // light blue bg
    accentOnAccent: Color(0xFFFFFFFF),

    // Success — muted green (not neon)
    success: Color(0xFF1A7F4B),
    successBg: Color(0xFFEBF7EF),
    successOnBg: Color(0xFF1A7F4B),

    // Warning — warm amber
    warning: Color(0xFFB45309),
    warningBg: Color(0xFFFEF3C7),
    warningOnBg: Color(0xFF92400E),

    // Error — muted red (not harsh)
    error: Color(0xFFC53030),
    errorBg: Color(0xFFFEE8E8),
    errorOnBg: Color(0xFFC53030),

    // Info — blue (same family as accent)
    info: Color(0xFF3274D9),
    infoBg: Color(0xFFE8F0FE),
    infoOnBg: Color(0xFF1A4D8C),

    // Borders
    border: Color(0xFFDEE1E6),
    borderStrong: Color(0xFFBFC3C9),
    borderFocus: Color(0xFF3274D9),

    // Dividers
    divider: Color(0xFFEDEEF2),
    dividerStrong: Color(0xFFDEE1E6),

    // Overlays
    overlay: Color(0x661A1D23),
    scrim: Color(0x40000000),

    // Navigation
    navBg: Color(0xFFFFFFFF),
    navIndicator: Color(0xFFE8F0FE),

    // Gradients
    accentGradient: LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [Color(0xFF3274D9), Color(0xFF5B8FE8)],
    ),
    scaffoldGradient: LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [Color(0xFFF4F5F7), Color(0xFFEDEEF2)],
    ),
  );

  // ═══════════════════════════════════════════════════════════════════════
  // DARK THEME — soft slate/charcoal, NEVER pure black
  // ═══════════════════════════════════════════════════════════════════════
  static const dark = DsColors(
    // Text
    textPrimary: Color(0xFFE8EAED),     // off-white
    textSecondary: Color(0xFF9AA0A9),   // medium gray
    textTertiary: Color(0xFF6B7280),    // dim gray
    textDisabled: Color(0xFF4B5058),    // very dim
    textOnAccent: Color(0xFFFFFFFF),

    // Surfaces — soft charcoal, warm undertone
    scaffold: Color(0xFF1E2028),        // warm dark gray (NOT black)
    surface: Color(0xFF262830),         // cards
    surfaceRaised: Color(0xFF2C2F38),   // elevated
    surfaceOverlay: Color(0xFF32353E),  // overlay
    fill: Color(0xFF2C2F38),            // input bg
    card: Color(0xFF262830),

    // Accent — lighter blue for dark bg contrast
    accent: Color(0xFF6BA3E8),
    accentHover: Color(0xFF82B5F0),
    accentPressed: Color(0xFF9DC7F5),
    accentSoft: Color(0xFF1E2D45),
    accentOnAccent: Color(0xFF0D1B2E),

    // Success — brighter green for dark bg
    success: Color(0xFF4ADE80),
    successBg: Color(0xFF0D3320),
    successOnBg: Color(0xFF4ADE80),

    // Warning — brighter amber
    warning: Color(0xFFFBBF24),
    warningBg: Color(0xFF3D2E0A),
    warningOnBg: Color(0xFFFBBF24),

    // Error — brighter red
    error: Color(0xFFEF6B6B),
    errorBg: Color(0xFF3D1515),
    errorOnBg: Color(0xFFEF6B6B),

    // Info — lighter blue
    info: Color(0xFF6BA3E8),
    infoBg: Color(0xFF1E2D45),
    infoOnBg: Color(0xFF6BA3E8),

    // Borders
    border: Color(0xFF3A3D46),
    borderStrong: Color(0xFF4B5058),
    borderFocus: Color(0xFF6BA3E8),

    // Dividers
    divider: Color(0xFF2C2F38),
    dividerStrong: Color(0xFF3A3D46),

    // Overlays
    overlay: Color(0x80000000),
    scrim: Color(0x60000000),

    // Navigation
    navBg: Color(0xFF1E2028),
    navIndicator: Color(0xFF1E2D45),

    // Gradients
    accentGradient: LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [Color(0xFF6BA3E8), Color(0xFF8B7BF0)],
    ),
    scaffoldGradient: LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [Color(0xFF1E2028), Color(0xFF18191F)],
    ),
  );

  @override
  DsColors copyWith({
    Color? textPrimary,
    Color? textSecondary,
    Color? textTertiary,
    Color? textDisabled,
    Color? textOnAccent,
    Color? scaffold,
    Color? surface,
    Color? surfaceRaised,
    Color? surfaceOverlay,
    Color? fill,
    Color? card,
    Color? accent,
    Color? accentHover,
    Color? accentPressed,
    Color? accentSoft,
    Color? accentOnAccent,
    Color? success,
    Color? successBg,
    Color? successOnBg,
    Color? warning,
    Color? warningBg,
    Color? warningOnBg,
    Color? error,
    Color? errorBg,
    Color? errorOnBg,
    Color? info,
    Color? infoBg,
    Color? infoOnBg,
    Color? border,
    Color? borderStrong,
    Color? borderFocus,
    Color? divider,
    Color? dividerStrong,
    Color? overlay,
    Color? scrim,
    Color? navBg,
    Color? navIndicator,
    LinearGradient? accentGradient,
    LinearGradient? scaffoldGradient,
  }) {
    return DsColors(
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textTertiary: textTertiary ?? this.textTertiary,
      textDisabled: textDisabled ?? this.textDisabled,
      textOnAccent: textOnAccent ?? this.textOnAccent,
      scaffold: scaffold ?? this.scaffold,
      surface: surface ?? this.surface,
      surfaceRaised: surfaceRaised ?? this.surfaceRaised,
      surfaceOverlay: surfaceOverlay ?? this.surfaceOverlay,
      fill: fill ?? this.fill,
      card: card ?? this.card,
      accent: accent ?? this.accent,
      accentHover: accentHover ?? this.accentHover,
      accentPressed: accentPressed ?? this.accentPressed,
      accentSoft: accentSoft ?? this.accentSoft,
      accentOnAccent: accentOnAccent ?? this.accentOnAccent,
      success: success ?? this.success,
      successBg: successBg ?? this.successBg,
      successOnBg: successOnBg ?? this.successOnBg,
      warning: warning ?? this.warning,
      warningBg: warningBg ?? this.warningBg,
      warningOnBg: warningOnBg ?? this.warningOnBg,
      error: error ?? this.error,
      errorBg: errorBg ?? this.errorBg,
      errorOnBg: errorOnBg ?? this.errorOnBg,
      info: info ?? this.info,
      infoBg: infoBg ?? this.infoBg,
      infoOnBg: infoOnBg ?? this.infoOnBg,
      border: border ?? this.border,
      borderStrong: borderStrong ?? this.borderStrong,
      borderFocus: borderFocus ?? this.borderFocus,
      divider: divider ?? this.divider,
      dividerStrong: dividerStrong ?? this.dividerStrong,
      overlay: overlay ?? this.overlay,
      scrim: scrim ?? this.scrim,
      navBg: navBg ?? this.navBg,
      navIndicator: navIndicator ?? this.navIndicator,
      accentGradient: accentGradient ?? this.accentGradient,
      scaffoldGradient: scaffoldGradient ?? this.scaffoldGradient,
    );
  }

  @override
  DsColors lerp(DsColors? other, double t) {
    if (other is! DsColors) return this;
    return DsColors(
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textTertiary: Color.lerp(textTertiary, other.textTertiary, t)!,
      textDisabled: Color.lerp(textDisabled, other.textDisabled, t)!,
      textOnAccent: Color.lerp(textOnAccent, other.textOnAccent, t)!,
      scaffold: Color.lerp(scaffold, other.scaffold, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceRaised: Color.lerp(surfaceRaised, other.surfaceRaised, t)!,
      surfaceOverlay: Color.lerp(surfaceOverlay, other.surfaceOverlay, t)!,
      fill: Color.lerp(fill, other.fill, t)!,
      card: Color.lerp(card, other.card, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      accentHover: Color.lerp(accentHover, other.accentHover, t)!,
      accentPressed: Color.lerp(accentPressed, other.accentPressed, t)!,
      accentSoft: Color.lerp(accentSoft, other.accentSoft, t)!,
      accentOnAccent: Color.lerp(accentOnAccent, other.accentOnAccent, t)!,
      success: Color.lerp(success, other.success, t)!,
      successBg: Color.lerp(successBg, other.successBg, t)!,
      successOnBg: Color.lerp(successOnBg, other.successOnBg, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      warningBg: Color.lerp(warningBg, other.warningBg, t)!,
      warningOnBg: Color.lerp(warningOnBg, other.warningOnBg, t)!,
      error: Color.lerp(error, other.error, t)!,
      errorBg: Color.lerp(errorBg, other.errorBg, t)!,
      errorOnBg: Color.lerp(errorOnBg, other.errorOnBg, t)!,
      info: Color.lerp(info, other.info, t)!,
      infoBg: Color.lerp(infoBg, other.infoBg, t)!,
      infoOnBg: Color.lerp(infoOnBg, other.infoOnBg, t)!,
      border: Color.lerp(border, other.border, t)!,
      borderStrong: Color.lerp(borderStrong, other.borderStrong, t)!,
      borderFocus: Color.lerp(borderFocus, other.borderFocus, t)!,
      divider: Color.lerp(divider, other.divider, t)!,
      dividerStrong: Color.lerp(dividerStrong, other.dividerStrong, t)!,
      overlay: Color.lerp(overlay, other.overlay, t)!,
      scrim: Color.lerp(scrim, other.scrim, t)!,
      navBg: Color.lerp(navBg, other.navBg, t)!,
      navIndicator: Color.lerp(navIndicator, other.navIndicator, t)!,
      accentGradient: LinearGradient.lerp(accentGradient, other.accentGradient, t) ?? accentGradient,
      scaffoldGradient: LinearGradient.lerp(scaffoldGradient, other.scaffoldGradient, t) ?? scaffoldGradient,
    );
  }
}

/// Convenience extension: `context.dsColors`
extension DsColorsContextX on BuildContext {
  DsColors get dsColors =>
      Theme.of(this).extension<DsColors>() ?? DsColors.light;
}
