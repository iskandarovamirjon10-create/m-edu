import 'package:flutter/material.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// M-EDU DESIGN SYSTEM v3.2 — YAGONA RANG MANBAI
///
/// v3.2 palitrasi + backward compatible nomlar (mavjud widget'lar uchun).
/// ═══════════════════════════════════════════════════════════════════════
@immutable
class AppColors extends ThemeExtension<AppColors> {
  final Color textPrimary;
  final Color textSecondary;
  final Color textTertiary;
  final Color textDisabled;
  final Color textOnPrimary;
  final Color scaffoldBackground;
  final Color surface;
  final Color surfaceElevated;
  final Color surfaceSubtle;
  final Color fill;
  final Color card;
  final Color primary;
  final Color primaryHover;
  final Color primaryPressed;
  final Color primarySoft;
  final Color primarySoftHover;
  final Color borderDefault;
  final Color borderStrong;
  final Color borderFocus;
  final Color success;
  final Color successBg;
  final Color successSoft;
  final Color warning;
  final Color warningBg;
  final Color warningSoft;
  final Color error;
  final Color errorBg;
  final Color errorSoft;
  final Color info;
  final Color infoBg;
  final Color infoSoft;
  final Color overlayModal;
  final Color overlayGlassLight;
  final Color overlayHoverDark;
  final Color accentStart;
  final Color accentEnd;
  final Color accentHover;
  final Color brandSoft;
  final Color glassSurface;
  final Color glassElevated;
  final Color glassFloating;
  final Color glassSheen;
  final Color glassBorderInner;
  final Color glassBorderOuter;
  final Color auroraBlue;
  final Color auroraViolet;
  final Color auroraPink;
  final Color auroraTeal;
  final Color auroraGold;
  final Color heroBgTop;
  final Color heroBgBottom;
  final Color separator;
  final Color separatorStrong;
  final Color navBackground;

  const AppColors({
    required this.textPrimary,
    required this.textSecondary,
    required this.textTertiary,
    required this.textDisabled,
    required this.textOnPrimary,
    required this.scaffoldBackground,
    required this.surface,
    required this.surfaceElevated,
    required this.surfaceSubtle,
    required this.fill,
    required this.card,
    required this.primary,
    required this.primaryHover,
    required this.primaryPressed,
    required this.primarySoft,
    required this.primarySoftHover,
    required this.borderDefault,
    required this.borderStrong,
    required this.borderFocus,
    required this.success,
    required this.successBg,
    required this.successSoft,
    required this.warning,
    required this.warningBg,
    required this.warningSoft,
    required this.error,
    required this.errorBg,
    required this.errorSoft,
    required this.info,
    required this.infoBg,
    required this.infoSoft,
    required this.overlayModal,
    required this.overlayGlassLight,
    required this.overlayHoverDark,
    required this.accentStart,
    required this.accentEnd,
    required this.accentHover,
    required this.brandSoft,
    required this.glassSurface,
    required this.glassElevated,
    required this.glassFloating,
    required this.glassSheen,
    required this.glassBorderInner,
    required this.glassBorderOuter,
    required this.auroraBlue,
    required this.auroraViolet,
    required this.auroraPink,
    required this.auroraTeal,
    required this.auroraGold,
    required this.heroBgTop,
    required this.heroBgBottom,
    required this.separator,
    required this.separatorStrong,
    required this.navBackground,
  });

  static const AppColors light = AppColors(
    textPrimary: Color(0xFF1E293B),
    textSecondary: Color(0xFF475569),
    textTertiary: Color(0xFF64748B),
    textDisabled: Color(0xFFCBD5E1),
    textOnPrimary: Color(0xFFFFFFFF),
    scaffoldBackground: Color(0xFFF0F2F5),
    surface: Color(0xFFF5F7FA),
    surfaceElevated: Color(0xFFFFFFFF),
    surfaceSubtle: Color(0xFFE8ECF1),
    fill: Color(0xFFE8ECF1),
    card: Color(0xFFF5F7FA),
    primary: Color(0xFF3B82F6),
    primaryHover: Color(0xFF2563EB),
    primaryPressed: Color(0xFF1D4ED8),
    primarySoft: Color(0xFFDBEAFE),
    primarySoftHover: Color(0xFFBFDBFE),
    borderDefault: Color(0xFFE2E8F0),
    borderStrong: Color(0xFFCBD5E1),
    borderFocus: Color(0xFF3B82F6),
    success: Color(0xFF15803D),
    successBg: Color(0xFFDCFCE7),
    successSoft: Color(0xFFDCFCE7),
    warning: Color(0xFFD97706),
    warningBg: Color(0xFFFEF3C7),
    warningSoft: Color(0xFFFEF3C7),
    error: Color(0xFFDC2626),
    errorBg: Color(0xFFFEE2E2),
    errorSoft: Color(0xFFFEE2E2),
    info: Color(0xFF3B82F6),
    infoBg: Color(0xFFDBEAFE),
    infoSoft: Color(0xFFDBEAFE),
    overlayModal: Color(0x731E293B),
    overlayGlassLight: Color(0xD9FFFFFF),
    overlayHoverDark: Color(0x0A1E293B),
    accentStart: Color(0xFF3B82F6),
    accentEnd: Color(0xFF6366F1),
    accentHover: Color(0xFF2563EB),
    brandSoft: Color(0xFFDBEAFE),
    glassSurface: Color(0xFFF5F7FA),
    glassElevated: Color(0xFFFFFFFF),
    glassFloating: Color(0xFFFFFFFF),
    glassSheen: Color(0xFFE8ECF1),
    glassBorderInner: Color(0xFFE2E8F0),
    glassBorderOuter: Color(0x0A000000),
    auroraBlue: Color(0xFF3B82F6),
    auroraViolet: Color(0xFF6366F1),
    auroraPink: Color(0xFFEC4899),
    auroraTeal: Color(0xFF14B8A6),
    auroraGold: Color(0xFFF59E0B),
    heroBgTop: Color(0xFFF0F2F5),
    heroBgBottom: Color(0xFFF5F7FA),
    separator: Color(0xFFE2E8F0),
    separatorStrong: Color(0xFFCBD5E1),
    navBackground: Color(0xFFF5F7FA),
  );

  static const AppColors dark = AppColors(
    textPrimary: Color(0xFFF1F5F9),
    textSecondary: Color(0xFFCBD5E1),
    textTertiary: Color(0xFF94A3B8),
    textDisabled: Color(0xFF4B5563),
    textOnPrimary: Color(0xFFFFFFFF),
    scaffoldBackground: Color(0xFF1A1D23),
    surface: Color(0xFF252830),
    surfaceElevated: Color(0xFF2A2D35),
    surfaceSubtle: Color(0xFF2F3239),
    fill: Color(0xFF252830),
    card: Color(0xFF2A2D35),
    primary: Color(0xFF60A5FA),
    primaryHover: Color(0xFF93C5FD),
    primaryPressed: Color(0xFFBFDBFE),
    primarySoft: Color(0xFF1E3A5F),
    primarySoftHover: Color(0xFF1E40AF),
    borderDefault: Color(0xFF374151),
    borderStrong: Color(0xFF4B5563),
    borderFocus: Color(0xFF60A5FA),
    success: Color(0xFF4ADE80),
    successBg: Color(0xFF064E3B),
    successSoft: Color(0xFF064E3B),
    warning: Color(0xFFFBBF24),
    warningBg: Color(0xFF78350F),
    warningSoft: Color(0xFF78350F),
    error: Color(0xFFF87171),
    errorBg: Color(0xFF7F1D1D),
    errorSoft: Color(0xFF7F1D1D),
    info: Color(0xFF60A5FA),
    infoBg: Color(0xFF1E3A5F),
    infoSoft: Color(0xFF1E3A5F),
    overlayModal: Color(0x73000000),
    overlayGlassLight: Color(0x1AFFFFFF),
    overlayHoverDark: Color(0x0AFFFFFF),
    accentStart: Color(0xFF60A5FA),
    accentEnd: Color(0xFF818CF8),
    accentHover: Color(0xFF93C5FD),
    brandSoft: Color(0xFF1E3A5F),
    glassSurface: Color(0xFF2A2D35),
    glassElevated: Color(0xFF30333B),
    glassFloating: Color(0xFF353840),
    glassSheen: Color(0x26FFFFFF),
    glassBorderInner: Color(0xFF374151),
    glassBorderOuter: Color(0x0A000000),
    auroraBlue: Color(0xFF60A5FA),
    auroraViolet: Color(0xFF818CF8),
    auroraPink: Color(0xFFF472B6),
    auroraTeal: Color(0xFF2DD4BF),
    auroraGold: Color(0xFFFBBF24),
    heroBgTop: Color(0xFF1A1D23),
    heroBgBottom: Color(0xFF1E2028),
    separator: Color(0xFF374151),
    separatorStrong: Color(0xFF4B5563),
    navBackground: Color(0xFF1A1D23),
  );

  // ═══════════════════════════════════════════════════════════════════════
  // CORE PALETTE CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════
  static const Color paletteCyan = Color(0xFF94EAEF);
  static const Color paletteSkyUltraLight = Color(0xFF8CDCF1);
  static const Color paletteSkyLight = Color(0xFF7EC2F3);
  static const Color palettePrimaryBlue = Color(0xFF618CF9);
  static const Color paletteElectricBlue = Color(0xFF5474FC);
  static const Color paletteIndigoBlue = Color(0xFF4C65FD);

  // Semantic convenience getters
  Color get primaryContainer => primarySoft;
  Color get secondary => Color(0xFF5474FC);
  Color get accent => Color(0xFF94EAEF);
  Color get background => scaffoldBackground;
  Color get glassBorder => glassBorderInner;
  Color get textMuted => textTertiary;
  Color get divider => separator;
  Color get focus => borderFocus;
  Color get disabled => textDisabled;

  /// Preferred Liquid Glass Gradient (#94EAEF → #7EC2F3 → #618CF9 → #4C65FD)
  LinearGradient get primaryGradient => const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xFF94EAEF),
          Color(0xFF7EC2F3),
          Color(0xFF618CF9),
          Color(0xFF4C65FD),
        ],
      );

  LinearGradient get accentGradient => const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFF94EAEF), Color(0xFF618CF9)],
      );

  LinearGradient get softGlassGradient => const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0x1A94EAEF), Color(0x0D618CF9)],
      );

  @override
  AppColors copyWith({
    Color? textPrimary,
    Color? textSecondary,
    Color? textTertiary,
    Color? textDisabled,
    Color? textOnPrimary,
    Color? scaffoldBackground,
    Color? surface,
    Color? surfaceElevated,
    Color? surfaceSubtle,
    Color? fill,
    Color? card,
    Color? primary,
    Color? primaryHover,
    Color? primaryPressed,
    Color? primarySoft,
    Color? primarySoftHover,
    Color? borderDefault,
    Color? borderStrong,
    Color? borderFocus,
    Color? success,
    Color? successBg,
    Color? successSoft,
    Color? warning,
    Color? warningBg,
    Color? warningSoft,
    Color? error,
    Color? errorBg,
    Color? errorSoft,
    Color? info,
    Color? infoBg,
    Color? infoSoft,
    Color? overlayModal,
    Color? overlayGlassLight,
    Color? overlayHoverDark,
    Color? accentStart,
    Color? accentEnd,
    Color? accentHover,
    Color? brandSoft,
    Color? glassSurface,
    Color? glassElevated,
    Color? glassFloating,
    Color? glassSheen,
    Color? glassBorderInner,
    Color? glassBorderOuter,
    Color? auroraBlue,
    Color? auroraViolet,
    Color? auroraPink,
    Color? auroraTeal,
    Color? auroraGold,
    Color? heroBgTop,
    Color? heroBgBottom,
    Color? separator,
    Color? separatorStrong,
    Color? navBackground,
  }) {
    return AppColors(
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textTertiary: textTertiary ?? this.textTertiary,
      textDisabled: textDisabled ?? this.textDisabled,
      textOnPrimary: textOnPrimary ?? this.textOnPrimary,
      scaffoldBackground: scaffoldBackground ?? this.scaffoldBackground,
      surface: surface ?? this.surface,
      surfaceElevated: surfaceElevated ?? this.surfaceElevated,
      surfaceSubtle: surfaceSubtle ?? this.surfaceSubtle,
      fill: fill ?? this.fill,
      card: card ?? this.card,
      primary: primary ?? this.primary,
      primaryHover: primaryHover ?? this.primaryHover,
      primaryPressed: primaryPressed ?? this.primaryPressed,
      primarySoft: primarySoft ?? this.primarySoft,
      primarySoftHover: primarySoftHover ?? this.primarySoftHover,
      borderDefault: borderDefault ?? this.borderDefault,
      borderStrong: borderStrong ?? this.borderStrong,
      borderFocus: borderFocus ?? this.borderFocus,
      success: success ?? this.success,
      successBg: successBg ?? this.successBg,
      successSoft: successSoft ?? this.successSoft,
      warning: warning ?? this.warning,
      warningBg: warningBg ?? this.warningBg,
      warningSoft: warningSoft ?? this.warningSoft,
      error: error ?? this.error,
      errorBg: errorBg ?? this.errorBg,
      errorSoft: errorSoft ?? this.errorSoft,
      info: info ?? this.info,
      infoBg: infoBg ?? this.infoBg,
      infoSoft: infoSoft ?? this.infoSoft,
      overlayModal: overlayModal ?? this.overlayModal,
      overlayGlassLight: overlayGlassLight ?? this.overlayGlassLight,
      overlayHoverDark: overlayHoverDark ?? this.overlayHoverDark,
      accentStart: accentStart ?? this.accentStart,
      accentEnd: accentEnd ?? this.accentEnd,
      accentHover: accentHover ?? this.accentHover,
      brandSoft: brandSoft ?? this.brandSoft,
      glassSurface: glassSurface ?? this.glassSurface,
      glassElevated: glassElevated ?? this.glassElevated,
      glassFloating: glassFloating ?? this.glassFloating,
      glassSheen: glassSheen ?? this.glassSheen,
      glassBorderInner: glassBorderInner ?? this.glassBorderInner,
      glassBorderOuter: glassBorderOuter ?? this.glassBorderOuter,
      auroraBlue: auroraBlue ?? this.auroraBlue,
      auroraViolet: auroraViolet ?? this.auroraViolet,
      auroraPink: auroraPink ?? this.auroraPink,
      auroraTeal: auroraTeal ?? this.auroraTeal,
      auroraGold: auroraGold ?? this.auroraGold,
      heroBgTop: heroBgTop ?? this.heroBgTop,
      heroBgBottom: heroBgBottom ?? this.heroBgBottom,
      separator: separator ?? this.separator,
      separatorStrong: separatorStrong ?? this.separatorStrong,
      navBackground: navBackground ?? this.navBackground,
    );
  }

  @override
  AppColors lerp(AppColors? other, double t) {
    if (other == null) return this;
    return AppColors(
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textTertiary: Color.lerp(textTertiary, other.textTertiary, t)!,
      textDisabled: Color.lerp(textDisabled, other.textDisabled, t)!,
      textOnPrimary: Color.lerp(textOnPrimary, other.textOnPrimary, t)!,
      scaffoldBackground: Color.lerp(scaffoldBackground, other.scaffoldBackground, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceElevated: Color.lerp(surfaceElevated, other.surfaceElevated, t)!,
      surfaceSubtle: Color.lerp(surfaceSubtle, other.surfaceSubtle, t)!,
      fill: Color.lerp(fill, other.fill, t)!,
      card: Color.lerp(card, other.card, t)!,
      primary: Color.lerp(primary, other.primary, t)!,
      primaryHover: Color.lerp(primaryHover, other.primaryHover, t)!,
      primaryPressed: Color.lerp(primaryPressed, other.primaryPressed, t)!,
      primarySoft: Color.lerp(primarySoft, other.primarySoft, t)!,
      primarySoftHover: Color.lerp(primarySoftHover, other.primarySoftHover, t)!,
      borderDefault: Color.lerp(borderDefault, other.borderDefault, t)!,
      borderStrong: Color.lerp(borderStrong, other.borderStrong, t)!,
      borderFocus: Color.lerp(borderFocus, other.borderFocus, t)!,
      success: Color.lerp(success, other.success, t)!,
      successBg: Color.lerp(successBg, other.successBg, t)!,
      successSoft: Color.lerp(successSoft, other.successSoft, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      warningBg: Color.lerp(warningBg, other.warningBg, t)!,
      warningSoft: Color.lerp(warningSoft, other.warningSoft, t)!,
      error: Color.lerp(error, other.error, t)!,
      errorBg: Color.lerp(errorBg, other.errorBg, t)!,
      errorSoft: Color.lerp(errorSoft, other.errorSoft, t)!,
      info: Color.lerp(info, other.info, t)!,
      infoBg: Color.lerp(infoBg, other.infoBg, t)!,
      infoSoft: Color.lerp(infoSoft, other.infoSoft, t)!,
      overlayModal: Color.lerp(overlayModal, other.overlayModal, t)!,
      overlayGlassLight: Color.lerp(overlayGlassLight, other.overlayGlassLight, t)!,
      overlayHoverDark: Color.lerp(overlayHoverDark, other.overlayHoverDark, t)!,
      accentStart: Color.lerp(accentStart, other.accentStart, t)!,
      accentEnd: Color.lerp(accentEnd, other.accentEnd, t)!,
      accentHover: Color.lerp(accentHover, other.accentHover, t)!,
      brandSoft: Color.lerp(brandSoft, other.brandSoft, t)!,
      glassSurface: Color.lerp(glassSurface, other.glassSurface, t)!,
      glassElevated: Color.lerp(glassElevated, other.glassElevated, t)!,
      glassFloating: Color.lerp(glassFloating, other.glassFloating, t)!,
      glassSheen: Color.lerp(glassSheen, other.glassSheen, t)!,
      glassBorderInner: Color.lerp(glassBorderInner, other.glassBorderInner, t)!,
      glassBorderOuter: Color.lerp(glassBorderOuter, other.glassBorderOuter, t)!,
      auroraBlue: Color.lerp(auroraBlue, other.auroraBlue, t)!,
      auroraViolet: Color.lerp(auroraViolet, other.auroraViolet, t)!,
      auroraPink: Color.lerp(auroraPink, other.auroraPink, t)!,
      auroraTeal: Color.lerp(auroraTeal, other.auroraTeal, t)!,
      auroraGold: Color.lerp(auroraGold, other.auroraGold, t)!,
      heroBgTop: Color.lerp(heroBgTop, other.heroBgTop, t)!,
      heroBgBottom: Color.lerp(heroBgBottom, other.heroBgBottom, t)!,
      separator: Color.lerp(separator, other.separator, t)!,
      separatorStrong: Color.lerp(separatorStrong, other.separatorStrong, t)!,
      navBackground: Color.lerp(navBackground, other.navBackground, t)!,
    );
  }
}

extension AppThemeContextX on BuildContext {
  AppColors get appColors =>
      Theme.of(this).extension<AppColors>() ?? AppColors.light;
}
