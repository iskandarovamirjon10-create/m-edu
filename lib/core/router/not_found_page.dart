import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../shared/design_system/app/app_button.dart';
import '../../shared/design_system/app/app_page_header.dart';
import '../extensions/l10n_context.dart';
import '../theme/app_colors.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// 404 — SAHIFA TOPILMADI (PHASE D — global error, brief §24)
///
/// Noma'lum/deep-link xato marshrutlarda professional error state:
///   "Sahifa topilmadi" + tushuntirish + [Bosh sahifaga qaytish].
/// GoRouter `errorBuilder` orqali ulanadi (app_router.dart).
/// ═══════════════════════════════════════════════════════════════════════
class NotFoundPage extends StatelessWidget {
  const NotFoundPage({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final l10n = context.l10n;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // Ixcham header — user "qayerda ekanini" bilsin (§34).
            AppPageHeader(
              title: l10n.notFoundTitle,
              showBack: true,
            ),
            Expanded(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 88,
                        height: 88,
                        decoration: BoxDecoration(
                          color: colors.warningSoft,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.explore_off_outlined,
                          size: 44,
                          color: colors.warning,
                        ),
                      ),
                      const SizedBox(height: 24),
                      Text(
                        l10n.notFoundTitle,
                        style: Theme.of(context)
                            .textTheme
                            .headlineMedium
                            ?.copyWith(color: colors.textPrimary),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        l10n.notFoundDesc,
                        textAlign: TextAlign.center,
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(
                              color: colors.textSecondary,
                              height: 1.5,
                            ),
                      ),
                      const SizedBox(height: 28),
                      AppButton(
                        type: AppButtonType.primary,
                        icon: Icons.home_outlined,
                        label: l10n.notFoundGoHome,
                        onPressed: () => context.go('/dashboard'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
