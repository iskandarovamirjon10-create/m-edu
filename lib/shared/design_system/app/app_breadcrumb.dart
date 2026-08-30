import 'package:flutter/material.dart';

import '../../../design/design.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// APP — BREADCRUMB (PHASE D — desktop orientation, brief §17)
/// ═══════════════════════════════════════════════════════════════════════
class AppBreadcrumb extends StatelessWidget {
  final List<String> crumbs;

  const AppBreadcrumb({super.key, required this.crumbs});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    if (crumbs.isEmpty) return const SizedBox.shrink();

    return Semantics(
      label: crumbs.join(' / '),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < crumbs.length; i++) ...[
            if (i > 0) ...[
              const SizedBox(width: 6),
              Icon(
                Icons.chevron_right_rounded,
                size: 16,
                color: colors.textTertiary,
              ),
              const SizedBox(width: 6),
            ],
            Flexible(
              child: Text(
                crumbs[i],
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: DsType.caption(
                  color: i == crumbs.length - 1
                      ? colors.textPrimary
                      : colors.textSecondary,
                ).copyWith(
                  fontWeight: i == crumbs.length - 1
                      ? FontWeight.w600
                      : FontWeight.w400,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
