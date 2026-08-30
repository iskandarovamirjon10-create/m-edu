import 'package:flutter/material.dart';

import '../../../design/design.dart';


/// ═══════════════════════════════════════════════════════════════════════
/// APP — BO'LIM SARLAVHASI (Design System 4.0 §48 — AppSectionHeader)
///
/// Sahifa ichidagi bo'limlar uchun yagona sarlavha:
///   Title            ... [action]
///   Subtitle (optional)
///
/// Feature'lardagi random `Text(title, style: TextStyle(...))` o'rniga
/// ishlatiladi — bo'lim ierarxiyasi butun app bo'ylab bir xil ko'rinadi.
/// ═══════════════════════════════════════════════════════════════════════

class AppSectionHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget? action;
  final EdgeInsetsGeometry padding;

  const AppSectionHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.action,
    this.padding = const EdgeInsets.only(bottom: DsSpacing.md),
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return Padding(
      padding: padding,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  // Bo'lim sarlavhasi — h3 (20px) dan kichik, h2 (24px)
                  // dan katta emas: sahifa sarlavhasi bilan raqobatlashmaydi
                  // (color hierarchy §4).
                  style: DsType.h3(color: colors.textPrimary),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: DsType.caption(color: colors.textSecondary),
                  ),
                ],
              ],
            ),
          ),
          if (action != null) ...[
            const SizedBox(width: DsSpacing.md),
            action!,
          ],
        ],
      ),
    );
  }
}
