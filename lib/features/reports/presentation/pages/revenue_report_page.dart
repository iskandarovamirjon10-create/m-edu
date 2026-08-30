import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design/design.dart';
import '../../../payments/presentation/providers/payment_providers.dart';
import '../../domain/entities/report.dart';
import '../providers/report_providers.dart';

/// Daromad hisoboti sahifasi — kirim/chiqim va oylik statistika.
class RevenueReportPage extends ConsumerWidget {
  const RevenueReportPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(revenueStatsProvider);
    final expenseAsync = ref.watch(totalExpensesProvider);
    final balanceAsync = ref.watch(currentBalanceProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Daromad hisoboti'),
        // AUDIT P1-02: joriy daromad hisobotini saqlash (SAVE) — real
        // Isar persistence; "Oxirgi hisobotlar" bo'limida ko'rinadi.
        actions: [
          IconButton(
            icon: const Icon(Icons.bookmark_add_outlined),
            tooltip: 'Hisobotni saqlash',
            onPressed: statsAsync.valueOrNull == null
                ? null
                : () => _saveReport(ref, statsAsync.valueOrNull!),
          ),
        ],
      ),
      body: statsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Text('Xato: $error',
              style: TextStyle(color: context.dsColors.error)),
        ),
        data: (stats) {
          final totalExpense = expenseAsync.valueOrNull ?? 0;
          final balance = balanceAsync.valueOrNull ?? 0;

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Balans
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: balance >= 0
                        ? [const Color(0xFF00A86B), const Color(0xFF30D158)]
                        : [const Color(0xFFFF3B30), const Color(0xFFFF6961)],
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Sof balans',
                      style: TextStyle(fontSize: 13, color: Colors.white70),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${_formatCurrency(balance.abs())} so\'m',
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _StatCard(
                      label: 'Jami kirim',
                      value: stats.totalRevenue,
                      color: context.dsColors.success,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _StatCard(
                      label: 'Jami chiqim',
                      value: totalExpense,
                      color: context.dsColors.error,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _StatCard(
                      label: 'Oylik kirim',
                      value: stats.monthlyRevenue,
                      color: context.dsColors.accent,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _StatCard(
                      label: 'Kutilayotgan',
                      value: stats.pendingAmount,
                      color: context.dsColors.warning,
                    ),
                  ),
                ],
              ),
              SizedBox(height: 20),
              Text(
                'Oylik daromad (6 oy)',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  color: context.dsColors.textPrimary,
                ),
              ),
              SizedBox(height: 12),
              _MonthlyRevenueChart(data: stats.monthlyData),
              SizedBox(height: 20),
              Text(
                "To'lov turlari bo'yicha",
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  color: context.dsColors.textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              _PaymentTypeBreakdown(data: stats.revenueByPaymentType),
            ],
          );
        },
      ),
    );
  }

  Future<void> _saveReport(WidgetRef ref, RevenueStats stats) async {
    final now = DateTime.now();
    final monthStart = DateTime(now.year, now.month, 1);
    final monthEnd = DateTime(now.year, now.month + 1, 1);
    final report = Report(
      reportId: 'RPT-REV-${now.millisecondsSinceEpoch}',
      type: ReportType.revenue,
      title: 'Daromad hisoboti — '
          '${now.month.toString().padLeft(2, '0')}.${now.year}',
      data: {
        'totalRevenue': stats.totalRevenue,
        'monthlyRevenue': stats.monthlyRevenue,
        'pendingAmount': stats.pendingAmount,
        'refundedAmount': stats.refundedAmount,
        'monthlyData': [
          for (final m in stats.monthlyData)
            {'month': m.month, 'amount': m.amount},
        ],
        'byPaymentType': stats.revenueByPaymentType,
      },
      createdAt: now,
      startDate: monthStart,
      endDate: monthEnd,
    );
    await ref.read(reportQueriesProvider).saveReport(report);
    ref.read(savedReportsVersionProvider.notifier).state++;
    if (ref.context.mounted) {
      ScaffoldMessenger.of(ref.context).showSnackBar(
        SnackBar(
          content: Text('Hisobot saqlandi'),
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  static String _formatCurrency(int amount) {
    return amount.toString().replaceAllMapped(
          RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
          (Match m) => '${m[1]}.',
        );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final int value;
  final Color color;

  const _StatCard({
    required this.label,
    required this.value,
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
            '${RevenueReportPage._formatCurrency(value)} so\'m',
            style: TextStyle(
              fontSize: 15,
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
}

class _MonthlyRevenueChart extends StatelessWidget {
  final List<MonthlyRevenue> data;
  const _MonthlyRevenueChart({required this.data});

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) {
      return const _EmptyHint(text: "Ma'lumot yo'q");
    }
    final maxValue =
        data.fold<int>(0, (max, d) => d.amount > max ? d.amount : max);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: context.dsColors.surface,
        border: Border.all(
          color: context.dsColors.border.withValues(alpha: 0.5),
          width: 0.8,
        ),
      ),
      child: SizedBox(
        height: 140,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            for (final d in data)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Container(
                        width: double.infinity,
                        height:
                            maxValue > 0 ? 8 + (d.amount / maxValue) * 100 : 8,
                        decoration: BoxDecoration(
                          color: context.dsColors.accent.withValues(alpha: 0.85),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      SizedBox(height: 6),
                      Text(
                        _monthLabel(d.month),
                        style: TextStyle(
                          fontSize: 10,
                          color: context.dsColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  static String _monthLabel(String month) {
    final parts = month.split('-');
    if (parts.length != 2) return month;
    final names = [
      'Yan',
      'Fev',
      'Mar',
      'Apr',
      'May',
      'Iyn',
      'Iyl',
      'Avg',
      'Sen',
      'Okt',
      'Noy',
      'Dek'
    ];
    final m = int.tryParse(parts[1]);
    if (m == null || m < 1 || m > 12) return month;
    return names[m - 1];
  }
}

class _PaymentTypeBreakdown extends StatelessWidget {
  final Map<String, int> data;
  const _PaymentTypeBreakdown({required this.data});

  @override
  Widget build(BuildContext context) {
    final labels = {
      'cash': 'Naqd',
      'card': 'Karta',
      'transfer': "O'tkazma",
      'online': 'Online',
      'other': 'Boshqa',
    };
    final icons = {
      'cash': Icons.money,
      'card': Icons.credit_card,
      'transfer': Icons.account_balance,
      'online': Icons.language,
      'other': Icons.payment,
    };
    final colors = {
      'cash': context.dsColors.success,
      'card': context.dsColors.accent,
      'transfer': context.dsColors.info,
      'online': context.dsColors.info,
      'other': context.dsColors.warning,
    };

    final nonEmpty = data.entries.where((e) => e.value > 0).toList();
    if (nonEmpty.isEmpty) {
      return const _EmptyHint(text: "Hali to'lovlar yo'q");
    }

    return Column(
      children: [
        for (final entry in nonEmpty)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              color: context.dsColors.surface,
            ),
            child: Row(
              children: [
                Icon(
                  icons[entry.key] ?? Icons.payment,
                  size: 18,
                  color: colors[entry.key] ?? context.dsColors.textSecondary,
                ),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    labels[entry.key] ?? entry.key,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: context.dsColors.textPrimary,
                    ),
                  ),
                ),
                Text(
                  '${_formatCurrency(entry.value)} so\'m',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: context.dsColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  static String _formatCurrency(int amount) {
    return amount.toString().replaceAllMapped(
          RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
          (Match m) => '${m[1]}.',
        );
  }
}

class _EmptyHint extends StatelessWidget {
  final String text;
  const _EmptyHint({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: context.dsColors.surface,
      ),
      child: Center(
        child: Text(
          text,
          style:
              TextStyle(color: context.dsColors.textSecondary, fontSize: 13),
        ),
      ),
    );
  }
}
