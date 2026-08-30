import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/security/permissions.dart';
import '../../../../core/services/app_haptics.dart';
import '../../../../design/design.dart';

import '../../../../shared/design_system/app/app.dart';
import '../../../../shared/design_system/loading_shimmer.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../auth/presentation/providers/google_auth_provider.dart';
import '../../../groups/presentation/providers/group_providers.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../notifications/presentation/widgets/monthly_report_auto_sender.dart';
import '../../../organization/presentation/providers/organization_providers.dart';
import '../../../intelligence/presentation/providers/intelligence_providers.dart';
import '../../../intelligence/presentation/widgets/next_best_action_section.dart';
import '../../../payments/presentation/providers/payment_providers.dart';
import '../../../students/presentation/providers/student_providers.dart';
import '../../../teachers/presentation/providers/teacher_providers.dart';
import '../providers/dashboard_stats_provider.dart';
import '../widgets/dashboard_activity_feed.dart';
import '../widgets/dashboard_today_overview.dart';
import '../widgets/dashboard_today_schedule.dart';
import '../widgets/home_alert_center.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// BOSH SAHIFA — Crystal Air Design System (Section 2).
///
/// Light, Liquid, Premium, Smooth, Enterprise. Kartasiz — elementlar
/// bo'shliqda suzadi. 3 qatlam:
///   1. Hero stat row (sparkline'lar bilan)
///   2. Tezkor amallar (suzuvchi pill tugmalar)
///   3. Ikki ustunli pastki blok: Bugungi jadval + So'nggi faoliyat
///
/// "No Demo Data" siyosati — hamma ko'rsatkich real bazadan. Desktop
/// (≥900px) va Android (390px) bir til bilan gapiradi, zichlik farqlanadi.
/// ═══════════════════════════════════════════════════════════════════════
class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(dashboardHeroStatsProvider);
    final user = ref.watch(currentUserProvider);
    final organizationName =
        ref.watch(organizationProvider).valueOrNull?.organizationName;
    final studentsCount = ref.watch(studentListProvider).valueOrNull?.length ?? 0;
    final teachersCount = ref.watch(teacherListProvider).valueOrNull?.length ?? 0;
    final groupsCount = ref.watch(groupListProvider).valueOrNull?.length ?? 0;
    final isEmpty =
        studentsCount == 0 && teachersCount == 0 && groupsCount == 0;

    final colors = context.dsColors;

    return Scaffold(
      body: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.scaffold,
        ),
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final isDesktop = constraints.maxWidth >= 900;
              final padding = isDesktop ? const EdgeInsets.symmetric(horizontal: 24) : DsSpacing.pageH;
              return CustomScrollView(
                physics: const BouncingScrollPhysics(),
                slivers: [
                  // Oy yakuni hisobotini avtomatik yuborish (ko'rinmas).
                  const SliverToBoxAdapter(child: MonthlyReportAutoSender()),
                  SliverToBoxAdapter(
                    child: _DashboardHeader(
                      userName: user?.name ?? 'Administrator',
                      organizationName: organizationName,
                      onLogout: () async {
                        final googleService = ref.read(googleAuthProvider);
                        await ref
                            .read(authControllerProvider.notifier)
                            .logout(googleService: googleService);
                        if (context.mounted) context.go('/login');
                      },
                    ),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 20)),
                  if (isEmpty)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: padding,
                        child: AppEmptyState(
                          icon: Icons.rocket_launch_rounded,
                          title: 'Tizim hozircha bo\'sh',
                          subtitle:
                              'Birinchi o\'quvchingizni ro\'yxatga olishdan boshlang — '
                              'statistika real ma\'lumotlar bilan avtomatik to\'ldiriladi.',
                          action: AppButton(
                            onPressed: () => context.push('/identity/register'),
                            label: 'Birinchi o\'quvchini qo\'shish',
                          ),
                        ),
                      ),
                    ),
                  if (isEmpty)
                    const SliverToBoxAdapter(child: SizedBox(height: 20)),
                  // ─── 1. Hero stat row ────────────────────────────────
                  SliverToBoxAdapter(
                    child: _HeroStatsSection(statsAsync: statsAsync),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 16)),
                  // ─── 1.5. Bugungi holat (P2) ─────────────────────────
                  SliverToBoxAdapter(
                    child: LayoutBuilder(
                      builder: (context, constraints) => Padding(
                        padding: constraints.maxWidth >= 900
                            ? const EdgeInsets.symmetric(horizontal: 24)
                            : DsSpacing.pageH,
                        child: const TodayOverviewSection(),
                      ),
                    ),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 16)),
                  // ─── 1.6. Alert Center (Phase 4 — real statuslar) ────
                  SliverToBoxAdapter(
                    child: LayoutBuilder(
                      builder: (context, constraints) => Padding(
                        padding: constraints.maxWidth >= 900
                            ? const EdgeInsets.symmetric(horizontal: 24)
                            : DsSpacing.pageH,
                        child: const HomeAlertCenter(),
                      ),
                    ),
                  ),
                  // ─── 1.7. Next Best Action (Phase 5 — real ma'lumotdan
                  //     tavsiyalar; bo'sh bo'lsa ko'rinmaydi) ────────────
                  SliverToBoxAdapter(
                    child: LayoutBuilder(
                      builder: (context, constraints) => Padding(
                        padding: constraints.maxWidth >= 900
                            ? const EdgeInsets.symmetric(horizontal: 24)
                            : DsSpacing.pageH,
                        child: const NextBestActionSection(),
                      ),
                    ),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 24)),
                  // ─── 2. Tezkor amallar ───────────────────────────────
                  const SliverToBoxAdapter(
                    child: _QuickActionsSection(),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 28)),
                  // ─── 3. Ikki ustunli pastki blok ─────────────────────
                  const SliverToBoxAdapter(
                    child: _BottomSection(),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 32)),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Sarlavha: qidiruv + bildirishnoma + avatar
// ═══════════════════════════════════════════════════════════════════════
class _DashboardHeader extends ConsumerWidget {
  final String userName;
  final String? organizationName;
  final VoidCallback onLogout;

  const _DashboardHeader({
    required this.userName,
    required this.organizationName,
    required this.onLogout,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.dsColors;
    final greeting = _greeting();

    return LayoutBuilder(
      builder: (context, constraints) {
        final isDesktop = constraints.maxWidth >= 900;

        return Padding(
          padding: EdgeInsets.fromLTRB(
            isDesktop ? 32 : 20,
            16,
            isDesktop ? 32 : 20,
            0,
          ),
          child: Row(
            children: [
              // Salomlashuv — ixcham.
              if (isDesktop) ...[
                Expanded(
                  flex: 2,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$greeting • ${_todayLabel()}',
                        style: DsType.caption(
                          color: colors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        userName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: DsType.h2(color: colors.textPrimary),
                      ),
                      if (organizationName != null)
                        Text(
                          organizationName!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: DsType.caption(
                            color: colors.textTertiary,
                          ).copyWith(fontSize: 11),
                        ),
                    ],
                  ),
                ),
              ],
              // Global qidiruv — bir joydan talaba/o'qituvchi/guruh/to'lov.
              Expanded(
                flex: 3,
                child: AppSearchField(
                  hint: 'Talaba, o\'qituvchi, guruh yoki to\'lov...',
                  readOnly: true,
                  onSearch: (_) {},
                  onTap: () => _openSearch(context),
                  semanticLabel: 'Dashboard global qidiruv',
                ),
              ),
              const SizedBox(width: 10),
              // Buyruq markazi (CTRL+K) — mobil uchun touch-kirish.
              AppIconButton(
                icon: Icons.keyboard_command_key_rounded,
                tooltip: 'Buyruq markazi',
                onPressed: () =>
                    ref.read(commandPaletteControllerProvider.notifier).open(),
              ),
              const SizedBox(width: 8),
              // Bildirishnoma qo'ng'irog'i.
              AppIconButton(
                icon: Icons.notifications_none_rounded,
                tooltip: 'Bildirishnomalar',
                onPressed: () => context.push('/notifications'),
              ),
              const SizedBox(width: 10),
              // Profil avatari + chiqish.
              PopupMenuButton<String>(
                onSelected: (value) {
                  if (value == 'logout') onLogout();
                },
                color: colors.surfaceRaised,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(DsRadius.sm),
                ),
                itemBuilder: (context) => [
                  PopupMenuItem(
                    value: 'logout',
                    child: Row(
                      children: [
                        Icon(Icons.logout_rounded,
                            size: 18, color: colors.error),
                        const SizedBox(width: 10),
                        Text(
                          'Chiqish',
                          style: TextStyle(
                            color: colors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                child: Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: colors.accentGradient,
                    boxShadow: DsShadow.glow(colors.accent),
                  ),
                  child: const Icon(
                    Icons.person_rounded,
                    size: 22,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _openSearch(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _GlobalSearchSheet(),
    );
  }

  static String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Xayrli tong 👋';
    if (hour < 18) return 'Xayrli kun 👋';
    return 'Xayrli kech 👋';
  }

  /// Bugungi sana — o'zbek tilida qisqa format (admin har kuni sanaga
  /// qaraydi: davomat, to'lov, hisobot). Windows/mobil bir xil.
  static String _todayLabel() {
    const weekdays = [
      'Dushanba',
      'Seshanba',
      'Chorshanba',
      'Payshanba',
      'Juma',
      'Shanba',
      'Yakshanba',
    ];
    const months = [
      'yanvar',
      'fevral',
      'mart',
      'aprel',
      'may',
      'iyun',
      'iyul',
      'avgust',
      'sentabr',
      'oktabr',
      'noyabr',
      'dekabr',
    ];
    final now = DateTime.now();
    final wd = weekdays[now.weekday - 1];
    final mo = months[now.month - 1];
    return '$wd, ${now.day}-$mo';
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Global qidiruv natijalari
// ═══════════════════════════════════════════════════════════════════════
class _GlobalSearchSheet extends ConsumerStatefulWidget {
  const _GlobalSearchSheet();

  @override
  ConsumerState<_GlobalSearchSheet> createState() => _GlobalSearchSheetState();
}

class _GlobalSearchSheetState extends ConsumerState<_GlobalSearchSheet> {
  String _query = '';

  /// Global qidiruv har bir belgida butun bazani (shaxslar + guruhlar +
  /// to'lovlar) skan qilmasligi uchun debounce — pauzada bir marta ishlaydi.
  static const Duration _searchDebounce = Duration(milliseconds: 180);
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(_searchDebounce, () {
      if (mounted) setState(() => _query = value.trim().toLowerCase());
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        height: MediaQuery.of(context).size.height * 0.7,
        decoration: BoxDecoration(
          color: colors.surfaceRaised,
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(DsRadius.xl),
          ),
        ),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
        child: Column(
          children: [
            // Tutqich (drag handle).
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: colors.borderStrong,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 18),
            AppSearchField(
              hint: 'Qidirish...',
              onSearch: _onSearchChanged,
              semanticLabel: 'Global qidiruv',
            ),
            const SizedBox(height: 16),
            Expanded(child: _buildResults(colors)),
          ],
        ),
      ),
    );
  }

  Widget _buildResults(DsColors colors) {
    if (_query.isEmpty) {    return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.manage_search_rounded,
                    size: 44, color: colors.textTertiary),
                const SizedBox(height: 12),
                Text(
                  'Talaba, o\'qituvchi, guruh yoki to\'lovni qidiring',
                  style: DsType.body(color: colors.textSecondary),
                ),
              ],
            ),
          );
    }

    return FutureBuilder<List<_SearchResult>>(
      future: _search(ref, _query, colors),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator(strokeWidth: 2));
        }
        final results = snapshot.data!;
        if (results.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.search_off_rounded,
                    size: 40, color: colors.textTertiary),
                const SizedBox(height: 10),
                Text(
                  '"$_query" bo\'yicha hech narsa topilmadi',
                  style: DsType.body(color: colors.textSecondary),
                ),
              ],
            ),
          );
        }
        return ListView.separated(
          itemCount: results.length,
          separatorBuilder: (_, __) => const SizedBox(height: 6),
          itemBuilder: (context, index) {
            final r = results[index];
            return AppSurface.glass(
              interactive: true,
              elevation: 0,
              padding: const EdgeInsets.all(12),
              borderRadius: DsRadius.md,
              onTap: () {
                context.pop();
                context.push(r.route);
              },
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: r.color.withValues(alpha: 0.13),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(r.icon, size: 18, color: r.color),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          r.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: DsType.bodyStrong(
                            color: colors.textPrimary,
                          ),
                        ),
                        Text(
                          r.subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: DsType.caption(
                            color: colors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right_rounded,
                      size: 18, color: colors.textTertiary),
                ],
              ),
            );
          },
        );
      },
    );
  }

  static Future<List<_SearchResult>> _search(
    WidgetRef ref,
    String query,
    DsColors colors,
  ) async {
    final results = <_SearchResult>[];
    // colors used directly

    // Har bir kategoriyadan ko'pi bilan [cap] ta natija — 10 000+ yozuvli
    // bazalarda natija ro'yxati ham, skan ham chegaralangan (UI bir zumda).
    const cap = 25;

    // Shaxslar (talaba/o'qituvchi).
    final identities = await ref.read(identityListProvider.future);
    for (final identity in identities) {
      if (results.length >= cap) break;
      if (identity.fullName.toLowerCase().contains(query) ||
          identity.identityId.toLowerCase().contains(query)) {
        results.add(_SearchResult(
          title: identity.fullName,
          subtitle: '${_roleLabel(identity.role)} • ${identity.identityId}',
          icon: _identityIcon(identity.role),
          color: colors.accent,
          route: '/identity/${identity.identityId}',
        ));
      }
    }

    // Guruhlar.
    final groups = await ref.read(groupListProvider.future);
    for (final group in groups) {
      if (results.length >= cap) break;
      if (group.name.toLowerCase().contains(query)) {
        results.add(_SearchResult(
          title: group.name,
          subtitle: 'Guruh',
          icon: Icons.groups_outlined,
          color: colors.accent,
          route: '/groups/${group.groupId}',
        ));
      }
    }

    // To'lovlar.
    final payments = await ref.read(paymentListProvider.future);
    for (final payment in payments.take(200)) {
      if (results.length >= cap) break;
      final name = payment.studentName ?? payment.studentIdentityId;
      final receipt = payment.receiptNumber ?? '';
      if (name.toLowerCase().contains(query) ||
          receipt.toLowerCase().contains(query)) {
        results.add(_SearchResult(
          title: name,
          subtitle:
              'To\'lov • ${receipt.isNotEmpty ? receipt : formatAmount(payment.paidAmount)}',
          icon: Icons.payments_outlined,
          color: colors.warning,
          route: '/finance',
        ));
      }
    }

    return results;
  }
}

class _SearchResult {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final String route;

  const _SearchResult({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.route,
  });
}

// ═══════════════════════════════════════════════════════════════════════
// 1. Hero stat row
// ═══════════════════════════════════════════════════════════════════════
class _HeroStatsSection extends ConsumerWidget {
  final AsyncValue<DashboardHeroStats> statsAsync;

  const _HeroStatsSection({required this.statsAsync});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return statsAsync.when(
      loading: () => const _HeroSkeletonRow(),
      error: (e, _) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Text(
          'Statistika yuklanmadi: $e',
          style: DsType.caption(
            color: context.dsColors.error,
          ),
        ),
      ),
      data: (stats) => LayoutBuilder(
        builder: (context, constraints) {
          final isDesktop = constraints.maxWidth >= 900;
          final colors = context.dsColors;
          final revenueChange = stats.revenueChangePercent;

          final heroCards = <Widget>[
            _HeroStatCard(
              icon: Icons.school_outlined,
              label: 'Faol talabalar',
              value: '${stats.activeStudents}',
              color: colors.accent,
              sparkline: stats.studentsTrend,
              trendLabel: stats.totalStudents > 0
                  ? '${stats.totalStudents} ta umumiy'
                  : null,
              onTap: () {
                AppHaptics.tap();
                context.push('/students');
              },
            ),
            _HeroStatCard(
              icon: Icons.how_to_reg_rounded,
              label: 'Bugungi davomat',
              value: stats.attendancePercent.round().toString(),
              unit: '%',
              color: colors.success,
              sparkline: stats.attendanceTrend,
              trendLabel: 'Oxirgi 7 kun',
              onTap: () {
                AppHaptics.tap();
                context.push('/attendance');
              },
            ),
            _HeroStatCard(
              icon: Icons.account_balance_wallet_outlined,
              label: 'Oylik daromad',
              value: formatAmount(stats.monthlyRevenue),
              unit: 'so\'m',
              color: colors.accent,
              sparkline: stats.revenueTrend,
              trendLabel: revenueChange >= 0
                  ? '+${revenueChange.round()}% o\'tgan oyga'
                  : '${revenueChange.round()}% o\'tgan oyga',
              trendColor: revenueChange >= 0 ? colors.success : colors.error,
              trendIcon: revenueChange >= 0
                  ? Icons.trending_up_rounded
                  : Icons.trending_down_rounded,
              onTap: () {
                AppHaptics.tap();
                context.push('/finance');
              },
            ),
            _HeroStatCard(
              icon: Icons.warning_amber_rounded,
              label: 'Qarzdorlar',
              value: '${stats.debtorCount}',
              color: colors.error,
              sparkline: stats.debtTrend,
              trendLabel: stats.debtorCount > 0
                  ? 'Diqqat talab'
                  : 'Barchasi to\'langan',
              trendColor:
                  stats.debtorCount > 0 ? colors.warning : colors.success,
              onTap: () {
                AppHaptics.tap();
                context.push('/payments/debts');
              },
            ),
          ];

          // Desktop: 4 ustunli grid. Mobil: gorizontal scroll lenta.
          if (isDesktop) {
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Row(
                children: [
                  for (var i = 0; i < heroCards.length; i++) ...[
                    Expanded(child: heroCards[i]),
                    if (i != heroCards.length - 1) const SizedBox(width: 16),
                  ],
                ],
              ),
            );
          }
          return SizedBox(
            height: 264,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: DsSpacing.pageH,
              itemCount: heroCards.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (context, index) =>
                  SizedBox(width: 230, child: heroCards[index]),
            ),
          );
        },
      ),
    );
  }
}

/// Dashboard hero stat card — uses AppSurface.glass with sparkline.
class _HeroStatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final String? unit;
  final Color color;
  final List<double> sparkline;
  final String? trendLabel;
  final Color? trendColor;
  final IconData? trendIcon;
  final VoidCallback onTap;

  const _HeroStatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
    required this.sparkline,
    required this.onTap,
    this.unit,
    this.trendLabel,
    this.trendColor,
    this.trendIcon = Icons.trending_up_rounded,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final effectiveTrendColor = trendColor ?? colors.textTertiary;

    return AppSurface.glass(
      interactive: true,
      onTap: onTap,
      elevation: 1,
      borderRadius: DsRadius.lg,
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Sarlavha: ikon + label.
          Row(
            children: [
              Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 17, color: color),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: DsType.caption(color: colors.textSecondary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          // Katta raqam (tabular figures). FittedBox — katta summalar
          // karta ichida siqilib qolmaydi.
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Flexible(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    value,
                    maxLines: 1,
                    style: DsType.statLarge(color: color),
                  ),
                ),
              ),
              if (unit != null) ...[
                const SizedBox(width: 5),
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    unit!,
                    style: DsType.caption(color: colors.textSecondary),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          // Micro-trend sparkline.
          SizedBox(
            height: 30,
            width: double.infinity,
            child: _Sparkline(values: sparkline, color: color),
          ),
          if (trendLabel != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(
                  trendIcon,
                  size: 13,
                  color: effectiveTrendColor,
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    trendLabel!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: DsType.caption(color: effectiveTrendColor),
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

/// Simple sparkline painter.
class _Sparkline extends StatelessWidget {
  final List<double> values;
  final Color color;
  const _Sparkline({required this.values, required this.color});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _SparklinePainter(values: values, color: color),
      size: Size.infinite,
    );
  }
}

class _SparklinePainter extends CustomPainter {
  final List<double> values;
  final Color color;
  _SparklinePainter({required this.values, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty) return;
    final paint = Paint()
      ..color = color.withValues(alpha: 0.6)
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final minVal = values.reduce((a, b) => a < b ? a : b);
    final maxVal = values.reduce((a, b) => a > b ? a : b);
    final range = (maxVal - minVal).abs();
    if (range == 0) return;

    final path = Path();
    for (var i = 0; i < values.length; i++) {
      final x = (i / (values.length - 1)) * size.width;
      final y = size.height - ((values[i] - minVal) / range) * size.height;
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter oldDelegate) {
    return oldDelegate.values != values || oldDelegate.color != color;
  }
}

class _HeroSkeletonRow extends StatelessWidget {
  const _HeroSkeletonRow();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isDesktop = constraints.maxWidth >= 900;
        final skeleton = AppSurface.glass(
          elevation: 1,
          padding: const EdgeInsets.all(18),
          borderRadius: DsRadius.lg,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              LoadingShimmer(width: 110, height: 34, borderRadius: 10),
              SizedBox(height: 14),
              LoadingShimmer(width: 80, height: 26),
              SizedBox(height: 14),
              LoadingShimmer(height: 28),
              SizedBox(height: 8),
              LoadingShimmer(width: 60, height: 11),
            ],
          ),
        );

        if (isDesktop) {
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Row(
              children: [
                for (var i = 0; i < 4; i++) ...[
                  Expanded(child: skeleton),
                  if (i != 3) const SizedBox(width: 16),
                ],
              ],
            ),
          );
        }
        return SizedBox(
          height: 264,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: DsSpacing.pageH,
            itemCount: 4,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (_, __) => SizedBox(width: 230, child: skeleton),
          ),
        );
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 2. Tezkor amallar — suzuvchi pill tugmalar
// ═══════════════════════════════════════════════════════════════════════
class _QuickActionsSection extends ConsumerWidget {
  const _QuickActionsSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final actorRole = ref.watch(actorRoleProvider);
    final colors = context.dsColors;

    final actions = [
      (
        icon: Icons.person_add_alt_1,
        label: 'Talaba qo\'shish',
        color: colors.accent,
        route: '/identity/register',
        permission: AppPermission.studentsCreate,
      ),
      (
        icon: Icons.how_to_reg_rounded,
        label: 'Davomat belgilash',
        color: colors.success,
        route: '/attendance',
        permission: AppPermission.attendanceCreate,
      ),
      (
        icon: Icons.payments_outlined,
        label: 'To\'lov qabul qilish',
        color: colors.warning,
        route: '/payments/new',
        permission: AppPermission.financeCreate,
      ),
      (
        icon: Icons.group_add_outlined,
        label: 'Guruh yaratish',
        color: colors.accent,
        route: '/groups/create',
        permission: AppPermission.groupsCreate,
      ),
    ];

    final visible =
        actions.where((a) => Permissions.can(actorRole, a.permission)).toList();
    if (visible.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Tezkor amallar',
            style: DsType.h3(color: colors.textPrimary),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final action in visible)
                _QuickActionPill(
                  icon: action.icon,
                  label: action.label,
                  color: action.color,
                  onTap: () => context.push(action.route),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Quick Action Pill — AppSurface.glass based
// ═══════════════════════════════════════════════════════════════════════
class _QuickActionPill extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickActionPill({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return AppSurface.glass(
      interactive: true,
      elevation: 1,
      borderRadius: DsRadius.full,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      onTap: onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 30,
            height: 30,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 16, color: color),
          ),
          const SizedBox(width: 10),
          Text(
            label,
            style: DsType.bodyStrong(color: colors.textPrimary),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 3. Ikki ustunli pastki blok
// ═══════════════════════════════════════════════════════════════════════
class _BottomSection extends StatelessWidget {
  const _BottomSection();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isDesktop = constraints.maxWidth >= 900;
        final schedule = const TodayScheduleTimeline();
        final feed = const ActivityFeed();

        if (isDesktop) {
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 5, child: schedule),
                const SizedBox(width: 16),
                Expanded(flex: 6, child: feed),
              ],
            ),
          );
        }
        return Padding(
          padding: DsSpacing.pageH,
          child: Column(
            children: [
              schedule,
              const SizedBox(height: 16),
              feed,
            ],
          ),
        );
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Yordamchi funksiyalar
// ═══════════════════════════════════════════════════════════════════════
IconData _identityIcon(IdentityRole role) {
  return switch (role) {
    IdentityRole.student => Icons.school_outlined,
    IdentityRole.teacher => Icons.co_present_outlined,
    IdentityRole.staff => Icons.badge_outlined,
    IdentityRole.parent => Icons.family_restroom_outlined,
  };
}

String _roleLabel(IdentityRole role) {
  return switch (role) {
    IdentityRole.student => 'Talaba',
    IdentityRole.teacher => "O'qituvchi",
    IdentityRole.staff => 'Xodim',
    IdentityRole.parent => 'Ota-ona',
  };
}
