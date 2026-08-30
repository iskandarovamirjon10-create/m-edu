import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

export 'app_colors.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// M-EDU DESIGN SYSTEM v3.2 — THEME DATA
///
/// v3.2 §2.1 palitrasi asosida yaratilgan.
/// Har qanday hardcoded rang yozilmaydi — faqat AppColors tokenlari.
/// ═══════════════════════════════════════════════════════════════════════
class AppTheme {
  AppTheme._();

  /// ═══ ALIGNED WITH DsColors (v4.0) ══════════════════════════════════
  /// These static constants now match the new Design System tokens.
  /// Screens should migrate to context.dsColors.* instead.

  /// Brand — matches DsColors.light.accent
  static const Color primary = Color(0xFF3274D9);
  static const Color primaryLight = Color(0xFF5B8FE8);
  static const Color secondary = Color(0xFF5B6CEF);

  /// Text — matches DsColors.light.text*
  static const Color textPrimary = Color(0xFF1A1D23);
  static const Color textSecondary = Color(0xFF555B66);
  static const Color textTertiary = Color(0xFF8B919A);

  /// Semantic — matches DsColors.light.success/warning/error/info
  static const Color success = Color(0xFF1A7F4B);
  static const Color warning = Color(0xFFB45309);
  static const Color error = Color(0xFFC53030);
  static const Color info = Color(0xFF3274D9);

  // ─── Backward compatible static constants ─────────────────────────────
  static const Color backgroundLight = Color(0xFFF4F5F7);
  static const Color backgroundDark = Color(0xFF1E2028);
  static const Color cardLight = Color(0xFFFFFFFF);
  static const Color cardDark = Color(0xFF262830);
  static const Color liquidBg = Color(0xFFFFFFFF);
  static const Color liquidBorder = Color(0xFFDEE1E6);
  static const Color liquidShadow = Color(0x1A000000);
  static const Color secondaryLight = Color(0xFF5B6CEF);
  static const Color textPrimaryDark = Color(0xFFE8EAED);
  static const Color textSecondaryDark = Color(0xFF9AA0A9);
  static const Color fillLight = Color(0xFFEDEEF2);
  static const Color liquidFrostLight = Color(0xFFFFFFFF);
  static const Color liquidFrostDark = Color(0xFF262830);
  static const Color liquidSpecular = Color(0x59FFFFFF);
  static const Color liquidEdgeLight = Color(0xFFDEE1E6);
  static const Color liquidEdgeDark = Color(0xFF3A3D46);
  static const Color auroraBlue = Color(0xFF3274D9);
  static const Color auroraViolet = Color(0xFF5B6CEF);
  static const Color auroraPink = Color(0xFFEC4899);
  static const Color auroraTeal = Color(0xFF14B8A6);
  static const Color auroraGold = Color(0xFFB45309);
  static const LinearGradient liquidCyan = LinearGradient(
    colors: [Color(0xFF3274D9), Color(0xFF5B6CEF)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient liquidPurple = LinearGradient(
    colors: [Color(0xFF5B6CEF), Color(0xFFEC4899)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient liquidGreen = LinearGradient(
    colors: [Color(0xFF22C55E), Color(0xFF14B8A6)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient liquidGold = LinearGradient(
    colors: [Color(0xFFF59E0B), Color(0xFFFBBF24)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient brandGradient = LinearGradient(
    colors: [Color(0xFF3274D9), Color(0xFF5B6CEF)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Border (v3.2 §2.1.4).
  static const Color separator = Color(0xFFEDEEF2);

  /// Page transitions (v3.2 §3.2).
  static const PageTransitionsTheme smoothPageTransitions =
      PageTransitionsTheme(
        builders: {
          TargetPlatform.android: _SmoothPageTransitionsBuilder(),
          TargetPlatform.iOS: _SmoothPageTransitionsBuilder(),
          TargetPlatform.macOS: _SmoothPageTransitionsBuilder(),
          TargetPlatform.windows: _SmoothPageTransitionsBuilder(),
          TargetPlatform.linux: _SmoothPageTransitionsBuilder(),
          TargetPlatform.fuchsia: _SmoothPageTransitionsBuilder(),
        },
      );

  /// YORUG' REJIM — Neomorphism Premium.
  static ThemeData get iOS27Theme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: const Color(0xFFF4F5F7),
      visualDensity: VisualDensity.adaptivePlatformDensity,
      extensions: const [AppColors.light],
      colorScheme: const ColorScheme.light(
        primary: Color(0xFF3274D9),
        secondary: Color(0xFF5B6CEF),
        surface: Color(0xFFFFFFFF),
        error: Color(0xFFEF4444),
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        onSurface: Color(0xFF1A1D23),
        onError: Colors.white,
        outline: Color(0xFFDEE1E6),
      ),
      pageTransitionsTheme: smoothPageTransitions,
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: const Color(0xFF1A1D23),
        contentTextStyle: GoogleFonts.inter(
          fontSize: 14,
          color: Colors.white,
          fontWeight: FontWeight.w500,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        elevation: 4,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: Color(0xFF3274D9),
        foregroundColor: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(16)),
        ),
      ),
      iconTheme: const IconThemeData(color: Color(0xFF3274D9)),
      textTheme: GoogleFonts.interTextTheme(
        ThemeData.light().textTheme.copyWith(
              displayLarge: GoogleFonts.inter(
                fontSize: 34,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF1A1D23),
              ),
              displayMedium: GoogleFonts.inter(
                fontSize: 28,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF1A1D23),
              ),
              headlineLarge: GoogleFonts.inter(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF1A1D23),
              ),
              headlineMedium: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF1A1D23),
              ),
              titleLarge: GoogleFonts.inter(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF1A1D23),
              ),
              titleMedium: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: const Color(0xFF1A1D23),
              ),
              bodyLarge: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w400,
                color: const Color(0xFF1A1D23),
              ),
              bodyMedium: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w400,
                color: const Color(0xFF555B66),
              ),
              labelLarge: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF1A1D23),
                letterSpacing: 0.5,
              ),
            ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: const Color(0xFFF4F5F7),
        elevation: 0,
        centerTitle: true,
        titleTextStyle: GoogleFonts.inter(
          fontSize: 17,
          fontWeight: FontWeight.w600,
          color: const Color(0xFF1A1D23),
        ),
        iconTheme: const IconThemeData(color: Color(0xFF3274D9)),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Color(0xFFFFFFFF),
        selectedItemColor: Color(0xFF3274D9),
        unselectedItemColor: Color(0xFF555B66),
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
      cardTheme: CardThemeData(
        color: const Color(0xFFFFFFFF),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFFEDEEF2),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFF3274D9), width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFEF4444)),
        ),
        labelStyle: const TextStyle(color: Color(0xFF555B66)),
        hintStyle: const TextStyle(color: Color(0xFF9AA0A9)),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF3274D9),
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle:
              GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600),
          elevation: 0,
        ),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          return Colors.white;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const Color(0xFF3274D9);
          }
          return const Color(0xFFBFC3C9);
        }),
      ),
      dividerTheme: const DividerThemeData(
        color: Color(0xFFDEE1E6),
        thickness: 1,
        space: 0,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: const Color(0xFFFFFFFF),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
      ),
    );
  }

  /// QORONG'U REJIM — Neomorphism Premium.
  static ThemeData get iOS27DarkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: const Color(0xFF1E2028),
      visualDensity: VisualDensity.adaptivePlatformDensity,
      extensions: const [AppColors.dark],
      colorScheme: const ColorScheme.dark(
        primary: Color(0xFF60A5FA),
        secondary: Color(0xFF818CF8),
        surface: Color(0xFF262830),
        error: Color(0xFFFCA5A5),
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        onSurface: Color(0xFFE8EAED),
        onError: Colors.black,
        outline: Color(0xFF3A3D46),
      ),
      pageTransitionsTheme: smoothPageTransitions,
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: const Color(0xFF3A3D46),
        contentTextStyle: GoogleFonts.inter(
          fontSize: 14,
          color: Colors.white,
          fontWeight: FontWeight.w500,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        elevation: 4,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: Color(0xFF60A5FA),
        foregroundColor: Color(0xFF1E2028),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(16)),
        ),
      ),
      iconTheme: const IconThemeData(color: Color(0xFF60A5FA)),
      textTheme: GoogleFonts.interTextTheme(
        ThemeData.dark().textTheme.copyWith(
              displayLarge: GoogleFonts.inter(
                fontSize: 34,
                fontWeight: FontWeight.w700,
                color: const Color(0xFFE8EAED),
              ),
              displayMedium: GoogleFonts.inter(
                fontSize: 28,
                fontWeight: FontWeight.w700,
                color: const Color(0xFFE8EAED),
              ),
              headlineLarge: GoogleFonts.inter(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: const Color(0xFFE8EAED),
              ),
              headlineMedium: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: const Color(0xFFE8EAED),
              ),
              titleLarge: GoogleFonts.inter(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: const Color(0xFFE8EAED),
              ),
              titleMedium: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: const Color(0xFFE8EAED),
              ),
              bodyLarge: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w400,
                color: const Color(0xFFE8EAED),
              ),
              bodyMedium: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w400,
                color: const Color(0xFF9AA0A9),
              ),
              labelLarge: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: const Color(0xFFE8EAED),
                letterSpacing: 0.5,
              ),
            ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: const Color(0xFF1E2028),
        elevation: 0,
        centerTitle: true,
        titleTextStyle: GoogleFonts.inter(
          fontSize: 17,
          fontWeight: FontWeight.w600,
          color: const Color(0xFFE8EAED),
        ),
        iconTheme: const IconThemeData(color: Color(0xFF60A5FA)),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Color(0xFF1E2028),
        selectedItemColor: Color(0xFF60A5FA),
        unselectedItemColor: Color(0xFF6B7280),
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
      cardTheme: CardThemeData(
        color: const Color(0xFF262830),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFF1E2028),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFF60A5FA), width: 1.5),
        ),
        labelStyle: const TextStyle(color: Color(0xFF6B7280)),
        hintStyle: const TextStyle(color: Color(0xFF4B5058)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF60A5FA),
          foregroundColor: const Color(0xFF1E2028),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle:
              GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600),
          elevation: 0,
        ),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          return Colors.white;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const Color(0xFF60A5FA);
          }
          return const Color(0xFF3A3D46);
        }),
      ),
      dividerTheme: const DividerThemeData(
        color: Color(0xFF3A3D46),
        thickness: 1,
        space: 0,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: const Color(0xFF262830),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
      ),
    );
  }
}

/// Yagona silliq sahifa o'tishi (v3.2 §3.2).
class _SmoothPageTransitionsBuilder extends PageTransitionsBuilder {
  const _SmoothPageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    if (route.isFirst) return child;
    final curved = CurvedAnimation(
      parent: animation,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    );
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.03),
          end: Offset.zero,
        ).animate(curved),
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.985, end: 1).animate(curved),
          child: child,
        ),
      ),
    );
  }
}
