import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/security/permissions.dart';
import '../../../../design/design.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../domain/entities/report.dart';
import '../providers/report_providers.dart';

/// Hisobotlar sahifasi (spec §6 #34-37).
///
/// Barcha hisobot turlarini ko'rsatadi.
class ReportsPage extends ConsumerWidget {
  const ReportsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Hisobotlar'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildSectionTitle(context, "Tezkor ko'rish"),
            const SizedBox(height: 12),
            _buildQuickStats(context, ref),
            const SizedBox(height: 24),
            _buildSectionTitle(context, "Hisobot turlari"),
            const SizedBox(height: 12),
            _buildReportCards(context),
            const SizedBox(height: 24),
            _buildSectionTitle(context, "Oxirgi hisobotlar"),
            const SizedBox(height: 12),
            _buildRecentReports(context, ref),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(BuildContext context, String title) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: context.dsColors.textPrimary,
      ),
    );
  }

  Widget _buildQuickStats(BuildContext context, WidgetRef ref) {
    final studentStats = ref.watch(studentStatsProvider);
    final revenueStats = ref.watch(revenueStatsProvider);

    return Row(
      children: [
        Expanded(
          child: _QuickStatCard(
            label: 'Talabalar',
            value: studentStats.valueOrNull?.activeStudents.toString() ?? '0',
            icon: Icons.people,
            color: context.dsColors.accent,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _QuickStatCard(
            label: 'Oylik tushum',
            value:
                _formatCurrency(revenueStats.valueOrNull?.monthlyRevenue ?? 0),
            icon: Icons.attach_money,
            color: context.dsColors.success,
          ),
        ),
      ],
    );
  }

  Widget _buildReportCards(BuildContext context) {
    final reports = [
      (
        icon: Icons.school,
        title: "Talaba statistikasi",
        subtitle: "Umumiy, faol, muzlatilgan, bitirgan",
        route: '/reports/students',
        color: context.dsColors.accent,
      ),
      (
        icon: Icons.trending_up,
        title: "Daromad hisoboti",
        subtitle: "Kirim/chiqim, oylik, to'lov turlari",
        route: '/reports/revenue',
        color: context.dsColors.warning,
      ),
      (
        icon: Icons.payment,
        title: "Qarzdorlik hisoboti",
        subtitle: "Muddati o'tgan, umumiy qarz",
        route: '/reports/debts',
        color: context.dsColors.error,
      ),
      (
        icon: Icons.calendar_month,
        title: "Oylik davomat",
        subtitle: "Kunlar bo'yicha hisobot + Telegram",
        route: '/reports/monthly',
        color: context.dsColors.info,
      ),
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 1.3,
      ),
      itemCount: reports.length,
      itemBuilder: (context, index) {
        final r = reports[index];
        return _ReportCard(
          icon: r.icon,
          title: r.title,
          subtitle: r.subtitle,
          color: r.color,
          onTap: () => context.push(r.route),
        );
      },
    );
  }

  Widget _buildRecentReports(BuildContext context, WidgetRef ref) {
    final reportsAsync = ref.watch(savedReportsProvider);

    return reportsAsync.when(
      loading: () => Center(child: CircularProgressIndicator()),
      error: (error, _) =>
          Text('Xato: $error', style: TextStyle(color: context.dsColors.error)),
      data: (reports) {
        if (reports.isEmpty) {
          return Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: context.dsColors.surface,
            ),
            child: Center(
              child: Text(
                "Hali saqlangan hisobotlar yo'q",
                style: TextStyle(color: context.dsColors.textSecondary),
              ),
            ),
          );
        }
        // AUDIT P1-02: real persistence — saqlangan hisobotlar ro'yxati
        // (LOAD) va o'chirish (DELETE).
        return Column(
          children: [
            for (final report in reports)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  color: context.dsColors.surface,
                ),
                child: Row(
                  children: [
                    Icon(
                      _reportTypeIcon(report.type),
                      size: 18,
                      color: _reportTypeColor(context, report.type),
                    ),
                    SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            report.title,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: context.dsColors.textPrimary,
                            ),
                          ),
                          Text(
                            '${_reportTypeLabel(report.type)} • '
                            '${_formatDate(report.createdAt)}',
                            style: TextStyle(
                              fontSize: 11,
                              color: context.dsColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // UX: o'chirish faqat reportsDelete ruxsati borlarga
                    // ko'rinadi (security command ichida — PHASE C).
                    if (Permissions.can(ref.watch(actorRoleProvider),
                        AppPermission.reportsDelete))
                      IconButton(
                        icon: Icon(Icons.delete_outline,
                            size: 20, color: context.dsColors.error),
                        tooltip: "O'chirish",
                        visualDensity: VisualDensity.compact,
                        onPressed: () =>
                            _deleteReport(context, ref, report.reportId),
                      ),
                  ],
                ),
              ),
          ],
        );
      },
    );
  }

  Future<void> _deleteReport(
    BuildContext context,
    WidgetRef ref,
    String reportId,
  ) async {
    // AUDIT F2: RBAC command orqali — ruxsatsiz user DENY oladi.
    try {
      await ref.read(deleteReportCommandProvider).execute(reportId);
      ref.read(savedReportsVersionProvider.notifier).state++;
    } on Failure catch (failure) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(failure.message),
          backgroundColor: context.dsColors.error,
        ),
      );
    }
  }

  String _formatDate(DateTime date) {
    return '${date.day}.${date.month.toString().padLeft(2, '0')}.${date.year}';
  }

  String _reportTypeLabel(ReportType type) {
    return switch (type) {
      ReportType.studentStats => "Talaba statistikasi",
      ReportType.groupStats => "Guruh statistikasi",
      ReportType.revenue => "Daromad",
      ReportType.debt => "Qarzdorlik",
      ReportType.attendance => "Davomat",
      ReportType.teacherWorkload => "O'qituvchi yuklamasi",
    };
  }

  IconData _reportTypeIcon(ReportType type) {
    return switch (type) {
      ReportType.studentStats => Icons.school,
      ReportType.groupStats => Icons.groups,
      ReportType.revenue => Icons.trending_up,
      ReportType.debt => Icons.payment,
      ReportType.attendance => Icons.calendar_month,
      ReportType.teacherWorkload => Icons.assignment_ind,
    };
  }

  Color _reportTypeColor(BuildContext context, ReportType type) {
    return switch (type) {
      ReportType.studentStats => context.dsColors.accent,
      ReportType.groupStats => context.dsColors.info,
      ReportType.revenue => context.dsColors.warning,
      ReportType.debt => context.dsColors.error,
      ReportType.attendance => context.dsColors.success,
      ReportType.teacherWorkload => context.dsColors.info,
    };
  }

  String _formatCurrency(int amount) {
    if (amount >= 1000000) {
      return '${(amount / 1000000).toStringAsFixed(1)}M';
    }
    if (amount >= 1000) {
      return '${(amount / 1000).toStringAsFixed(0)}K';
    }
    return amount.toString();
  }
}

class _QuickStatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _QuickStatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: color.withValues(alpha: 0.1),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  color: context.dsColors.textSecondary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ReportCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _ReportCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          color: context.dsColors.surface,
          border: Border.all(
            color: context.dsColors.border.withValues(alpha: 0.5),
            width: 0.8,
          ),
          boxShadow: [
            BoxShadow(
              color: context.dsColors.divider.withValues(alpha: 0.25),
              blurRadius: 20,
              offset: const Offset(0, 8),
              spreadRadius: -6,
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const Spacer(),
            Text(
              title,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
            SizedBox(height: 2),
            Text(
              subtitle,
              style: TextStyle(
                fontSize: 10,
                color: context.dsColors.textSecondary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
