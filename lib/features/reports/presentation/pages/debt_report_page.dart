import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design/design.dart';
import '../../domain/entities/report.dart';
import '../providers/report_providers.dart';

/// Qarzdorlik hisoboti sahifasi.
class DebtReportPage extends ConsumerWidget {
  const DebtReportPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(debtStatsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Qarzdorlik hisoboti'),
      ),
      body: statsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Text('Xato: $error',
              style: TextStyle(color: context.dsColors.error)),
        ),
        data: (stats) {
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  Expanded(
                    child: _StatCard(
                      label: 'Umumiy qarz',
                      value: stats.totalDebt,
                      color: context.dsColors.error,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _StatCard(
                      label: "Muddati o'tgan",
                      value: stats.overdueDebt,
                      color: context.dsColors.warning,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _StatCard(
                      label: 'Qarzdorlar',
                      value: stats.debtorsCount,
                      color: context.dsColors.accent,
                      isCount: true,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _StatCard(
                      label: 'Qarzdorliklar',
                      value: stats.debts.length,
                      color: context.dsColors.info,
                      isCount: true,
                    ),
                  ),
                ],
              ),
              SizedBox(height: 20),
              Text(
                "Qarzdor talabalar",
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  color: context.dsColors.textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              if (stats.debts.isEmpty)
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    color: context.dsColors.success.withValues(alpha: 0.08),
                    border: Border.all(
                      color: context.dsColors.success.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Center(
                    child: Column(
                      children: [
                        Icon(Icons.check_circle,
                            color: context.dsColors.success, size: 40),
                        SizedBox(height: 8),
                        Text(
                          "Barcha qarzdorliklar to'langan!",
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: context.dsColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else
                for (final debt in stats.debts) _DebtRow(debt: debt),
            ],
          );
        },
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  final bool isCount;

  const _StatCard({
    required this.label,
    required this.value,
    required this.color,
    this.isCount = false,
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style:
                TextStyle(fontSize: 12, color: context.dsColors.textSecondary),
          ),
          const SizedBox(height: 4),
          Text(
            isCount ? '$value' : '${_formatCurrency(value)} so\'m',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: color,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  static String _formatCurrency(int amount) {
    return amount.toString().replaceAllMapped(
          RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
          (Match m) => '${m[1]}.',
        );
  }
}

class _DebtRow extends StatelessWidget {
  final DebtDetail debt;
  const _DebtRow({required this.debt});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: context.dsColors.surface,
        border: Border.all(
          color: debt.isOverdue
              ? context.dsColors.error.withValues(alpha: 0.4)
              : context.dsColors.border.withValues(alpha: 0.5),
          width: debt.isOverdue ? 1.2 : 0.8,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: (debt.isOverdue ? context.dsColors.error : context.dsColors.warning)
                  .withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              debt.isOverdue ? Icons.warning_amber : Icons.schedule,
              color: debt.isOverdue ? context.dsColors.error : context.dsColors.warning,
              size: 20,
            ),
          ),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  debt.studentName,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: context.dsColors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                SizedBox(height: 2),
                Text(
                  debt.groupName ?? debt.studentId,
                  style: TextStyle(
                    fontSize: 11,
                    color: context.dsColors.textSecondary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${_formatCurrency(debt.amount)} so\'m',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: context.dsColors.textPrimary,
                ),
              ),
              Text(
                debt.isOverdue ? "Muddati o'tgan" : 'Muddati bor',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: debt.isOverdue ? context.dsColors.error : context.dsColors.warning,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String _formatCurrency(int amount) {
    return amount.toString().replaceAllMapped(
          RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
          (Match m) => '${m[1]}.',
        );
  }
}
