import 'package:flutter/material.dart';

import '../tokens/tokens.dart';
import 'ds_button.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// DS EMPTY STATE — No-data placeholder
/// ═══════════════════════════════════════════════════════════════════════

class DsEmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  const DsEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(DsSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: colors.fill,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 28, color: colors.textTertiary),
            ),
            const SizedBox(height: DsSpacing.lg),
            Text(
              title,
              style: DsType.h3(color: colors.textPrimary),
              textAlign: TextAlign.center,
            ),
            if (subtitle != null) ...[
              const SizedBox(height: DsSpacing.sm),
              Text(
                subtitle!,
                style: DsType.body(color: colors.textSecondary),
                textAlign: TextAlign.center,
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: DsSpacing.xl),
              DsButton(
                label: actionLabel!,
                onPressed: onAction,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
