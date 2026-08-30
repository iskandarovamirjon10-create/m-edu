import 'package:flutter/material.dart';

import '../../../design/design.dart';


/// ═══════════════════════════════════════════════════════════════════════
/// APP — TOAST / FEEDBACK TIZIMI (Design System 4.0 §24)
///
/// Barcha foydalanuvchi feedback'i bitta ko'rinishda: semantic tone +
/// ikon + matn + (ixtiyoriy) action. SnackBar o'rniga `AppToast.show(...)`
/// ishlatiladi — random `SnackBar(content: Text(...))` taqiqlanadi.
///
/// Tone'lar (§24): success, info, warning, error, sync, offline.
/// Qoidalar:
///   • contextga mos, qisqa, actionable
///   • notification spam'ga yo'l qo'yilmaydi (ketma-ket toasts ustma-ust
///     tushmaydi — ScaffoldMessenger navbatchilik qiladi)
///   • Rang hech qachon yagona signal emas: ikon + matn + rang birga (§47)
/// ═══════════════════════════════════════════════════════════════════════

/// Feedback tone'i.
enum AppToastTone {
  success,
  info,
  warning,
  error,
  sync,
  offline;

  IconData get icon => switch (this) {
        AppToastTone.success => Icons.check_circle_rounded,
        AppToastTone.info => Icons.info_rounded,
        AppToastTone.warning => Icons.warning_amber_rounded,
        AppToastTone.error => Icons.error_rounded,
        AppToastTone.sync => Icons.sync_rounded,
        AppToastTone.offline => Icons.cloud_off_rounded,
      };

  Color resolve(DsColors colors) => switch (this) {
        AppToastTone.success => colors.success,
        AppToastTone.info => colors.info,
        AppToastTone.warning => colors.warning,
        AppToastTone.error => colors.error,
        AppToastTone.sync => colors.info,
        AppToastTone.offline => colors.textSecondary,
      };
}

/// Toast ko'rsatish uchun yagona API.
///
/// ```dart
/// AppToast.show(context, message: 'Saqlangan', tone: AppToastTone.success);
/// AppToast.show(context,
///   message: 'Oʻchirilsinmi?',
///   tone: AppToastTone.warning,
///   actionLabel: 'Oʻchirish',
///   onAction: () => delete(),
/// );
/// ```
class AppToast {
  AppToast._();

  static void show(
    BuildContext context, {
    required String message,
    AppToastTone tone = AppToastTone.info,
    String? actionLabel,
    VoidCallback? onAction,
    Duration? duration,
  }) {
    final colors = context.dsColors;
    final toneColor = tone.resolve(colors);
    final messenger = ScaffoldMessenger.of(context);

    // Ketma-ket toasts ustma-ust tushmaydi — oldingisi yopilib yangisi.
    messenger.hideCurrentSnackBar();

    messenger.showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        elevation: 0,
        backgroundColor: colors.surfaceRaised,
        duration: duration ?? const Duration(seconds: 4),
        // Harakat: pastdan silliq kirish (reduced motion'da zero).
        // Material SnackBar'ning o'z animatsiyasi bor — bu yerda qo'shimcha
        // animatsiya qo'shilmaydi (motion byudjeti, §46).
        content: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 32,
              height: 32,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: toneColor.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(DsRadius.sm),
              ),
              child: Icon(tone.icon, size: 18, color: toneColor),
            ),
            const SizedBox(width: DsSpacing.md),
            Expanded(
              child: Text(
                message,
                style: DsType.bodySm(
                  color: colors.textPrimary,
                ).copyWith(fontWeight: FontWeight.w500),
              ),
            ),
          ],
        ),
        // Theme'da berilgan fon rangini ishlatmaslik uchun — bizning
        // surface'imiz. Border: separator — toast chegarasini aniqlaydi.
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(DsRadius.md),
          side: BorderSide(
            color: colors.divider.withValues(alpha: 0.6),
            width: 1,
          ),
        ),
        action: actionLabel == null || onAction == null
            ? null
            : SnackBarAction(
                label: actionLabel,
                textColor: toneColor,
                onPressed: onAction,
              ),
      ),
    );
  }
}
