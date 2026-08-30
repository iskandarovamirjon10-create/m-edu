import 'dart:math';

import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../audit/application/services/audit_service.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../../settings/domain/entities/app_settings.dart';
import '../../domain/entities/expense.dart';
import '../../domain/events/payment_events.dart';
import '../../domain/repositories/payment_repository.dart';

/// Xarajat yaratish uchun so'rov.
class CreateExpenseRequest {
  final ExpenseType expenseType;
  final String title;
  final int amount;
  final DateTime expenseDate;
  final String billingPeriod;
  final String? payee;
  final String? notes;
  final String? createdBy;

  const CreateExpenseRequest({
    required this.expenseType,
    required this.title,
    required this.amount,
    required this.expenseDate,
    required this.billingPeriod,
    this.payee,
    this.notes,
    this.createdBy,
  });
}

/// `CreateExpense` command'i — yangi xarajat (chiqim) yozish.
class CreateExpenseCommand {
  final PaymentRepository _repository;
  final EventBus _eventBus;
  final AuditService? _audit;
  final UserRole actorRole;

  CreateExpenseCommand({
    required PaymentRepository repository,
    required EventBus eventBus,
    AuditService? auditService,
    // AUDIT P2-02 (FAIL CLOSED): actor berilmasa — DENY (admin emas!).
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _eventBus = eventBus,
        _audit = auditService;

  Future<Expense> execute(CreateExpenseRequest request) async {
    // RBAC: moliya operatsiyasi — ruxsat application layer'da tekshiriladi.
    Permissions.require(actorRole, AppPermission.financeCreate);

    _validate(request);

    final now = DateTime.now();
    final expense = Expense(
      expenseId: _generateExpenseId(),
      expenseType: request.expenseType,
      title: request.title.trim(),
      amount: request.amount,
      expenseDate: request.expenseDate,
      billingPeriod: request.billingPeriod,
      payee: request.payee?.trim().isEmpty ?? true
          ? null
          : request.payee!.trim(),
      notes: request.notes?.trim().isEmpty ?? true
          ? null
          : request.notes!.trim(),
      createdBy: request.createdBy,
    );

    final saved = await _repository.saveExpense(expense);

    _eventBus.publish(ExpenseCreatedEvent(
      expense: saved,
      occurredAt: now,
    ));

    await _audit?.record(
      action: AuditAction.expenseCreated,
      targetType: 'expense',
      targetId: saved.expenseId,
      details: '${saved.title} — ${saved.amount} so\'m',
    );

    return saved;
  }

  void _validate(CreateExpenseRequest request) {
    if (request.title.trim().isEmpty) {
      throw const ValidationFailure('Xarajat nomi kiritilishi shart');
    }
    if (request.amount <= 0) {
      throw const ValidationFailure('Summa musbat bo\'lishi shart');
    }
    if (request.billingPeriod.trim().isEmpty) {
      throw const ValidationFailure('Davr kiritilishi shart');
    }
  }

  String _generateExpenseId() {
    final now = DateTime.now();
    final datePart =
        '${now.year}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}';
    final randomPart = Random().nextInt(99999).toString().padLeft(5, '0');
    return 'EXP-$datePart-$randomPart';
  }
}
