import 'package:flutter/material.dart';

import '../../../design/design.dart';
import '../../../core/theme/app_density.dart';

import 'app_button.dart';
import 'app_status_chip.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// APP — KARTA (brief §13 SURFACE + §31 CARD TYPES)
///
/// Surface darajalari:
///   S1 (flat)      → asosiy karta: yengil chegara, soya yo'q
///   S2 (elevated)  → ko'tarilgan karta: yumshoq soya (depth)
///   S3 (floating)  → premium/modal: katta radius + kuchli soya
///
/// Har bir karta S3 bo'lmasligi kerak (brief §13). Border faqat
/// separation uchun — har kartani border bilan qoplama (§14).
/// ═══════════════════════════════════════════════════════════════════════

enum AppCardElevation { flat, elevated, floating }

class AppCard extends StatelessWidget {
  final AppCardElevation elevation;
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final VoidCallback? onTap;
  final BorderRadius? borderRadius;

  const AppCard({
    super.key,
    this.elevation = AppCardElevation.flat,
    required this.child,
    this.padding,
    this.margin,
    this.onTap,
    this.borderRadius,
  });

  BorderRadius get _radius =>
      borderRadius ??
      BorderRadius.circular(
        elevation == AppCardElevation.floating ? DsRadius.xl : DsRadius.lg,
      );

  /// Density-aware default padding (§9): compact ixcham, spacious keng.
  /// Density-aware default padding (§9): compact ixcham, spacious keng.
  EdgeInsetsGeometry _paddingFor(AppDensity density) => padding ??
      EdgeInsets.all(DsSpacing.lg * density.gapScale);

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final bg = elevation == AppCardElevation.floating
        ? colors.surfaceRaised
        : colors.card;

    final border = elevation == AppCardElevation.flat
        ? Border.all(
            color: colors.divider.withValues(alpha: isDark ? 0.35 : 0.5),
            width: 1,
          )
        : null;

    final shadows = switch (elevation) {
      AppCardElevation.flat => null,
      AppCardElevation.elevated => DsShadow.high,
      AppCardElevation.floating => DsShadow.floating,
    };

    return Container(
      margin: margin,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: _radius,
        border: border,
        boxShadow: shadows,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: _radius,
        child: InkWell(
          onTap: onTap,
          borderRadius: _radius,
          child: Padding(padding: _paddingFor(context.appDensity), child: child),
        ),
      ),
    );
  }
}

/// ═══════════════════════════════════════════════════════════════════════
/// APP — STATUS CARD (brief §33)
///
/// Pattern: icon | status | explanation | [action]
/// Misol:   Camera  Connected  RTSP faol  [Test]
/// Rang hech qachon yagona signal emas — ikon + matn bilan birga (§47).
/// ═══════════════════════════════════════════════════════════════════════
class AppStatusCard extends StatelessWidget {
  final AppStatusTone tone;
  final IconData icon;
  final String title;
  final String? description;
  final String? actionLabel;
  final VoidCallback? onAction;

  const AppStatusCard({
    super.key,
    required this.tone,
    required this.icon,
    required this.title,
    this.description,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final toneColor = tone.resolve(colors);

    return AppCard(
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: toneColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(DsRadius.md),
            ),
            child: Icon(icon, size: 22, color: toneColor),
          ),
          const SizedBox(width: DsSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Rang signali hech qachon yagona emas: ikon + rangli matn
                // birga (brief §47).
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: DsType.bodyStrong(color: toneColor),
                ),
                if (description != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: DsType.bodySm(color: colors.textSecondary),
                  ),
                ],
              ],
            ),
          ),
          if (actionLabel != null) ...[
            const SizedBox(width: DsSpacing.sm),
            AppButton(
              type: AppButtonType.tertiary,
              size: AppButtonSize.sm,
              label: actionLabel!,
              onPressed: onAction,
            ),
          ],
        ],
      ),
    );
  }
}
