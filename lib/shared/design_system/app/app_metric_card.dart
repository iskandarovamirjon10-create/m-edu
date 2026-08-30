import 'package:flutter/material.dart';

import '../../../design/design.dart';

import 'app_card.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// APP — METRIC CARD (brief §32 METRIC CARD RULE)
///
/// Structure: label → value → context → (ixtiyoriy) trend
///   Davomat    91.8%   ↑ 2.4% bu oy
///
/// Cardni chart bilan to'ldirish shart emas (§32). Raqamlar tabular
/// figures — bir-biriga tekislanadi (§18). Rang signali hech qachon
/// yagona emas: trend ikon + matn + rang birga (§47).
/// ═══════════════════════════════════════════════════════════════════════
class AppMetricCard extends StatelessWidget {
  final String label;
  final String value;
  final String? unit;

  /// Kontekst matni (brief §32: label → value → context → trend).
  final String? contextLabel;
  final IconData? trendIcon;
  final String? trendLabel;
  final Color? trendColor;
  final VoidCallback? onTap;
  final AppCardElevation elevation;

  const AppMetricCard({
    super.key,
    required this.label,
    required this.value,
    this.unit,
    this.contextLabel,
    this.trendIcon,
    this.trendLabel,
    this.trendColor,
    this.onTap,
    this.elevation = AppCardElevation.elevated,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return AppCard(
      elevation: elevation,
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Label — kichik, ikkinchi darajali.
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: DsType.caption(color: colors.textSecondary),
          ),
          const SizedBox(height: DsSpacing.xs),
          // Value — katta, bold, yuqori kontrast (brief §18).
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Flexible(
                child: Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: DsType.statValue(color: colors.textPrimary),
                ),
              ),
              if (unit != null) ...[
                const SizedBox(width: DsSpacing.xs),
                Text(
                  unit!,
                  style: DsType.bodyStrong(color: colors.textTertiary),
                ),
              ],
            ],
          ),
          if (contextLabel != null) ...[
            const SizedBox(height: 2),
            Text(
              contextLabel!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: DsType.bodySm(color: colors.textSecondary),
            ),
          ],
          // Trend — ixtiyoriy, pastki chapda.
          if (trendLabel != null) ...[
            const SizedBox(height: DsSpacing.sm),
            Row(
              children: [
                if (trendIcon != null) ...[
                  Icon(
                    trendIcon,
                    size: 14,
                    color: trendColor ?? colors.textSecondary,
                  ),
                  const SizedBox(width: 4),
                ],
                Flexible(
                  child: Text(
                    trendLabel!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: DsType.bodyStrong(
                      color: trendColor ?? colors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
