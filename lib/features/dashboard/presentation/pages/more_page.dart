import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/security/permissions.dart';
import '../../../../core/services/app_haptics.dart';
import '../../../../core/extensions/l10n_context.dart';
import '../../../../design/design.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../settings/domain/entities/app_settings.dart';

/// context.l10n.moreTitle sahifasi — pastki navigatsiyaga sig'magan barcha bo'limlar.
class MorePage extends ConsumerWidget {
  const MorePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(actorRoleProvider);
    return Scaffold(
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(child: _buildHeader(context)),
          const SliverToBoxAdapter(child: SizedBox(height: 8)),
          ..._buildSections(context, role),
          const SliverToBoxAdapter(child: SizedBox(height: 32)),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    final colors = context.dsColors;
    return SafeArea(
      bottom: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
        decoration: BoxDecoration(
          color: colors.scaffold,
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                gradient: colors.accentGradient,
                borderRadius: DsRadius.mdAll,
                boxShadow: [
                  BoxShadow(
                    color: colors.accent.withValues(alpha: 0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: const Icon(
                Icons.grid_view_rounded,
                color: Colors.white,
                size: 24,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    context.l10n.moreTitle,
                    style: DsType.h1(color: colors.textPrimary),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    context.l10n.moreAllSections,
                    style: DsType.caption(color: colors.textSecondary),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildSections(BuildContext context, UserRole role) {
    return [
      _Section(
        title: context.l10n.moreFinance,
        role: role,
        items: [
          _MoreItem(
            icon: Icons.account_balance_wallet_outlined,
            label: context.l10n.morePayments,
            subtitle: context.l10n.morePaymentsSubtitle,
            colorToken: (colors) => colors.accent,
            route: '/finance',
            isBranchGo: true,
            permission: AppPermission.financeView,
          ),
          _MoreItem(
            icon: Icons.warning_amber_rounded,
            label: context.l10n.moreDebts,
            subtitle: context.l10n.moreDebtsSubtitle,
            colorToken: (colors) => colors.error,
            route: '/payments/debts',
            permission: AppPermission.financeView,
          ),
          _MoreItem(
            icon: Icons.payments_outlined,
            label: context.l10n.moreNewPayment,
            subtitle: context.l10n.moreNewPaymentSubtitle,
            colorToken: (colors) => colors.success,
            route: '/payments/new',
            permission: AppPermission.financeCreate,
          ),
          _MoreItem(
            icon: Icons.request_quote_outlined,
            label: context.l10n.moreExpense,
            subtitle: context.l10n.moreExpenseSubtitle,
            colorToken: (colors) => colors.warning,
            route: '/finance/expense/new',
            permission: AppPermission.financeCreate,
          ),
        ],
      ),
      _Section(
        title: context.l10n.moreReports,
        role: role,
        items: [
          _MoreItem(
            icon: Icons.insert_chart_outlined,
            label: context.l10n.moreReportsCenter,
            subtitle: context.l10n.moreReportsCenterSubtitle,
            colorToken: (colors) => colors.warning,
            route: '/reports',
            isBranchGo: true,
            permission: AppPermission.reportsView,
          ),
          _MoreItem(
            icon: Icons.analytics_outlined,
            label: context.l10n.moreStudentStats,
            subtitle: context.l10n.moreStudentStatsSubtitle,
            colorToken: (colors) => colors.accent,
            route: '/reports/students',
            permission: AppPermission.reportsView,
          ),
          _MoreItem(
            icon: Icons.calendar_month_outlined,
            label: context.l10n.moreMonthlyAttendance,
            subtitle: context.l10n.moreMonthlyAttendanceSubtitle,
            colorToken: (colors) => colors.info,
            route: '/reports/monthly',
            permission: AppPermission.reportsView,
          ),
          _MoreItem(
            icon: Icons.trending_up,
            label: context.l10n.moreRevenue,
            subtitle: context.l10n.moreRevenueSubtitle,
            colorToken: (colors) => colors.success,
            route: '/reports/revenue',
            permission: AppPermission.reportsView,
          ),
          _MoreItem(
            icon: Icons.receipt_long_outlined,
            label: context.l10n.moreDebtReport,
            subtitle: context.l10n.moreDebtReportSubtitle,
            colorToken: (colors) => colors.error,
            route: '/reports/debts',
            permission: AppPermission.reportsView,
          ),
        ],
      ),
      _Section(
        title: 'Davomat va vazifalar',
        role: role,
        items: [
          _MoreItem(
            icon: Icons.how_to_reg_outlined,
            label: context.l10n.navAttendance,
            subtitle: 'Faol dars bo\'yicha davomat belgilash',
            colorToken: (colors) => colors.success,
            route: '/attendance',
            isBranchGo: true,
            permission: AppPermission.attendanceCreate,
          ),
          _MoreItem(
            icon: Icons.dashboard_customize_outlined,
            label: 'Davomat markazi',
            subtitle: 'Bugungi darslar va belgilash holati',
            colorToken: (colors) => colors.info,
            route: '/attendance/center',
            permission: AppPermission.attendanceView,
          ),
          _MoreItem(
            icon: Icons.history_outlined,
            label: 'Davomat tarixi',
            subtitle: 'Sana oralig\'i va holat bo\'yicha yozuvlar',
            colorToken: (colors) => colors.info,
            route: '/attendance/history',
            permission: AppPermission.attendanceView,
          ),
          _MoreItem(
            icon: Icons.assignment_outlined,
            label: context.l10n.navHomework,
            subtitle: 'Vazifalar va topshirish holati',
            colorToken: (colors) => colors.accent,
            route: '/homework',
            isBranchGo: true,
          ),
        ],
      ),
      _Section(
        title: context.l10n.moreManagement,
        role: role,
        items: [
          _MoreItem(
            icon: Icons.co_present_outlined,
            label: context.l10n.moreTeachers,
            subtitle: context.l10n.moreTeachersSubtitle,
            colorToken: (colors) => colors.info,
            route: '/teachers',
            isBranchGo: true,
            permission: AppPermission.teachersView,
          ),
          _MoreItem(
            icon: Icons.groups_outlined,
            label: context.l10n.moreGroups,
            subtitle: context.l10n.moreGroupsSubtitle,
            colorToken: (colors) => colors.success,
            route: '/groups',
            isBranchGo: true,
            permission: AppPermission.groupsView,
          ),
          _MoreItem(
            icon: Icons.meeting_room_outlined,
            label: context.l10n.moreRooms,
            subtitle: context.l10n.moreRoomsSubtitle,
            colorToken: (colors) => colors.accent,
            route: '/schedule/rooms',
            permission: AppPermission.scheduleView,
          ),
          _MoreItem(
            icon: Icons.badge_outlined,
            label: context.l10n.moreIdPersons,
            subtitle: context.l10n.moreIdPersonsSubtitle,
            colorToken: (colors) => colors.warning,
            route: '/identity',
            permission: AppPermission.studentsView,
          ),
          _MoreItem(
            icon: Icons.notifications_outlined,
            label: context.l10n.moreNotifications,
            subtitle: context.l10n.moreNotificationsSubtitle,
            colorToken: (colors) => colors.success,
            route: '/notifications',
          ),
          _MoreItem(
            icon: Icons.filter_alt_outlined,
            label: context.l10n.moreCrm,
            subtitle: context.l10n.moreCrmSubtitle,
            colorToken: (colors) => colors.info,
            route: '/crm',
            permission: AppPermission.crmLeadsView,
          ),
          _MoreItem(
            icon: Icons.emoji_events_outlined,
            label: context.l10n.moreGamification,
            subtitle: context.l10n.moreGamificationSubtitle,
            colorToken: (colors) => colors.warning,
            route: '/gamification',
            permission: AppPermission.financeView,
          ),
          _MoreItem(
            icon: Icons.grade_outlined,
            label: context.l10n.moreGrades,
            subtitle: context.l10n.moreGradesSubtitle,
            colorToken: (colors) => colors.info,
            route: '/grades',
            permission: AppPermission.gradesView,
          ),
        ],
      ),
      _Section(
        title: context.l10n.moreConnections,
        role: role,
        items: [
          _MoreItem(
            icon: Icons.face_retouching_natural,
            label: context.l10n.moreFaceId,
            subtitle: context.l10n.moreFaceIdSubtitle,
            colorToken: (colors) => colors.accent,
            route: '/face-scan',
            permission: AppPermission.faceIdUse,
          ),
          _MoreItem(
            icon: Icons.qr_code_scanner,
            label: context.l10n.moreQrScanner,
            subtitle: context.l10n.moreQrScannerSubtitle,
            colorToken: (colors) => colors.info,
            route: '/identity/scan',
            permission: AppPermission.attendanceCreate,
          ),
          _MoreItem(
            icon: Icons.send_outlined,
            label: context.l10n.moreTelegram,
            subtitle: context.l10n.moreTelegramSubtitle,
            colorToken: (colors) => colors.info,
            route: '/settings',
            isBranchGo: true,
            permission: AppPermission.settingsView,
          ),
          _MoreItem(
            icon: Icons.print_outlined,
            label: context.l10n.morePrinter,
            subtitle: context.l10n.morePrinterSubtitle,
            colorToken: (colors) => colors.info,
            route: '/settings',
            isBranchGo: true,
            permission: AppPermission.settingsView,
          ),
          _MoreItem(
            icon: Icons.backup_outlined,
            label: context.l10n.moreBackup,
            subtitle: context.l10n.moreBackupSubtitle,
            colorToken: (colors) => colors.warning,
            route: '/settings',
            isBranchGo: true,
            permission: AppPermission.settingsView,
          ),
        ],
      ),
      _Section(
        title: context.l10n.moreSystem,
        role: role,
        items: [
          _MoreItem(
            icon: Icons.book_outlined,
            label: context.l10n.moreSubjects,
            subtitle: context.l10n.moreSubjectsSubtitle,
            colorToken: (colors) => colors.info,
            route: '/settings',
            isBranchGo: true,
            permission: AppPermission.settingsView,
          ),
          _MoreItem(
            icon: Icons.manage_accounts_outlined,
            label: context.l10n.moreUsers,
            subtitle: context.l10n.moreUsersSubtitle,
            colorToken: (colors) => colors.accent,
            route: '/settings/users',
            isBranchGo: true,
            permission: AppPermission.usersView,
          ),
          _MoreItem(
            icon: Icons.settings_outlined,
            label: context.l10n.moreSettings,
            subtitle: context.l10n.moreSettingsSubtitle,
            colorToken: (colors) => colors.textPrimary,
            route: '/settings',
            isBranchGo: true,
            permission: AppPermission.settingsView,
          ),
        ],
      ),
    ];
  }
}

class _Section extends StatelessWidget {
  final String title;
  final List<_MoreItem> items;
  final UserRole role;

  const _Section({required this.title, required this.items, required this.role});

  @override
  Widget build(BuildContext context) {
    final visible = items
        .where((i) =>
            i.permission == null || Permissions.can(role, i.permission!))
        .toList();
    if (visible.isEmpty) return const SliverToBoxAdapter(child: SizedBox.shrink());

    final colors = context.dsColors;

    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 8, 4, 10),
              child: Text(
                title,
                style: DsType.overline(color: colors.textTertiary),
              ),
            ),
            Container(
              decoration: BoxDecoration(
                borderRadius: DsRadius.lgAll,
                color: colors.surface,
                boxShadow: DsShadow.low,
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  for (var i = 0; i < visible.length; i++) ...[
                    _MoreItemTile(item: visible[i]),
                    if (i != visible.length - 1)
                      Divider(
                        height: 1,
                        indent: 64,
                        color: colors.divider,
                      ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}

class _MoreItem {
  final IconData icon;
  final String label;
  final String subtitle;
  final Color Function(DsColors) colorToken;
  final String route;
  final bool isBranchGo;
  final AppPermission? permission;

  const _MoreItem({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.colorToken,
    required this.route,
    this.isBranchGo = false,
    this.permission,
  });
}

class _MoreItemTile extends StatelessWidget {
  final _MoreItem item;

  const _MoreItemTile({required this.item});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final color = item.colorToken(colors);

    return InkWell(
      onTap: () {
        AppHaptics.tap();
        if (item.isBranchGo) {
          context.go(item.route);
        } else {
          context.push(item.route);
        }
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: DsRadius.mdAll,
              ),
              child: Icon(item.icon, color: color, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.label,
                    style: DsType.bodyStrong(color: colors.textPrimary),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    item.subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: DsType.caption(color: colors.textSecondary),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right,
              size: 18,
              color: colors.textTertiary,
            ),
          ],
        ),
      ),
    );
  }
}
