import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/extensions/l10n_context.dart';
import '../../../../core/security/permissions.dart';
import '../../../../design/design.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../shared/design_system/app/app_bottom_navigation.dart';
import '../../../../shared/design_system/app/app_connection_status.dart';
import '../../../../shared/design_system/app/app_shell_top_bar.dart';
import '../../../../shared/design_system/app/app_sidebar.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../auth/presentation/providers/google_auth_provider.dart';
import '../../../intelligence/presentation/widgets/command_palette_host.dart';
import '../../../settings/domain/entities/app_settings.dart';

/// Ilovaning asosiy qobig'i (PHASE D — responsive app shell).
class MainShellPage extends ConsumerWidget {
  final StatefulNavigationShell navigationShell;

  const MainShellPage({super.key, required this.navigationShell});

  static const List<int> _mobileBranchMap = [0, 1, 2, -1]; // -1 = Barchasi sheet

  int get _displayIndex {
    final i = _mobileBranchMap.indexOf(navigationShell.currentIndex);
    return i == -1 ? 4 : i;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(actorRoleProvider);
    final colors = context.dsColors;
    final l10n = context.l10n;
    final displayIndex = _displayIndex;

    return CommandPaletteHost(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final breakpoint = DsBreakpointX.fromWidth(constraints.maxWidth);
          if (breakpoint.isDesktop) {
            return _buildDesktopShell(context, ref, role, colors, l10n);
          }
          return _buildMobileShell(context, displayIndex, colors, l10n);
        },
      ),
    );
  }

  Widget _buildDesktopShell(
    BuildContext context,
    WidgetRef ref,
    UserRole role,
    DsColors colors,
    AppLocalizations l10n,
  ) {
    return Scaffold(
      backgroundColor: colors.scaffold,
      body: Row(
        children: [
          RepaintBoundary(
            child: AppSidebar(
              currentIndex: navigationShell.currentIndex,
              primary: _primaryDestinations(l10n, role),
              secondary: _secondaryDestinations(l10n, role),
              utility: _utilityDestinations(l10n, role),
              onDestinationSelected: (i) =>
                  navigationShell.goBranch(i),
              onLogout: () => _logout(context, ref),
            ),
          ),
          Expanded(
            child: Column(
              children: [
                AppShellTopBar(
                  crumbs: _crumbsFor(navigationShell.currentIndex, l10n),
                  onLogout: () => _logout(context, ref),
                  onNotificationsTap: () => context.push('/notifications'),
                  connectionStatus: const AppConnectionStatus(),
                ),
                Expanded(
                  child: RepaintBoundary(child: navigationShell),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMobileShell(
    BuildContext context,
    int displayIndex,
    DsColors colors,
    AppLocalizations l10n,
  ) {
    return Scaffold(
      extendBody: false,
      backgroundColor: colors.scaffold,
      body: RepaintBoundary(
        child: navigationShell,
      ),
      bottomNavigationBar: MediaQuery.viewInsetsOf(context).bottom > 0
          ? null
          : AppBottomNavigationBar(
              currentIndex: displayIndex,
              destinations: _mobileDestinations(l10n),
              onDestinationSelected: (index) {
                if (index == 3) {
                  _showAllMenuSheet(context, l10n);
                  return;
                }
                navigationShell.goBranch(_mobileBranchMap[index]);
              },
            ),
    );
  }

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    final googleService = ref.read(googleAuthProvider);
    await ref.read(authControllerProvider.notifier).logout(googleService: googleService);
    if (context.mounted) context.go('/login');
  }

  void _showAllMenuSheet(BuildContext context, AppLocalizations l10n) {
    final colors = context.dsColors;
    final items = <_AllMenuEntry>[
      _AllMenuEntry(
        icon: Icons.groups_outlined,
        label: l10n.navGroups,
        onTap: () => context.go('/groups'),
      ),
      _AllMenuEntry(
        icon: Icons.co_present_outlined,
        label: l10n.navTeachers,
        onTap: () => context.go('/teachers'),
      ),
      _AllMenuEntry(
        icon: Icons.calendar_month_outlined,
        label: l10n.navSchedule,
        onTap: () => context.go('/schedule'),
      ),
      _AllMenuEntry(
        icon: Icons.account_balance_wallet_outlined,
        label: l10n.navFinance,
        onTap: () => context.go('/finance'),
      ),
      _AllMenuEntry(
        icon: Icons.insert_chart_outlined,
        label: l10n.navReports,
        onTap: () => context.go('/reports'),
      ),
      _AllMenuEntry(
        icon: Icons.assignment_outlined,
        label: l10n.navHomework,
        onTap: () => context.go('/homework'),
      ),
      _AllMenuEntry(
        icon: Icons.notifications_none_outlined,
        label: l10n.notificationsTitle,
        onTap: () => context.push('/notifications'),
      ),
      _AllMenuEntry(
        icon: Icons.settings_outlined,
        label: l10n.navSettings,
        onTap: () => context.go('/settings'),
      ),
    ];

    final bottomInset = MediaQuery.viewPaddingOf(context).bottom;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        margin: EdgeInsets.only(bottom: bottomInset > 0 ? bottomInset : 0),
        decoration: BoxDecoration(
          color: colors.surfaceRaised,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          boxShadow: [
            BoxShadow(
              color: colors.scrim.withValues(alpha: 0.15),
              blurRadius: 40,
              offset: const Offset(0, -8),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: DraggableScrollableSheet(
            initialChildSize: 0.65,
            minChildSize: 0.3,
            maxChildSize: 0.85,
            expand: false,
            builder: (context, scrollController) => Column(
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 12, bottom: 8),
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: colors.borderStrong.withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      l10n.commonAll,
                      style: DsType.h2(color: colors.textPrimary),
                    ),
                  ),
                ),
                Expanded(
                  child: GridView.builder(
                    controller: scrollController,
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      childAspectRatio: 2.2,
                    ),
                    itemCount: items.length,
                    itemBuilder: (context, index) {
                      final entry = items[index];
                      return _SheetGridItem(
                        entry: entry,
                        onTap: () {
                          Navigator.of(context).pop();
                          entry.onTap();
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<String> _crumbsFor(int index, AppLocalizations l10n) {
    if (index == 7) {
      return [l10n.navSettings, l10n.moreUsers];
    }
    return [_branchLabel(index, l10n)];
  }

  String _branchLabel(int index, AppLocalizations l10n) {
    return switch (index) {
      0 => l10n.navHome,
      1 => l10n.navStudents,
      2 => l10n.navAttendance,
      3 => l10n.navSchedule,
      4 => l10n.navMore,
      5 => l10n.navFinance,
      6 => l10n.navSettings,
      7 => l10n.navSettings,
      8 => l10n.navGroups,
      9 => l10n.navReports,
      10 => l10n.navHomework,
      11 => l10n.navTeachers,
      _ => '',
    };
  }

  List<AppNavDestination> _mobileDestinations(AppLocalizations l10n) => [
        AppNavDestination(
          icon: Icons.home_outlined,
          activeIcon: Icons.home_rounded,
          label: l10n.navHome,
        ),
        AppNavDestination(
          icon: Icons.people_outline,
          activeIcon: Icons.people_rounded,
          label: l10n.navStudents,
        ),
        AppNavDestination(
          icon: Icons.how_to_reg_outlined,
          activeIcon: Icons.how_to_reg_rounded,
          label: l10n.navAttendance,
        ),
        AppNavDestination(
          icon: Icons.grid_view_outlined,
          activeIcon: Icons.grid_view_rounded,
          label: l10n.commonAll,
        ),
      ];

  List<AppSidebarDestination> _primaryDestinations(
    AppLocalizations l10n,
    UserRole role,
  ) =>
      [
        AppSidebarDestination(
          label: l10n.navHome,
          icon: Icons.home_outlined,
          activeIcon: Icons.home_rounded,
          branchIndex: 0,
        ),
        if (Permissions.can(role, AppPermission.studentsView))
          AppSidebarDestination(
            label: l10n.navStudents,
            icon: Icons.people_outline,
            activeIcon: Icons.people_rounded,
            branchIndex: 1,
          ),
        if (Permissions.can(role, AppPermission.groupsView))
          AppSidebarDestination(
            label: l10n.navGroups,
            icon: Icons.groups_outlined,
            activeIcon: Icons.groups_rounded,
            branchIndex: 8,
          ),
        if (Permissions.can(role, AppPermission.teachersView))
          AppSidebarDestination(
            label: l10n.navTeachers,
            icon: Icons.co_present_outlined,
            activeIcon: Icons.co_present_rounded,
            branchIndex: 11,
          ),
        if (Permissions.can(role, AppPermission.scheduleView))
          AppSidebarDestination(
            label: l10n.navSchedule,
            icon: Icons.calendar_month_outlined,
            activeIcon: Icons.calendar_month_rounded,
            branchIndex: 3,
          ),
        if (Permissions.can(role, AppPermission.attendanceView))
          AppSidebarDestination(
            label: l10n.navAttendance,
            icon: Icons.how_to_reg_outlined,
            activeIcon: Icons.how_to_reg_rounded,
            branchIndex: 2,
          ),
        if (Permissions.can(role, AppPermission.attendanceView))
          AppSidebarDestination(
            label: l10n.navHomework,
            icon: Icons.assignment_outlined,
            activeIcon: Icons.assignment_rounded,
            branchIndex: 10,
          ),
      ];

  List<AppSidebarDestination> _secondaryDestinations(
    AppLocalizations l10n,
    UserRole role,
  ) =>
      [
        if (Permissions.can(role, AppPermission.financeView))
          AppSidebarDestination(
            label: l10n.navFinance,
            icon: Icons.account_balance_wallet_outlined,
            activeIcon: Icons.account_balance_wallet_rounded,
            branchIndex: 5,
          ),
        if (Permissions.can(role, AppPermission.reportsView))
          AppSidebarDestination(
            label: l10n.navReports,
            icon: Icons.insert_chart_outlined,
            activeIcon: Icons.insert_chart_rounded,
            branchIndex: 9,
          ),
      ];

  List<AppSidebarDestination> _utilityDestinations(
    AppLocalizations l10n,
    UserRole role,
  ) =>
      [
        AppSidebarDestination(
          label: l10n.navMore,
          icon: Icons.grid_view_outlined,
          activeIcon: Icons.grid_view_rounded,
          branchIndex: 4,
        ),
        if (Permissions.can(role, AppPermission.settingsView))
          AppSidebarDestination(
            label: l10n.navSettings,
            icon: Icons.settings_outlined,
            activeIcon: Icons.settings_rounded,
            branchIndex: 6,
          ),
      ];
}

class _AllMenuEntry {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _AllMenuEntry({
    required this.icon,
    required this.label,
    required this.onTap,
  });
}

class _SheetGridItem extends StatelessWidget {
  final _AllMenuEntry entry;
  final VoidCallback onTap;

  const _SheetGridItem({
    required this.entry,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return Material(
      color: colors.surface,
      borderRadius: DsRadius.mdAll,
      child: InkWell(
        onTap: onTap,
        borderRadius: DsRadius.mdAll,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: DsRadius.mdAll,
            border: Border.all(
              color: colors.border.withValues(alpha: 0.5),
              width: 0.5,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: colors.accent.withValues(alpha: 0.1),
                  borderRadius: DsRadius.smAll,
                ),
                child: Icon(
                  entry.icon,
                  size: 20,
                  color: colors.accent,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  entry.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: DsType.body(
                    color: colors.textPrimary,
                  ).copyWith(fontWeight: FontWeight.w500),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
