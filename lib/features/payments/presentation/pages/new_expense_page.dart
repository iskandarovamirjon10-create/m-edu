import 'package:flutter/material.dart';
import 'package:m_edu/core/extensions/l10n_context.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/error/failures.dart';
import '../../../../design/design.dart';
import '../../application/commands/create_expense_command.dart';
import '../../domain/entities/expense.dart';
import '../providers/payment_providers.dart';

/// Yangi xarajat (chiqim) kiritish sahifasi.
class NewExpensePage extends ConsumerStatefulWidget {
  const NewExpensePage({super.key});

  @override
  ConsumerState<NewExpensePage> createState() => _NewExpensePageState();
}

class _NewExpensePageState extends ConsumerState<NewExpensePage> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _amountController = TextEditingController();
  final _payeeController = TextEditingController();
  final _notesController = TextEditingController();

  ExpenseType _type = ExpenseType.rent;
  DateTime _date = DateTime.now();
  bool _saving = false;

  @override
  void dispose() {
    _titleController.dispose();
    _amountController.dispose();
    _payeeController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.expensesAdd),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Xarajat turi
            Text(
              'Xarajat turi',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
            const SizedBox(height: 10),
            _buildTypeSelector(),
            const SizedBox(height: 20),
            TextFormField(
              controller: _titleController,
              decoration: const InputDecoration(
                labelText: 'Nomi *',
                hintText: 'masalan: Oylik ijara, O\'qituvchi oyligi',
                prefixIcon: Icon(Icons.receipt_long_outlined),
              ),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Nomi shart' : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _amountController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Summa (so\'m) *',
                hintText: 'masalan: 1500000',
                prefixIcon: Icon(Icons.payments_outlined),
              ),
              validator: (v) {
                final amount = int.tryParse(v ?? '');
                if (amount == null || amount <= 0) {
                  return 'To\'g\'ri summa kiriting';
                }
                return null;
              },
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _payeeController,
              decoration: const InputDecoration(
                labelText: 'Qabul qiluvchi',
                hintText: 'masalan: Ijara xo\'jayini, O\'qituvchi ismi',
                prefixIcon: Icon(Icons.person_outline),
              ),
            ),
            SizedBox(height: 14),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.calendar_today, color: context.dsColors.accent),
              title: Text('Sana'),
              subtitle: Text(
                '${_date.day}.${_date.month.toString().padLeft(2, '0')}.${_date.year}',
                style: TextStyle(
                  color: context.dsColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: _pickDate,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _notesController,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Izoh',
                hintText: 'Qo\'shimcha ma\'lumot...',
                alignLabelWithHint: true,
                prefixIcon: Icon(Icons.notes_outlined),
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_outlined),
              label: Text(_saving ? 'Saqlanmoqda…' : 'Saqlash'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTypeSelector() {
    final types = [
      (ExpenseType.rent, Icons.home_outlined, 'Ijara'),
      (ExpenseType.salary, Icons.people_outline, 'Oylik'),
      (ExpenseType.utilities, Icons.bolt_outlined, 'Kommunal'),
      (ExpenseType.equipment, Icons.desktop_windows_outlined, 'Jihoz'),
      (ExpenseType.marketing, Icons.campaign_outlined, 'Marketing'),
      (ExpenseType.supplies, Icons.inventory_2_outlined, 'Kanselyariya'),
      (ExpenseType.other, Icons.more_horiz, 'Boshqa'),
    ];

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final t in types)
          GestureDetector(
            onTap: () => setState(() => _type = t.$1),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: _type == t.$1
                    ? context.dsColors.accent.withValues(alpha: 0.15)
                    : context.dsColors.surface,
                border: Border.all(
                  color: _type == t.$1
                      ? context.dsColors.accent
                      : context.dsColors.border,
                  width: _type == t.$1 ? 1.5 : 0.5,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    t.$2,
                    size: 16,
                    color: _type == t.$1
                        ? context.dsColors.accent
                        : context.dsColors.textSecondary,
                  ),
                  SizedBox(width: 6),
                  Text(
                    t.$3,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: _type == t.$1
                          ? FontWeight.w600
                          : FontWeight.w400,
                      color: _type == t.$1
                          ? context.dsColors.accent
                          : context.dsColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      // Davr tanlangan sanadan hisoblanadi — oy statistikasi to'g'ri
      // bo'lishi uchun (oldingi oy xarajati kiritilsa ham).
      final billingPeriod =
          '${_date.year}-${_date.month.toString().padLeft(2, '0')}';
      await ref.read(createExpenseCommandProvider).execute(
            CreateExpenseRequest(
              expenseType: _type,
              title: _titleController.text,
              amount: int.parse(_amountController.text.trim()),
              expenseDate: _date,
              billingPeriod: billingPeriod,
              payee: _payeeController.text.trim().isEmpty
                  ? null
                  : _payeeController.text.trim(),
              notes: _notesController.text.trim().isEmpty
                  ? null
                  : _notesController.text.trim(),
            ),
          );
      ref.invalidate(paymentListVersionProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Xarajat saqlandi'),
          backgroundColor: context.dsColors.success,
        ),
      );
      context.pop();
    } on Failure catch (failure) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(failure.message),
          backgroundColor: context.dsColors.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}
