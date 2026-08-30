import 'package:flutter/material.dart';

import '../tokens/tokens.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// ⚠️ TEMPORARY COMPATIBILITY SHIM — DELETE AFTER FULL MIGRATION
///
/// This file maps old AppTheme.* static constants to new DsColors tokens.
/// It exists ONLY to allow incremental migration of 54 screens.
///
/// RULES:
///   1. New screens MUST use DsColors directly (context.dsColors)
///   2. Old screens may temporarily use AppThemeCompat.* during migration
///   3. Each screen migrated MUST remove its AppThemeCompat imports
///   4. After ALL 54 screens are migrated, this file is DELETED
///   5. No new code may reference this file
///
/// CREATED: Phase 1 — Shared Legacy Component Bridge
/// DELETE AFTER: Phase 13 (all screens migrated)
/// ═══════════════════════════════════════════════════════════════════════

@Deprecated('Use context.dsColors instead. This shim is temporary.')
class AppThemeCompat {
  AppThemeCompat._();

  // ─── Semantic colors (map to DsColors) ──────────────────────────────
  static Color get primary => DsColors.light.accent;
  static Color get primaryLight => const Color(0xFF5B8FE8);
  static Color get secondary => const Color(0xFF5B6CEF);

  static Color get textPrimary => DsColors.light.textPrimary;
  static Color get textSecondary => DsColors.light.textSecondary;
  static Color get textTertiary => DsColors.light.textTertiary;

  static Color get success => DsColors.light.success;
  static Color get warning => DsColors.light.warning;
  static Color get error => DsColors.light.error;
  static Color get info => DsColors.light.info;

  static Color get separator => DsColors.light.divider;
  static Color get separatorStrong => DsColors.light.dividerStrong;

  static Color get backgroundLight => DsColors.light.scaffold;
  static Color get backgroundDark => DsColors.dark.scaffold;
  static Color get cardLight => DsColors.light.card;
  static Color get cardDark => DsColors.dark.card;

  static Color get fillLight => DsColors.light.fill;

  // ─── Gradients (legacy names) ───────────────────────────────────────
  static const LinearGradient liquidCyan = LinearGradient(
    colors: [Color(0xFF3274D9), Color(0xFF5B8FE8)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient liquidPurple = LinearGradient(
    colors: [Color(0xFF5B6CEF), Color(0xFF9B6CEF)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient liquidGreen = LinearGradient(
    colors: [Color(0xFF1A7F4B), Color(0xFF34A853)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient liquidGold = LinearGradient(
    colors: [Color(0xFFB45309), Color(0xFFD97706)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient brandGradient = LinearGradient(
    colors: [Color(0xFF3274D9), Color(0xFF5B6CEF)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // ─── Legacy "liquid" names ──────────────────────────────────────────
  static Color get liquidBg => DsColors.light.surface;
  static Color get liquidBorder => DsColors.light.border;
  static Color get liquidShadow => const Color(0x1A000000);
  static Color get liquidFrostLight => DsColors.light.surface;
  static Color get liquidFrostDark => DsColors.dark.surface;
  static Color get liquidSpecular => const Color(0x59FFFFFF);
  static Color get liquidEdgeLight => DsColors.light.border;
  static Color get liquidEdgeDark => DsColors.dark.border;

  // ─── Aurora (legacy names) ──────────────────────────────────────────
  static Color get auroraBlue => DsColors.light.accent;
  static Color get auroraViolet => const Color(0xFF5B6CEF);
  static Color get auroraPink => const Color(0xFFEC4899);
  static Color get auroraTeal => const Color(0xFF14B8A6);
  static Color get auroraGold => DsColors.light.warning;
}
