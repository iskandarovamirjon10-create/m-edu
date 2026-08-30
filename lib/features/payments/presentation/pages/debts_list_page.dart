import 'package:flutter/material.dart';
import 'package:m_edu/core/extensions/l10n_context.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../design/design.dart';
import '../../../notifications/presentation/providers/notification_providers.dart';
import '../../domain/entities/debt.dart';
import '../providers/payment_providers.dart';

/// Qarzdorliklar ro'yxati sahifasi (spec §6 #30-31).
class DebtsListPage extends ConsumerStatefulWidget {
  const DebtsListPage({super.key});

  @override
  ConsumerState<DebtsListPage> createState() => _DebtsListPageState();
}

class _DebtsListPageState extends ConsumerState<DebtsListPage> {
  bool _showOverdueOnly = false;
  bool _sendingReminders = false;

  /// Muddati o'tgan qarzdorlarga ommaviy eslatma yuboradi.
  ///
  /// [SendPaymentRemindersCommand] har bir qarzdor uchun ilova ichidagi
  /// bildirishnoma yaratadi va qarzdorlikda eslatma yuborilgan sanani
  /// belgilaydi (kuniga bir marta — qayta spam qilinmaydi).
  Future<void> _sendReminders() async {
    final messenger = ScaffoldMessenger.of(context);

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(context.l10n.notificationsSend),
        content: const Text(
          "Muddati o'tgan barcha qarzdor talabalarga to'lov eslatmasi "
          'yuborilsinmi? (har bir talabaga kuniga bir marta)',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(context.l10n.actionCancel),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(context.l10n.actionSend),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted || _sendingReminders) return;

    setState(() => _sendingReminders = true);
    try {
      final sent =
          await ref.read(sendPaymentRemindersCommandProvider).execute();
      ref.invalidate(notificationListVersionProvider);
      ref.invalidate(paymentListVersionProvider);
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            sent > 0
                ? '$sent ta eslatma yuborildi ✓'
                : "Yuborish uchun qarzdorlar topilmadi (kunlik limit)",
          ),
          backgroundColor: sent > 0 ? context.dsColors.success : context.dsColors.warning,
        ),
      );
    } catch (_) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(
          content: Text("Eslatmalarni yuborishda xatolik yuz berdi"),
          backgroundColor: context.dsColors.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _sendingReminders = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final debtsAsync = ref.watch(outstandingDebtsProvider);
    final totalDebtAsync = ref.watch(totalDebtProvider);
    final debtorCountAsync = ref.watch(debtorCountProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.debtsTitle),
        actions: [
          IconButton(
            tooltip: context.l10n.notificationsSend,
            icon: const Icon(Icons.notifications_active),
            onPressed: _sendReminders,
          ),
        ],
      ),
      body: Column(
        children: [
          // Stats
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: _StatCard(
                    label: context.l10n.dashboardTotalDebt,
                    value: totalDebtAsync.valueOrNull ?? 0,
                    color: context.dsColors.error,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _StatCard(
                    label: context.l10n.debtsTitle,
                    value: debtorCountAsync.valueOrNull ?? 0,
                    color: context.dsColors.warning,
                    isCurrency: false,
                  ),
                ),
              ],
            ),
          ),
          // Filter
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Switch(
                  value: _showOverdueOnly,
                  onChanged: (value) =>
                      setState(() => _showOverdueOnly = value),
                ),
                SizedBox(width: 8),
                Text(
                  "Faqat muddati o'tganlar",
                  style: TextStyle(
                    fontSize: 14,
                    color: context.dsColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // Debts list
          Expanded(
            child: debtsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => Center(
                child: Text('${context.l10n.commonError}: $error',
                    style: TextStyle(color: context.dsColors.error)),
              ),
              data: (debts) {
                if (debts.isEmpty) {
                  return const _EmptyDebts();
                }

                final filtered = _showOverdueOnly
                    ? debts.where((d) => d.isOverdue).toList()
                    : debts;

                if (filtered.isEmpty) {
                  return Center(
                    child: Text(context.l10n.debtsEmpty,
                        style:
                            TextStyle(color: context.dsColors.textSecondary)),
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) => _DebtCard(
                    debt: filtered[index],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  final bool isCurrency;

  const _StatCard({
    required this.label,
    required this.value,
    required this.color,
    this.isCurrency = true,
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
            style: TextStyle(
              fontSize: 12,
              color: context.dsColors.textSecondary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            isCurrency ? '${_formatCurrency(value)} so\'m' : '$value ta',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  String _formatCurrency(int amount) {
    return amount.toString().replaceAllMapped(
          RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
          (Match m) => '${m[1]}.',
        );
  }
}

class _DebtCard extends StatelessWidget {
  final Debt debt;

  const _DebtCard({required this.debt});

  @override
  Widget build(BuildContext context) {
    final isOverdue = debt.isOverdue;
    final statusColor = isOverdue ? context.dsColors.error : context.dsColors.warning;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: context.dsColors.surface,
        border: Border.all(
          color: isOverdue
              ? context.dsColors.error.withValues(alpha: 0.5)
              : context.dsColors.border.withValues(alpha: 0.5),
          width: isOverdue ? 1.5 : 0.8,
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
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  isOverdue ? Icons.warning : Icons.payment,
                  color: statusColor,
                  size: 24,
                ),
              ),
              SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      debt.studentName ?? debt.studentIdentityId,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: context.dsColors.textPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Muddat: ${DateFormat('dd.MM.yyyy').format(debt.dueDate)}',
                      style: TextStyle(
                        fontSize: 12,
                        color: statusColor,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '${_formatCurrency(debt.remainingAmount)} so\'m',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: context.dsColors.error,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    '${debt.paymentPercentage.toStringAsFixed(0)}% to\'langan',
                    style: TextStyle(
                      fontSize: 11,
                      color: context.dsColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Progress bar
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: debt.paymentPercentage / 100,
              backgroundColor: context.dsColors.border.withValues(alpha: 0.3),
              valueColor: AlwaysStoppedAnimation<Color>(statusColor),
              minHeight: 6,
            ),
          ),
        ],
      ),
    );
  }

  String _formatCurrency(int amount) {
    return amount.toString().replaceAllMapped(
          RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
          (Match m) => '${m[1]}.',
        );
  }
}

class _EmptyDebts extends StatelessWidget {
  const _EmptyDebts();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                gradient: context.dsColors.accentGradient,
                borderRadius: BorderRadius.circular(28),
                boxShadow: [
                  BoxShadow(
                    color: context.dsColors.success.withValues(alpha: 0.3),
                    blurRadius: 24,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Icon(Icons.check_circle, size: 44, color: Colors.white),
            ),
            SizedBox(height: 24),
            Text(
              "Qarzdorliklar yo'q",
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
            SizedBox(height: 8),
            Text(
              "Barcha talabalar to'lovlarini amalga oshirgan.",
              style: TextStyle(
                fontSize: 13,
                color: context.dsColors.textSecondary,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
