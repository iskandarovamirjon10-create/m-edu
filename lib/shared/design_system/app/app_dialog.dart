import 'package:flutter/material.dart';

import '../../../design/design.dart';

import 'app_button.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// APP — DIALOG / SHEET (Design System 4.0 §22-23)
///
/// Barcha dialoglar uchun yagona qoidalar:
///   • width: desktop'da 480px gacha — butun ekranni YO'Q (§22)
///   • padding: 24
///   • radius: DsRadius.xl
///   • surface: surfaceElevated
///   • overlay: qoraytirilgan scrim (0.45)
///   • motion: modal (240ms) — fade + scale (reduced motion'da zero)
///
/// `AppDialog.show(...)` — AlertDialog o'rniga.
/// `AppSheet.show(...)` — showModalBottomSheet o'rniga (mobil uchun).
/// ═══════════════════════════════════════════════════════════════════════

class AppDialog {
  AppDialog._();

  /// Standart dialog kengligi (desktop) — butun ekranni egallamaydi (§22).
  static const double maxWidth = 480;

  /// Yagona dialog ochish API.
  ///
  /// ```dart
  /// final ok = await AppDialog.show<bool>(
  ///   context,
  ///   title: 'Oʻchirish',
  ///   content: 'Rostdan ham oʻchirilsinmi?',
  ///   confirmLabel: 'Oʻchirish',
  ///   confirmType: AppButtonType.destructive,
  /// );
  /// ```
  static Future<T?> show<T>(
    BuildContext context, {
    required String title,
    required Widget content,
    String? confirmLabel,
    VoidCallback? onConfirm,
    AppButtonType confirmType = AppButtonType.primary,
    String? cancelLabel,
    bool barrierDismissible = true,
  }) {
    return showDialog<T>(
      context: context,
      barrierDismissible: barrierDismissible,
      // Overlay — qoraytirilgan scrim (§22 focus/overlay qoidasi).
      barrierColor: Colors.black.withValues(alpha: 0.45),
      // Harakat: modal — fade + scale (reduced motion'da zero).
      // showDialog o'z animatsiyasi bilan keladi; silliqligi uchun
      // theme'da dialogTheme berilgan. Bu yerda qo'shimcha motion
      // byudjeti sarflanmaydi (§46).
      builder: (dialogContext) {
        final dialogColors = dialogContext.dsColors;
        return Dialog(
          backgroundColor: dialogColors.surfaceRaised,
          elevation: 0,
          insetPadding: const EdgeInsets.symmetric(
            horizontal: DsSpacing.xxl,
            vertical: DsSpacing.xxl,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(DsRadius.xl),
            side: BorderSide(
              color: dialogColors.divider.withValues(alpha: 0.4),
              width: 1,
            ),
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: maxWidth),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(DsSpacing.xxl),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: DsType.h3(color: dialogColors.textPrimary),
                  ),
                  const SizedBox(height: DsSpacing.md),
                  content,
                  const SizedBox(height: DsSpacing.xxl),
                  // Wrap — tor dialoglarda tugmalar o'rab chiqadi
                  // (overflow emas, §22 responsive dialog).
                  Wrap(
                    alignment: WrapAlignment.end,
                    spacing: DsSpacing.sm,
                    runSpacing: DsSpacing.sm,
                    children: [
                      if (cancelLabel != null)
                        AppButton(
                          type: AppButtonType.tertiary,
                          label: cancelLabel,
                          onPressed: () =>
                              Navigator.of(dialogContext).pop(),
                        ),
                      if (confirmLabel != null)
                        AppButton(
                          type: confirmType,
                          label: confirmLabel,
                          onPressed: onConfirm ??
                              () => Navigator.of(dialogContext).pop(true),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Pastdan/yonidan ochiladigan sheet — mobil uchun (§23).
///
/// Drag-to-dismiss, focus trap, safe areas Flutter'ning showModalBottomSheet
/// mexanizmidan keladi. Kritik formalarda [isDismissible: false] bilan
/// tasodifiy yopilish oldini olinadi (§23 "Avoid accidental dismissal").
class AppSheet {
  AppSheet._();

  /// Yagona sheet ochish API.
  ///
  /// ```dart
  /// final result = await AppSheet.show<String>(
  ///   context,
  ///   builder: (ctx) => ListView(children: [...]),
  /// );
  /// ```
  static Future<T?> show<T>(
    BuildContext context, {
    required Widget Function(BuildContext) builder,
    bool isDismissible = true,
    bool enableDrag = true,
    String? title,
  }) {
    final isDesktop = MediaQuery.sizeOf(context).width >= 900;

    return showModalBottomSheet<T>(
      context: context,
      isDismissible: isDismissible,
      enableDrag: enableDrag,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      // Desktop: markaziy, cheklangan kenglik; mobil: pastdan to'liq kenglik.
      constraints: isDesktop
          ? const BoxConstraints(maxWidth: 520)
          : null,
      builder: (sheetContext) {
        final sheetColors = sheetContext.dsColors;
        return Container(
          decoration: BoxDecoration(
            color: sheetColors.surfaceRaised,
            borderRadius: BorderRadius.vertical(
              top: Radius.circular(DsRadius.xl),
            ),
            border: Border.all(
              color: sheetColors.divider.withValues(alpha: 0.4),
              width: 1,
            ),
          ),
          // Safe area — §23: pastki qism xavfsiz hududda tugaydi.
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                DsSpacing.xxl,
                DsSpacing.lg,
                DsSpacing.xxl,
                DsSpacing.xxl,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Drag tutqichi (enableDrag bo'lsa).
                  if (enableDrag)
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: sheetColors.divider,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                  if (enableDrag) const SizedBox(height: DsSpacing.lg),
                  if (title != null) ...[
                    Text(
                      title,
                      style:
                          DsType.h3(color: sheetColors.textPrimary),
                    ),
                    const SizedBox(height: DsSpacing.lg),
                  ],
                  Flexible(child: builder(sheetContext)),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
