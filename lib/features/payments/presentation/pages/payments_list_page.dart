import 'dart:async';
import 'package:m_edu/core/extensions/l10n_context.dart';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../design/design.dart';
import '../../../../design/design.dart';
import '../../domain/entities/payment.dart';
import '../providers/payment_providers.dart';

/// To'lovlar ro'yxati sahifasi (spec §6 #28-33).
class PaymentsListPage extends ConsumerStatefulWidget {
  const PaymentsListPage({super.key});

  @override
  ConsumerState<PaymentsListPage> createState() => _PaymentsListPageState();
}

class _PaymentsListPageState extends ConsumerState<PaymentsListPage> {
  final _searchController = TextEditingController();
  String _query = '';
  PaymentType? _filterType;

  /// Qidiruv debounce — katta to'lov tarixida (yuz minglab yozuvlar)
  /// har bir belgida butun ro'yxatni filtrlash o'rniga pauzada bir marta.
  static const Duration _searchDebounce = Duration(milliseconds: 180);
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(_searchDebounce, () {
      if (mounted) setState(() => _query = value.trim().toLowerCase());
    });
  }

  void _clearSearch() {
    _debounce?.cancel();
    _searchController.clear();
    setState(() => _query = '');
  }

  @override
  Widget build(BuildContext context) {
    final paymentsAsync = ref.watch(paymentListProvider);
    final totalAsync = ref.watch(totalCollectedProvider);
    final monthlyAsync = ref.watch(monthlyCollectedProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.paymentsTitle),
        actions: [
          IconButton(
            tooltip: "Yangi to'lov",
            icon: const Icon(Icons.add),
            onPressed: () => context.push('/payments/new'),
          ),
        ],
      ),
      body: Column(
        children: [
          // Stats cards
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: _StatCard(
                    label: context.l10n.paymentTotalCollected,
                    value: totalAsync.valueOrNull ?? 0,
                    color: context.dsColors.success,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _StatCard(
                    label: context.l10n.paymentMonthly,
                    value: monthlyAsync.valueOrNull ?? 0,
                    color: context.dsColors.accent,
                  ),
                ),
              ],
            ),
          ),
          // Search bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                hintText: context.l10n.paymentSearchHint,
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _query.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: _clearSearch,
                      ),
              ),
            ),
          ),
          // Filter chips
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _FilterChip(
                  label: context.l10n.paymentFilterAll,
                  isSelected: _filterType == null,
                  onTap: () => setState(() => _filterType = null),
                ),
                const SizedBox(width: 8),
                _FilterChip(
                  label: context.l10n.paymentFilterCash,
                  isSelected: _filterType == PaymentType.cash,
                  onTap: () => setState(() => _filterType = PaymentType.cash),
                ),
                const SizedBox(width: 8),
                _FilterChip(
                  label: context.l10n.paymentFilterCard,
                  isSelected: _filterType == PaymentType.card,
                  onTap: () => setState(() => _filterType = PaymentType.card),
                ),
                const SizedBox(width: 8),
                _FilterChip(
                  label: context.l10n.paymentFilterTransfer,
                  isSelected: _filterType == PaymentType.transfer,
                  onTap: () =>
                      setState(() => _filterType = PaymentType.transfer),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // Payments list
          Expanded(
            child: paymentsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => Center(
                child: Text('${context.l10n.commonError}: $error',
                    style: TextStyle(color: context.dsColors.error)),
              ),
              data: (payments) {
                if (payments.isEmpty) {
                  return _EmptyPayments(
                    onCreate: () => context.push('/payments/new'),
                  );
                }

                final filtered = _filter(payments);
                if (filtered.isEmpty && _query.isNotEmpty) {
                  return Center(
                    child: Text(context.l10n.commonNoResults,
                        style:
                            TextStyle(color: context.dsColors.textSecondary)),
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) => _PaymentCard(
                    payment: filtered[index],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  List<Payment> _filter(List<Payment> payments) {
    var filtered = payments;

    if (_filterType != null) {
      filtered = filtered.where((p) => p.paymentType == _filterType).toList();
    }

    if (_query.isNotEmpty) {
      filtered = filtered.where((p) {
        return (p.receiptNumber?.toLowerCase().contains(_query) ?? false) ||
            (p.studentName?.toLowerCase().contains(_query) ?? false) ||
            p.studentIdentityId.toLowerCase().contains(_query) ||
            (p.groupName?.toLowerCase().contains(_query) ?? false);
      }).toList();
    }

    return filtered;
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
            style: TextStyle(
              fontSize: 12,
              color: context.dsColors.textSecondary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${_formatCurrency(value)} so\'m',
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

class _FilterChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: DsMotion.normal,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected
              ? context.dsColors.accent.withValues(alpha: 0.15)
              : context.dsColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? context.dsColors.accent : context.dsColors.border,
            width: isSelected ? 1.5 : 0.5,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
            color:
                isSelected ? context.dsColors.accent : context.dsColors.textSecondary,
          ),
        ),
      ),
    );
  }
}

class _PaymentCard extends StatelessWidget {
  final Payment payment;

  const _PaymentCard({required this.payment});

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (payment.status) {
      PaymentStatus.completed => context.dsColors.success,
      PaymentStatus.pending => context.dsColors.warning,
      PaymentStatus.failed => context.dsColors.error,
      PaymentStatus.refunded => context.dsColors.info,
      PaymentStatus.cancelled => context.dsColors.textSecondary,
    };

    final typeIcon = switch (payment.paymentType) {
      PaymentType.cash => Icons.money,
      PaymentType.card => Icons.credit_card,
      PaymentType.transfer => Icons.account_balance,
      PaymentType.online => Icons.language,
      PaymentType.other => Icons.payment,
    };

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
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
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(typeIcon, color: statusColor, size: 24),
          ),
          SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  payment.studentName ?? payment.studentIdentityId,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: context.dsColors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    if (payment.receiptNumber != null) ...[
                      Text(
                        payment.receiptNumber!,
                        style: TextStyle(
                          fontSize: 12,
                          color: context.dsColors.accent,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      SizedBox(width: 8),
                    ],
                    Text(
                      DateFormat('dd.MM.yyyy').format(payment.paymentDate),
                      style: TextStyle(
                        fontSize: 11,
                        color: context.dsColors.textSecondary,
                      ),
                    ),
                  ],
                ),
                if (payment.groupName != null) ...[
                  SizedBox(height: 2),
                  Text(
                    payment.groupName!,
                    style: TextStyle(
                      fontSize: 11,
                      color: context.dsColors.textSecondary,
                    ),
                  ),
                ],
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${_formatCurrency(payment.paidAmount)} so\'m',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: context.dsColors.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  _statusLabel(context, payment.status),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: statusColor,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _statusLabel(BuildContext context, PaymentStatus status) {
    return switch (status) {
      PaymentStatus.completed => context.l10n.paymentStatusCompleted,
      PaymentStatus.pending => context.l10n.paymentStatusPending,
      PaymentStatus.failed => context.l10n.paymentStatusFailed,
      PaymentStatus.refunded => context.l10n.paymentStatusRefunded,
      PaymentStatus.cancelled => context.l10n.paymentStatusCancelled,
    };
  }

  String _formatCurrency(int amount) {
    return amount.toString().replaceAllMapped(
          RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
          (Match m) => '${m[1]}.',
        );
  }
}

class _EmptyPayments extends StatelessWidget {
  final VoidCallback onCreate;

  const _EmptyPayments({required this.onCreate});

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
                    color: context.dsColors.warning.withValues(alpha: 0.3),
                    blurRadius: 24,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Icon(Icons.payment, size: 44, color: Colors.white),
            ),
            SizedBox(height: 24),
            Text(
              "Hali to'lovlar yo'q",
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
            SizedBox(height: 8),
            Text(
              "Birinchi to'lovni qabul qiling — avtomatik kvitansiya generatsiya qilinadi.",
              style: TextStyle(
                fontSize: 13,
                color: context.dsColors.textSecondary,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: onCreate,
              icon: const Icon(Icons.add),
              label: Text(context.l10n.paymentsAdd),
            ),
          ],
        ),
      ),
    );
  }
}
