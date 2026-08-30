import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/extensions/l10n_context.dart';
import '../../../../design/design.dart';
import '../../application/queries/payment_queries.dart';
import '../../domain/entities/expense.dart';
import '../../domain/entities/payment.dart';
import '../providers/payment_providers.dart';

/// Moliya bo'limi — kirim/chiqim, balans va oylik statistika.
class FinancePage extends ConsumerWidget {
  const FinancePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final incomeAsync = ref.watch(totalCollectedProvider);
    final expenseAsync = ref.watch(totalExpensesProvider);
    final balanceAsync = ref.watch(currentBalanceProvider);
    final monthlyIncomeAsync = ref.watch(monthlyCollectedProvider);
    final monthlyExpenseAsync = ref.watch(monthlyExpensesProvider);
    final monthlyBalanceAsync = ref.watch(monthlyBalanceProvider);
    final statsAsync = ref.watch(monthlyFinanceStatsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Moliya'),
        actions: [
          IconButton(
            tooltip: "Xarajat qo'shish",
            icon: const Icon(Icons.remove_circle_outline),
            onPressed: () => context.push('/finance/expense/new'),
          ),
          IconButton(
            tooltip: "To'lov qabul qilish",
            icon: const Icon(Icons.add_circle_outline),
            onPressed: () => context.push('/payments/new'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Umumiy balans
          _BalanceHero(balance: balanceAsync.valueOrNull ?? 0),
          const SizedBox(height: 16),
          // Jami kirim / chiqim
          Row(
            children: [
              Expanded(
                child: _FinanceCard(
                  icon: Icons.arrow_downward,
                  label: context.l10n.financeTotalIncome,
                  value: incomeAsync.valueOrNull ?? 0,
                  color: context.dsColors.success,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _FinanceCard(
                  icon: Icons.arrow_upward,
                  label: context.l10n.financeTotalExpense,
                  value: expenseAsync.valueOrNull ?? 0,
                  color: context.dsColors.error,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Oylik ko'rsatkichlar
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              color: context.dsColors.surface,
              border: Border.all(
                color: context.dsColors.border.withValues(alpha: 0.5),
                width: 0.8,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  context.l10n.financeThisMonth,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: context.dsColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _MonthlyStat(
                        label: "Kirim",
                        value: monthlyIncomeAsync.valueOrNull ?? 0,
                        color: context.dsColors.success,
                        icon: Icons.trending_up,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _MonthlyStat(
                        label: context.l10n.financeExpense,
                        value: monthlyExpenseAsync.valueOrNull ?? 0,
                        color: context.dsColors.error,
                        icon: Icons.trending_down,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _MonthlyStat(
                        label: context.l10n.financeBalance,
                        value: monthlyBalanceAsync.valueOrNull ?? 0,
                        color: context.dsColors.accent,
                        icon: Icons.account_balance_wallet,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          SizedBox(height: 20),
          Text(
            context.l10n.financeLast6Months,
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w600,
              color: context.dsColors.textPrimary,
            ),
          ),
          SizedBox(height: 12),
          _MonthlyChart(data: statsAsync.valueOrNull ?? const []),
          SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "So'nggi to'lovlar",
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  color: context.dsColors.textPrimary,
                ),
              ),
              TextButton(
                onPressed: () => context.push('/finance/payments'),
                child: const Text('Barchasi'),
              ),
            ],
          ),
          SizedBox(height: 12),
          _RecentPayments(),
          SizedBox(height: 20),
          Text(
            "So'nggi xarajatlar",
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w600,
              color: context.dsColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          _RecentExpenses(),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _BalanceHero extends StatelessWidget {
  final int balance;
  const _BalanceHero({required this.balance});

  @override
  Widget build(BuildContext context) {
    final positive = balance >= 0;
    final color = positive ? context.dsColors.success : context.dsColors.error;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: positive
              ? [const Color(0xFF00A86B), const Color(0xFF30D158)]
              : [const Color(0xFFFF3B30), const Color(0xFFFF6961)],
        ),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.3),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.l10n.financeCurrentBalance,
            style: TextStyle(
              fontSize: 13,
              color: Colors.white70,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '${_formatCurrency(balance.abs())} so\'m',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            positive ? 'Foyda (kirim > chiqim)' : 'Zarar (chiqim > kirim)',
            style: TextStyle(
              fontSize: 12,
              color: Colors.white.withValues(alpha: 0.8),
            ),
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

class _FinanceCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final int value;
  final Color color;

  const _FinanceCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: color.withValues(alpha: 0.1),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 10),
          Text(
            _formatCurrency(value),
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: color,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          SizedBox(height: 2),
          Text(
            label,
            style:
                TextStyle(fontSize: 11, color: context.dsColors.textSecondary),
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

class _MonthlyStat extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  final IconData icon;

  const _MonthlyStat({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: color.withValues(alpha: 0.1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(height: 6),
          Text(
            _formatCurrency(value),
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: color,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          SizedBox(height: 2),
          Text(
            label,
            style:
                TextStyle(fontSize: 10, color: context.dsColors.textSecondary),
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

class _MonthlyChart extends StatelessWidget {
  final List<MonthlyFinance> data;
  const _MonthlyChart({required this.data});

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) {
      return _EmptyHint(text: "Statistika uchun ma'lumot yo'q");
    }

    final maxValue = data.fold<int>(0, (max, d) {
      final v = d.income > d.outcome ? d.income : d.outcome;
      return v > max ? v : max;
    });

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 16, 12, 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: context.dsColors.surface,
        border: Border.all(
          color: context.dsColors.border.withValues(alpha: 0.5),
          width: 0.8,
        ),
      ),
      child: Column(
        children: [
          SizedBox(
            height: 170,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (final d in data) ...[
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          // Kirim ustuni
                          _Bar(
                            value: d.income,
                            max: maxValue,
                            color: context.dsColors.success,
                            heightFactor: 0.9,
                          ),
                          const SizedBox(height: 3),
                          // Chiqim ustuni
                          _Bar(
                            value: d.outcome,
                            max: maxValue,
                            color: context.dsColors.error,
                            heightFactor: 0.9,
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
              ],
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _LegendDot(color: context.dsColors.success, label: 'Kirim'),
              SizedBox(width: 16),
              _LegendDot(color: context.dsColors.error, label: 'Chiqim'),
            ],
          ),
        ],
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
      'Dek',
    ];
    final m = int.tryParse(parts[1]);
    if (m == null || m < 1 || m > 12) return month;
    return names[m - 1];
  }
}

class _Bar extends StatelessWidget {
  final int value;
  final int max;
  final Color color;
  final double heightFactor;

  const _Bar({
    required this.value,
    required this.max,
    required this.color,
    required this.heightFactor,
  });

  @override
  Widget build(BuildContext context) {
    final ratio = max > 0 ? (value / max) : 0.0;
    // Bar balandligi cheklangan — ikkita ustun (kirim+chiqim) birga
    // 160px maydondan oshib ketmasligi uchun.
    final height = 6 + (ratio * 52 * heightFactor);
    return Container(
      width: double.infinity,
      height: height.clamp(6.0, 58.0),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        SizedBox(width: 6),
        Text(
          label,
          style:
              TextStyle(fontSize: 11, color: context.dsColors.textSecondary),
        ),
      ],
    );
  }
}

class _RecentPayments extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final paymentsAsync = ref.watch(paymentListProvider);
    return paymentsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Text('Xato: $error'),
      data: (payments) {
        if (payments.isEmpty) {
          return const _EmptyHint(text: "Hali to'lovlar yo'q");
        }
        final recent = payments.take(5).toList();
        return Column(
          children: [for (final p in recent) _PaymentRow(payment: p)],
        );
      },
    );
  }
}

class _PaymentRow extends StatelessWidget {
  final Payment payment;
  const _PaymentRow({required this.payment});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: context.dsColors.surface,
      ),
      child: Row(
        children: [
          Icon(Icons.arrow_downward, color: context.dsColors.success, size: 18),
          SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  payment.studentName ?? payment.studentIdentityId,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: context.dsColors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (payment.receiptNumber != null)
                  Text(
                    payment.receiptNumber!,
                    style: TextStyle(
                      fontSize: 10,
                      color: context.dsColors.textSecondary,
                    ),
                  ),
              ],
            ),
          ),
          Text(
            '+${_formatCurrency(payment.paidAmount)}',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: context.dsColors.success,
            ),
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

class _RecentExpenses extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final expensesAsync = ref.watch(expenseListProvider);
    return expensesAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Text('Xato: $error'),
      data: (expenses) {
        if (expenses.isEmpty) {
          return const _EmptyHint(text: "Hali xarajatlar yo'q");
        }
        final recent = expenses.take(5).toList();
        return Column(
          children: [for (final e in recent) _ExpenseRow(expense: e)],
        );
      },
    );
  }
}

class _ExpenseRow extends StatelessWidget {
  final Expense expense;
  const _ExpenseRow({required this.expense});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: context.dsColors.surface,
      ),
      child: Row(
        children: [
          Icon(Icons.arrow_upward, color: context.dsColors.error, size: 18),
          SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  expense.title,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: context.dsColors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (expense.payee != null)
                  Text(
                    expense.payee!,
                    style: TextStyle(
                      fontSize: 10,
                      color: context.dsColors.textSecondary,
                    ),
                  ),
              ],
            ),
          ),
          Text(
            '-${_formatCurrency(expense.amount)}',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: context.dsColors.error,
            ),
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
