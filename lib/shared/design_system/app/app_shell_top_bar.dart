import 'package:flutter/material.dart';

import '../../../core/extensions/l10n_context.dart';
import '../../../design/design.dart';
import 'app_breadcrumb.dart';
import 'app_command_palette.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// APP — DESKTOP SHELL TOP BAR (PHASE D — brief §14)
/// ═══════════════════════════════════════════════════════════════════════
class AppShellTopBar extends StatelessWidget {
  final List<String> crumbs;
  final VoidCallback onLogout;
  final VoidCallback onNotificationsTap;
  final Widget? profileMenuChild;
  final Widget connectionStatus;

  const AppShellTopBar({
    super.key,
    required this.crumbs,
    required this.onLogout,
    required this.onNotificationsTap,
    this.profileMenuChild,
    this.connectionStatus = const _StaticSyncChip(),
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return Container(
      key: const Key('app-shell-top-bar'),
      height: 64,
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(
          bottom: BorderSide(
            color: colors.divider.withValues(alpha: 0.5),
            width: 0.8,
          ),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: DsSpacing.xl),
        child: Row(
          children: [
            Flexible(
              child: AppBreadcrumb(crumbs: crumbs),
            ),
            const SizedBox(width: DsSpacing.sm),
            Expanded(
              flex: 2,
              child: _GlobalSearchButton(colors: colors),
            ),
            const SizedBox(width: DsSpacing.md),
            connectionStatus,
            const SizedBox(width: DsSpacing.sm),
            _QuickActionButton(
              colors: colors,
              onPressed: onNotificationsTap,
            ),
            const SizedBox(width: DsSpacing.sm),
            IconButton(
              tooltip: context.l10n.notificationsTitle,
              onPressed: onNotificationsTap,
              iconSize: 22,
              style: IconButton.styleFrom(
                backgroundColor: colors.fill,
                foregroundColor: colors.textPrimary,
                minimumSize: const Size(44, 44),
                shape: RoundedRectangleBorder(
                  borderRadius: DsRadius.smAll,
                ),
              ),
              icon: const Icon(Icons.notifications_none_rounded),
            ),
            const SizedBox(width: DsSpacing.sm),
            AppProfileMenu(
              onLogout: onLogout,
              child: profileMenuChild ??
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: colors.accentGradient,
                    ),
                    child: const Icon(
                      Icons.person_rounded,
                      size: 20,
                      color: Colors.white,
                    ),
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Statik "Lokal" chip — ProviderScope'siz kontekstlar uchun fallback.
class _StaticSyncChip extends StatelessWidget {
  const _StaticSyncChip();

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return Tooltip(
      message: context.l10n.syncStatusLocalTooltip,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: DsSpacing.sm + 2,
          vertical: 5,
        ),
        decoration: BoxDecoration(
          color: colors.surfaceOverlay,
          borderRadius: DsRadius.fullAll,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_done_outlined, size: 15, color: colors.success),
            const SizedBox(width: 5),
            Text(
              context.l10n.syncStatusLocal,
              style: DsType.caption(color: colors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}

/// ═══════════════════════════════════════════════════════════════════════
/// PROFIL MENYUSI — topbar avatar va sidebar "Profil" uchun umumiy.
/// ═══════════════════════════════════════════════════════════════════════
class AppProfileMenu extends StatelessWidget {
  final VoidCallback onLogout;
  final Widget child;

  const AppProfileMenu({super.key, required this.onLogout, required this.child});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return PopupMenuButton<String>(
      tooltip: context.l10n.navProfile,
      onSelected: (value) {
        if (value == 'logout') onLogout();
      },
      color: colors.surfaceRaised,
      shape: RoundedRectangleBorder(
        borderRadius: DsRadius.mdAll,
      ),
      itemBuilder: (context) => [
        PopupMenuItem(
          value: 'logout',
          height: 44,
          child: Row(
            children: [
              Icon(Icons.logout_rounded, size: 18, color: colors.error),
              const SizedBox(width: 10),
              Text(
                'Chiqish',
                style: DsType.body(color: colors.textPrimary),
              ),
            ],
          ),
        ),
      ],
      child: child,
    );
  }
}

/// ═══════════════════════════════════════════════════════════════════════
/// GLOBAL SEARCH — contract §8.1
/// ═══════════════════════════════════════════════════════════════════════
class _GlobalSearchButton extends StatelessWidget {
  final DsColors colors;
  const _GlobalSearchButton({required this.colors});

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 380),
      child: Material(
        color: colors.fill,
        borderRadius: DsRadius.smAll,
        child: InkWell(
          borderRadius: DsRadius.smAll,
          onTap: () => AppCommandPalette.show(context),
          child: Container(
            height: 40,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                Icon(
                  Icons.search_rounded,
                  size: 20,
                  color: colors.textTertiary,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    "O'quvchi, guruh yoki kursni qidiring...",
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: DsType.body(color: colors.textTertiary),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: colors.surface,
                    borderRadius: DsRadius.xsAll,
                    border: Border.all(color: colors.border),
                  ),
                  child: Text(
                    'Ctrl+K',
                    style: DsType.caption(
                      color: colors.textTertiary,
                    ).copyWith(fontSize: 10),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// ═══════════════════════════════════════════════════════════════════════
/// QUICK ACTION BUTTON — contract §8.2
/// ═══════════════════════════════════════════════════════════════════════
class _QuickActionButton extends StatelessWidget {
  final DsColors colors;
  final VoidCallback onPressed;
  const _QuickActionButton({required this.colors, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    final available = MediaQuery.sizeOf(context).width;
    final showLabel = available >= 1100;
    return Semantics(
      button: true,
      label: "Yangi o'quvchi qo'shish",
      child: Tooltip(
        message: "Yangi o'quvchi qo'shish",
        child: Material(
          color: colors.accent,
          borderRadius: DsRadius.smAll,
          child: InkWell(
            onTap: onPressed,
            borderRadius: DsRadius.smAll,
            hoverColor: colors.accentHover,
            focusColor: colors.accent.withValues(alpha: 0.15),
            child: Container(
              height: 40,
              padding: EdgeInsets.symmetric(
                horizontal: showLabel ? 14 : 10,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.person_add_alt_1_rounded,
                    size: 18,
                    color: Colors.white,
                  ),
                  if (showLabel) ...[
                    const SizedBox(width: 6),
                    Text(
                      "Yangi o'quvchi",
                      style: DsType.body(
                        color: Colors.white,
                      ).copyWith(fontWeight: FontWeight.w600),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
