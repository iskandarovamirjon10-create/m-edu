import 'package:flutter/material.dart';

import '../../../core/extensions/l10n_context.dart';
import '../../../design/design.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// APP — ORQAGA TUGMASI (PHASE D — navigation components)
///
/// Yagona, barcha screenlarda ishlatiladigan back affordance.
/// Default: navigator'da oldingi sahifa bo'lsa `maybePop`, bo'lmasa
/// `onPressed` chaqiriladi (yoki hech narsa — shell ildizida).
///
/// Vizual: yumshoq surface fondagi yumaloq IconButton — an'anaviy
/// AppBar leading'iga o'xshash, lekin token manbasidan qurilgan.
/// Touch target ≥44px (brief §47), semantic label (actionBack).
/// ═══════════════════════════════════════════════════════════════════════
class AppBackButton extends StatelessWidget {
  /// `null` — avtomatik: `Navigator.maybePop` (oldin sahifa bo'lsa).
  final VoidCallback? onPressed;

  /// IconButton ni ko'rinadigan qilish uchun fon rangi (default: fill).
  final Color? backgroundColor;

  const AppBackButton({super.key, this.onPressed, this.backgroundColor});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return Semantics(
      button: true,
      label: context.l10n.actionBack,
      child: IconButton(
        tooltip: context.l10n.actionBack,
        iconSize: 22,
        onPressed: onPressed ?? () => Navigator.maybePop(context),
        style: IconButton.styleFrom(
          backgroundColor: backgroundColor ?? colors.fill,
          foregroundColor: colors.textPrimary,
          minimumSize: const Size(44, 44),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        icon: const Icon(Icons.arrow_back_rounded),
      ),
    );
  }
}
