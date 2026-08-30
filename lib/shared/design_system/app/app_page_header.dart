import 'package:flutter/material.dart';

import '../../../design/design.dart';


import 'app_back_button.dart';
import 'app_breadcrumb.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// APP — SAHIFA SARLAVHASI (PHASE D — brief §16)
///
/// Screenlar uchun yagona header: ixcham, "giant header" EMAS.
///   [back?] [Breadcrumb (desktop)] [Title + subtitle]  ... [actions]
///
/// Mobile: back (kerak bo'lsa) + title + actions.
/// Desktop: breadcrumb orientatsiyasi + title.
/// "No giant header" qoidasi — sarlavha bitta qator, h2 o'lchamda.
/// ═══════════════════════════════════════════════════════════════════════
class AppPageHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  final List<Widget>? actions;

  /// Oldingi sahifaga qaytish tugmasini ko'rsatish.
  final bool showBack;

  /// Back ni override qilish (default: Navigator.maybePop).
  final VoidCallback? onBack;

  /// Desktop orientatsiyasi (optional — chuqur sahifalar uchun).
  final List<String>? breadcrumb;

  const AppPageHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.actions,
    this.showBack = false,
    this.onBack,
    this.breadcrumb,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final crumbs = breadcrumb;
    final isDesktop = context.dsBreakpoint.isDesktop;

    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          DsSpacing.xl,
          DsSpacing.md,
          DsSpacing.xl,
          DsSpacing.md,
        ),
        child: Row(
          children: [
            if (showBack) ...[
              AppBackButton(onPressed: onBack),
              const SizedBox(width: DsSpacing.sm),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (isDesktop && crumbs != null && crumbs.isNotEmpty) ...[
                    AppBreadcrumb(crumbs: crumbs),
                    const SizedBox(height: DsSpacing.xs),
                  ],
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: DsType.h2(color: colors.textPrimary),
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
            if (actions != null) ...[
              const SizedBox(width: DsSpacing.md),
              ...actions!,
            ],
          ],
        ),
      ),
    );
  }
}
