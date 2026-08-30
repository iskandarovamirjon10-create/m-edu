import '../../../../core/event_bus/event_bus.dart';
import '../entities/payment.dart';
import '../entities/debt.dart';
import '../entities/expense.dart';

/// Yangi to'lov qabul qilinganda.
class PaymentReceivedEvent extends DomainEvent {
  final Payment payment;
  @override
  final DateTime occurredAt;

  const PaymentReceivedEvent({
    required this.payment,
    required this.occurredAt,
  });
}

/// To'lov holati o'zgarganda.
class PaymentStatusChangedEvent extends DomainEvent {
  final Payment payment;
  final PaymentStatus previousStatus;
  @override
  final DateTime occurredAt;

  const PaymentStatusChangedEvent({
    required this.payment,
    required this.previousStatus,
    required this.occurredAt,
  });
}

/// To'lov qaytarilganda.
class PaymentRefundedEvent extends DomainEvent {
  final Payment payment;
  final int refundAmount;
  @override
  final DateTime occurredAt;

  const PaymentRefundedEvent({
    required this.payment,
    required this.refundAmount,
    required this.occurredAt,
  });
}

/// Qarzdorlik yaratilganda.
class DebtCreatedEvent extends DomainEvent {
  final Debt debt;
  @override
  final DateTime occurredAt;

  const DebtCreatedEvent({required this.debt, required this.occurredAt});
}

/// Qarzdorlik to'langanda.
class DebtPaidEvent extends DomainEvent {
  final Debt debt;
  @override
  final DateTime occurredAt;

  const DebtPaidEvent({required this.debt, required this.occurredAt});
}

/// Muddati o'tgan qarzdorlik uchun eslatma.
class DebtReminderSentEvent extends DomainEvent {
  final Debt debt;
  @override
  final DateTime occurredAt;

  const DebtReminderSentEvent({required this.debt, required this.occurredAt});
}

/// Yangi xarajat kiritilganda.
class ExpenseCreatedEvent extends DomainEvent {
  final Expense expense;
  @override
  final DateTime occurredAt;

  const ExpenseCreatedEvent({
    required this.expense,
    required this.occurredAt,
  });
}
