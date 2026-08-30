import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:google_fonts/google_fonts.dart';

import 'tokens/tokens.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// M-EDU DESIGN SYSTEM v4.0 — THEME BUILDER
///
/// Builds Material 3 ThemeData from DsTokens.
/// Single entry point for both light and dark themes.
/// ═══════════════════════════════════════════════════════════════════════

class DsTheme {
  DsTheme._();

  /// Light theme
  static ThemeData light() => _build(DsColors.light, Brightness.light);

  /// Dark theme
  static ThemeData dark() => _build(DsColors.dark, Brightness.dark);

  static ThemeData _build(DsColors colors, Brightness brightness) {
    final isLight = brightness == Brightness.light;

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      scaffoldBackgroundColor: colors.scaffold,
      visualDensity: VisualDensity.adaptivePlatformDensity,

      // ThemeExtension for DsColors
      extensions: [colors],

      // ─── ColorScheme ──────────────────────────────────────────────
      colorScheme: ColorScheme(
        brightness: brightness,
        primary: colors.accent,
        onPrimary: colors.accentOnAccent,
        primaryContainer: colors.accentSoft,
        onPrimaryContainer: colors.accent,
        secondary: colors.accent,
        onSecondary: colors.accentOnAccent,
        secondaryContainer: colors.accentSoft,
        onSecondaryContainer: colors.accent,
        tertiary: colors.accent,
        onTertiary: colors.accentOnAccent,
        surface: colors.surface,
        onSurface: colors.textPrimary,
        onSurfaceVariant: colors.textSecondary,
        error: colors.error,
        onError: colors.errorOnBg,
        errorContainer: colors.errorBg,
        onErrorContainer: colors.errorOnBg,
        outline: colors.border,
        outlineVariant: colors.divider,
        shadow: colors.scrim,
        scrim: colors.scrim,
        inverseSurface: colors.textPrimary,
        onInverseSurface: colors.scaffold,
        inversePrimary: colors.accent,
      ),

      // ─── Typography ───────────────────────────────────────────────
      textTheme: GoogleFonts.interTextTheme(
        (isLight ? ThemeData.light() : ThemeData.dark()).textTheme.copyWith(
              displayLarge: DsType.display(color: colors.textPrimary),
              displayMedium: DsType.h1(color: colors.textPrimary),
              displaySmall: DsType.h2(color: colors.textPrimary),
              headlineLarge: DsType.h2(color: colors.textPrimary),
              headlineMedium: DsType.h3(color: colors.textPrimary),
              headlineSmall: DsType.h3(color: colors.textPrimary),
              titleLarge: DsType.bodyStrong(color: colors.textPrimary),
              titleMedium: DsType.bodyStrong(color: colors.textPrimary),
              titleSmall: DsType.caption(color: colors.textPrimary),
              bodyLarge: DsType.body(color: colors.textPrimary),
              bodyMedium: DsType.body(color: colors.textSecondary),
              bodySmall: DsType.caption(color: colors.textTertiary),
              labelLarge: DsType.bodyStrong(color: colors.textPrimary),
              labelMedium: DsType.caption(color: colors.textSecondary),
              labelSmall: DsType.overline(color: colors.textTertiary),
            ),
      ),

      // ─── AppBar ───────────────────────────────────────────────────
      appBarTheme: AppBarTheme(
        backgroundColor: colors.scaffold,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: DsType.h3(color: colors.textPrimary),
        iconTheme: IconThemeData(color: colors.textPrimary),
      ),

      // ─── Bottom Navigation ────────────────────────────────────────
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: colors.navBg,
        selectedItemColor: colors.accent,
        unselectedItemColor: colors.textTertiary,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
        selectedLabelStyle: DsType.caption(color: colors.accent),
        unselectedLabelStyle: DsType.caption(color: colors.textTertiary),
      ),

      // ─── Navigation Bar (Material 3) ──────────────────────────────
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: colors.navBg,
        elevation: 0,
        indicatorColor: colors.navIndicator,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return DsType.caption(
            color: selected ? colors.accent : colors.textTertiary,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? colors.accent : colors.textTertiary,
            size: 22,
          );
        }),
      ),

      // ─── Card ─────────────────────────────────────────────────────
      cardTheme: CardThemeData(
        color: colors.card,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: DsRadius.lgAll,
          side: BorderSide(color: colors.border),
        ),
      ),

      // ─── Input ────────────────────────────────────────────────────
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colors.fill,
        border: OutlineInputBorder(
          borderRadius: DsRadius.smAll,
          borderSide: BorderSide(color: colors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: DsRadius.smAll,
          borderSide: BorderSide(color: colors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: DsRadius.smAll,
          borderSide: BorderSide(color: colors.borderFocus, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: DsRadius.smAll,
          borderSide: BorderSide(color: colors.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: DsRadius.smAll,
          borderSide: BorderSide(color: colors.error, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        hintStyle: DsType.body(color: colors.textTertiary),
        labelStyle: DsType.body(color: colors.textSecondary),
        errorStyle: DsType.caption(color: colors.error),
      ),

      // ─── Buttons ──────────────────────────────────────────────────
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: colors.accent,
          foregroundColor: colors.accentOnAccent,
          disabledBackgroundColor: colors.accent.withValues(alpha: 0.4),
          disabledForegroundColor: colors.accentOnAccent.withValues(alpha: 0.6),
          minimumSize: const Size(0, 44),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          shape: RoundedRectangleBorder(borderRadius: DsRadius.smAll),
          textStyle: DsType.bodyStrong(color: colors.accentOnAccent),
          elevation: 0,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: colors.accent,
          disabledForegroundColor: colors.textDisabled,
          minimumSize: const Size(0, 44),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          shape: RoundedRectangleBorder(borderRadius: DsRadius.smAll),
          side: BorderSide(color: colors.border),
          textStyle: DsType.bodyStrong(color: colors.accent),
          elevation: 0,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: colors.accent,
          disabledForegroundColor: colors.textDisabled,
          minimumSize: const Size(0, 44),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          shape: RoundedRectangleBorder(borderRadius: DsRadius.smAll),
          textStyle: DsType.bodyStrong(color: colors.accent),
        ),
      ),

      // ─── FAB ──────────────────────────────────────────────────────
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: colors.accent,
        foregroundColor: colors.accentOnAccent,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: DsRadius.mdAll),
      ),

      // ─── Dialog ───────────────────────────────────────────────────
      dialogTheme: DialogThemeData(
        backgroundColor: colors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: DsRadius.xlAll,
        ),
      ),

      // ─── Bottom Sheet ─────────────────────────────────────────────
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: colors.surface,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        showDragHandle: true,
        dragHandleColor: colors.borderStrong,
      ),

      // ─── Snackbar ─────────────────────────────────────────────────
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: colors.textPrimary,
        contentTextStyle: DsType.body(color: colors.scaffold),
        shape: RoundedRectangleBorder(borderRadius: DsRadius.smAll),
        elevation: 3,
      ),

      // ─── Switch ───────────────────────────────────────────────────
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return colors.accentOnAccent;
          }
          return Colors.white;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return colors.accent;
          }
          return colors.borderStrong;
        }),
      ),

      // ─── Divider ──────────────────────────────────────────────────
      dividerTheme: DividerThemeData(
        color: colors.divider,
        thickness: 1,
        space: 1,
      ),

      // ─── Chip ─────────────────────────────────────────────────────
      chipTheme: ChipThemeData(
        backgroundColor: colors.fill,
        selectedColor: colors.accentSoft,
        disabledColor: colors.fill,
        labelStyle: DsType.caption(),
        side: BorderSide(color: colors.border),
        shape: RoundedRectangleBorder(borderRadius: DsRadius.smAll),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      ),

      // ─── Progress ─────────────────────────────────────────────────
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: colors.accent,
        linearTrackColor: colors.fill,
      ),

      // ─── Tab Bar ──────────────────────────────────────────────────
      tabBarTheme: TabBarThemeData(
        labelColor: colors.accent,
        unselectedLabelColor: colors.textTertiary,
        indicatorColor: colors.accent,
        labelStyle: DsType.bodyStrong(color: colors.accent),
        unselectedLabelStyle: DsType.body(color: colors.textTertiary),
        dividerColor: colors.divider,
        indicatorSize: TabBarIndicatorSize.label,
      ),

      // ─── Page Transitions ─────────────────────────────────────────
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: CupertinoPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.windows: CupertinoPageTransitionsBuilder(),
          TargetPlatform.linux: CupertinoPageTransitionsBuilder(),
        },
      ),
    );
  }
}
