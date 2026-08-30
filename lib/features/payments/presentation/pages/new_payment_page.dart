import 'package:flutter/material.dart';
import 'package:m_edu/core/extensions/l10n_context.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/error/failures.dart';
import '../../../../design/design.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../students/domain/entities/student.dart';
import '../../../students/presentation/providers/student_providers.dart';
import '../../application/commands/receive_payment_command.dart';
import '../../domain/entities/payment.dart';
import '../providers/payment_providers.dart';

/// Yangi to'lov qabul qilish sahifasi.
class NewPaymentPage extends ConsumerStatefulWidget {
  const NewPaymentPage({super.key});

  @override
  ConsumerState<NewPaymentPage> createState() => _NewPaymentPageState();
}

class _NewPaymentPageState extends ConsumerState<NewPaymentPage> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _discountController = TextEditingController();
  final _notesController = TextEditingController();

  Student? _selectedStudent;
  PaymentType _type = PaymentType.cash;
  bool _saving = false;

  @override
  void dispose() {
    _amountController.dispose();
    _discountController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final studentsAsync = ref.watch(activeStudentsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.paymentsAdd),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Talaba tanlash
            Text(
              'Talaba *',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            studentsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => Text('Xato: $error'),
              data: (students) {
                return DropdownButtonFormField<String>(
                  initialValue: _selectedStudent?.identityId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.person_search_outlined),
                  ),
                  hint: const Text("Talabani tanlang"),
                  items: [
                    for (final s in students)
                      DropdownMenuItem(
                        value: s.identityId,
                        child: Text(
                          s.groupName != null
                              ? '${s.studentNumber} — ${s.groupName}'
                              : '#${s.studentNumber}',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (value) {
                    setState(() {
                      _selectedStudent = students
                          .where((s) => s.identityId == value)
                          .firstOrNull;
                    });
                  },
                  validator: (v) => v == null ? 'Talaba tanlash shart' : null,
                );
              },
            ),
            if (_selectedStudent != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  color: context.dsColors.accent.withValues(alpha: 0.08),
                  border: Border.all(
                    color: context.dsColors.accent.withValues(alpha: 0.2),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(Icons.person, color: context.dsColors.accent, size: 20),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Tanlangan talaba: ${_selectedStudent!.identityId}',
                        style: TextStyle(
                          fontSize: 12,
                          color: context.dsColors.textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            SizedBox(height: 20),
            // To'lov turi
            Text(
              "To'lov turi",
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
              controller: _amountController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Summa (so\'m) *',
                hintText: 'masalan: 500000',
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
              controller: _discountController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: "Chegirma (so'm)",
                hintText: '0',
                prefixIcon: Icon(Icons.percent),
              ),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _notesController,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Izoh',
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
                  : const Icon(Icons.check_circle_outline),
              label: Text(_saving ? 'Saqlanmoqda…' : "To'lovni qabul qilish"),
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
      (PaymentType.cash, Icons.money, 'Naqd'),
      (PaymentType.card, Icons.credit_card, 'Karta'),
      (PaymentType.transfer, Icons.account_balance, "O'tkazma"),
      (PaymentType.online, Icons.language, 'Online'),
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
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: _type == t.$1
                    ? context.dsColors.accent.withValues(alpha: 0.15)
                    : context.dsColors.surface,
                border: Border.all(
                  color: _type == t.$1 ? context.dsColors.accent : context.dsColors.border,
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

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final student = _selectedStudent;
    if (student == null) return;
    setState(() => _saving = true);
    try {
      final now = DateTime.now();
      final billingPeriod =
          '${now.year}-${now.month.toString().padLeft(2, '0')}';
      final discount = int.tryParse(_discountController.text) ?? 0;
      // Talaba ismini Identity'dan topamiz (denormalizatsiya uchun).
      final identities =
          await ref.read(identityListProvider.future);
      final studentName = identities
          .where((i) => i.identityId == student.identityId)
          .map((i) => i.fullName)
          .firstOrNull;
      await ref.read(receivePaymentCommandProvider).execute(
            ReceivePaymentRequest(
              studentIdentityId: student.identityId,
              studentName: studentName,
              groupId: student.groupId,
              groupName: student.groupName,
              amount: int.parse(_amountController.text.trim()),
              paymentType: _type,
              discountAmount: discount,
              billingPeriod: billingPeriod,
              notes: _notesController.text.trim().isEmpty
                  ? null
                  : _notesController.text.trim(),
            ),
          );
      ref.invalidate(paymentListVersionProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("To'lov qabul qilindi"),
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
