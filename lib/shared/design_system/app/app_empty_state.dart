import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';

import '../../../design/design.dart';
import 'app_button.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// APP — BO'SH HOLAT (Design System 4.0 §26)
/// ═══════════════════════════════════════════════════════════════════════

class AppEmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Widget? action;
  final Color? accent;

  const AppEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.action,
    this.accent,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final accentColor = accent ?? colors.accent;

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: DsSpacing.xxl,
          vertical: DsSpacing.xxl,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: accentColor.withValues(alpha: 0.10),
                borderRadius: DsRadius.lgAll,
                border: Border.all(
                  color: accentColor.withValues(alpha: 0.18),
                  width: 1,
                ),
              ),
              child: Icon(icon, size: 28, color: accentColor),
            ),
            const SizedBox(height: DsSpacing.xl),
            Text(
              title,
              textAlign: TextAlign.center,
              style: DsType.h3(color: colors.textPrimary),
            ),
            const SizedBox(height: DsSpacing.sm),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: DsType.body(color: colors.textSecondary),
            ),
            if (action != null) ...[
              const SizedBox(height: DsSpacing.xl),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

/// ═══════════════════════════════════════════════════════════════════════
/// APP — XATO HOLATI (Design System 4.0 §27)
/// ═══════════════════════════════════════════════════════════════════════

class AppErrorState extends StatelessWidget {
  final String title;
  final String subtitle;
  final String? retryLabel;
  final VoidCallback? onRetry;
  final String? technicalDetails;

  const AppErrorState({
    super.key,
    required this.title,
    required this.subtitle,
    this.retryLabel,
    this.onRetry,
    this.technicalDetails,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final showTechnical = technicalDetails != null && kDebugMode;

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: DsSpacing.xxl,
          vertical: DsSpacing.xxl,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: colors.errorBg,
                borderRadius: DsRadius.lgAll,
              ),
              child: Icon(Icons.error_outline_rounded,
                  size: 28, color: colors.error),
            ),
            const SizedBox(height: DsSpacing.xl),
            Text(
              title,
              textAlign: TextAlign.center,
              style: DsType.h3(color: colors.textPrimary),
            ),
            const SizedBox(height: DsSpacing.sm),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: DsType.body(color: colors.textSecondary),
            ),
            if (showTechnical) ...[
              const SizedBox(height: DsSpacing.md),
              Text(
                technicalDetails!,
                textAlign: TextAlign.center,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: DsType.caption(color: colors.textTertiary),
              ),
            ],
            if (onRetry != null && retryLabel != null) ...[
              const SizedBox(height: DsSpacing.xl),
              AppButton(
                type: AppButtonType.secondary,
                label: retryLabel!,
                icon: Icons.refresh_rounded,
                onPressed: onRetry,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
