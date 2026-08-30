import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design/design.dart';
import '../providers/report_providers.dart';

/// Talaba statistikasi sahifasi (spec §6 #34).
class StudentStatsPage extends ConsumerWidget {
  const StudentStatsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(studentStatsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Talaba statistikasi'),
      ),
      body: statsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Text('Xato: $error',
              style: TextStyle(color: context.dsColors.error)),
        ),
        data: (stats) {
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Umumiy stats
                _buildOverviewCard(context, stats),
                const SizedBox(height: 16),
                // Holat bo'yicha
                _buildStatusCard(context, stats),
                const SizedBox(height: 16),
                // Davomat
                _buildAttendanceCard(context, stats),
                const SizedBox(height: 16),
                // To'lov
                _buildPaymentCard(context, stats),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildOverviewCard(BuildContext context, dynamic stats) {
    return _GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle('Umumiy'),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _StatItem(
                label: 'Jami',
                value: '${stats.totalStudents}',
                color: context.dsColors.accent,
              ),
              _StatItem(
                label: 'Faol',
                value: '${stats.activeStudents}',
                color: context.dsColors.success,
              ),
              _StatItem(
                label: 'Yangi (oy)',
                value: '${stats.newStudentsThisMonth}',
                color: context.dsColors.info,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatusCard(BuildContext context, dynamic stats) {
    final total = stats.totalStudents > 0 ? stats.totalStudents : 1;

    return _GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle('Holat bo\'yicha'),
          const SizedBox(height: 16),
          _ProgressBar(
            label: 'Faol',
            value: stats.activeStudents,
            total: total,
            color: context.dsColors.success,
          ),
          const SizedBox(height: 8),
          _ProgressBar(
            label: 'Muzlatilgan',
            value: stats.frozenStudents,
            total: total,
            color: context.dsColors.info,
          ),
          const SizedBox(height: 8),
          _ProgressBar(
            label: 'Bitirgan',
            value: stats.graduatedStudents,
            total: total,
            color: context.dsColors.info,
          ),
          const SizedBox(height: 8),
          _ProgressBar(
            label: 'Arxivlangan',
            value: stats.archivedStudents,
            total: total,
            color: context.dsColors.warning,
          ),
        ],
      ),
    );
  }

  Widget _buildAttendanceCard(BuildContext context, dynamic stats) {
    final attendance = stats.averageAttendance;
    final color = attendance >= 80
        ? context.dsColors.success
        : attendance >= 60
            ? context.dsColors.warning
            : context.dsColors.error;

    return _GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle('Davomat'),
          const SizedBox(height: 16),
          Center(
            child: SizedBox(
              width: 120,
              height: 120,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    width: 120,
                    height: 120,
                    child: CircularProgressIndicator(
                      value: attendance / 100,
                      strokeWidth: 12,
                      backgroundColor:
                          context.dsColors.border.withValues(alpha: 0.3),
                      valueColor: AlwaysStoppedAnimation<Color>(color),
                    ),
                  ),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '${attendance.toStringAsFixed(1)}%',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          color: color,
                        ),
                      ),
                      Text(
                        'O\'rtacha',
                        style: TextStyle(
                          fontSize: 12,
                          color: context.dsColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentCard(BuildContext context, dynamic stats) {
    return _GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle('To\'lov holati'),
          const SizedBox(height: 12),
          Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: context.dsColors.error.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${stats.unpaidCount} ta to\'lanmagan',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: context.dsColors.error,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _GlassCard extends StatelessWidget {
  final Widget child;
  const _GlassCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: context.dsColors.surface,
        border: Border.all(color: context.dsColors.border.withValues(alpha: 0.5)),
        boxShadow: [
          BoxShadow(
            color: context.dsColors.divider.withValues(alpha: 0.25),
            blurRadius: 20,
            offset: const Offset(0, 8),
            spreadRadius: -6,
          ),
        ],
      ),
      child: child,
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        color: context.dsColors.textPrimary,
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatItem({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w700,
            color: color,
          ),
        ),
        SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: context.dsColors.textSecondary,
          ),
        ),
      ],
    );
  }
}

class _ProgressBar extends StatelessWidget {
  final String label;
  final int value;
  final int total;
  final Color color;

  const _ProgressBar({
    required this.label,
    required this.value,
    required this.total,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final percentage = total > 0 ? value / total : 0.0;

    return Row(
      children: [
        SizedBox(
          width: 80,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              color: context.dsColors.textSecondary,
            ),
          ),
        ),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: percentage,
              backgroundColor: context.dsColors.border.withValues(alpha: 0.3),
              valueColor: AlwaysStoppedAnimation<Color>(color),
              minHeight: 8,
            ),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 30,
          child: Text(
            '$value',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: color,
            ),
            textAlign: TextAlign.end,
          ),
        ),
      ],
    );
  }
}
