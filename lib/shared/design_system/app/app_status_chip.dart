import 'package:flutter/material.dart';

import '../../../design/design.dart';


/// ═══════════════════════════════════════════════════════════════════════
/// APP — STATUS CHIP (brief §10-12 SEMANTIC TOKENLAR + §47)
///
/// Universal semantic qoida — butun app bo'ylab bir xil:
///   success  → paid / present / active / healthy   (yashil)
///   warning  → pending / late / attention         (amber)
///   error    → overdue / absent / destructive     (qizil)
///   info     → neutral informativ holat           (ko'k)
///   neutral  → noma'lum / no-status               (kulrang)
///
/// Rang hech qachon yagona signal emas: ikon + matn + rang birga (§47).
/// ═══════════════════════════════════════════════════════════════════════

enum AppStatusTone { success, warning, error, info, neutral }

/// Tone → yagona rang manbai (dark-aware).
extension AppStatusToneX on AppStatusTone {
  Color resolve(DsColors colors) => switch (this) {
        AppStatusTone.success => colors.success,
        AppStatusTone.warning => colors.warning,
        AppStatusTone.error => colors.error,
        AppStatusTone.info => colors.info,
        AppStatusTone.neutral => colors.textSecondary,
      };

  Color resolveSoft(DsColors colors) => switch (this) {
        AppStatusTone.success => colors.successBg,
        AppStatusTone.warning => colors.warningBg,
        AppStatusTone.error => colors.errorBg,
        AppStatusTone.info => colors.infoBg,
        AppStatusTone.neutral => colors.surfaceOverlay,
      };
}

class AppStatusChip extends StatelessWidget {
  final AppStatusTone tone;
  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  const AppStatusChip({
    super.key,
    required this.tone,
    required this.icon,
    required this.label,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final toneColor = tone.resolve(colors);

    final chip = Container(
      padding: const EdgeInsets.symmetric(
        horizontal: DsSpacing.sm + 2,
        vertical: DsSpacing.xs + 2,
      ),
      decoration: BoxDecoration(
        color: tone.resolveSoft(colors),
        borderRadius: BorderRadius.circular(DsRadius.full),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: toneColor),
          const SizedBox(width: 5),
          Text(
            label,
            style: DsType.bodyStrong(
              color: tone == AppStatusTone.neutral
                  ? colors.textSecondary
                  : toneColor,
            ),
          ),
        ],
      ),
    );

    return Semantics(
      label: label,
      button: onTap != null,
      child: onTap == null
          ? chip
          : InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(DsRadius.full),
              child: chip,
            ),
    );
  }
}
