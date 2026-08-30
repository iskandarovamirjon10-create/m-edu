import 'package:flutter/material.dart';

import '../tokens/tokens.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// DS STATUS CHIP — Status/label badge
/// ═══════════════════════════════════════════════════════════════════════

enum DsStatusTone { success, warning, error, info, neutral }

class DsStatusChip extends StatelessWidget {
  final String label;
  final DsStatusTone tone;
  final bool small;

  const DsStatusChip({
    super.key,
    required this.label,
    this.tone = DsStatusTone.neutral,
    this.small = false,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    final (fg, bg) = switch (tone) {
      DsStatusTone.success => (colors.success, colors.successBg),
      DsStatusTone.warning => (colors.warning, colors.warningBg),
      DsStatusTone.error => (colors.error, colors.errorBg),
      DsStatusTone.info => (colors.info, colors.infoBg),
      DsStatusTone.neutral => (colors.textSecondary, colors.fill),
    };

    final textStyle = small
        ? DsType.overline(color: fg)
        : DsType.caption(color: fg);

    final padding = small
        ? const EdgeInsets.symmetric(horizontal: 6, vertical: 2)
        : const EdgeInsets.symmetric(horizontal: 8, vertical: 3);

    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: DsRadius.fullAll,
      ),
      child: Text(
        label.toUpperCase(),
        style: textStyle,
      ),
    );
  }
}
