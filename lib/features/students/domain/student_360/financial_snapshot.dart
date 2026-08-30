import 'package:equatable/equatable.dart';

import '../../../payments/domain/entities/payment.dart';
import '../../../payments/domain/entities/debt.dart';

/// Student 360 — FINANCIAL snapshot.
///
/// Manba: PaymentRepository (real to'lovlar) + DebtRepository (qarzdorlik).
///
/// Formula:
/// - totalPaid = sum(payments where status==completed) -> int (UZS tiyin
///   bo'lmagan integer sum, barcha paymentlar UZS butun son)
/// - outstandingDebt = sum(open debts.remainingAmount) -> int
/// - lastPaymentDate = max(payments.paymentDate) where completed
/// - paymentCount = count of completed payments
///
/// Hech qanday pul hisob-kitobi MOCK yoki hardcoded EMAS —
/// faqat real repository'dan olingan qiymatlar.
class FinancialSnapshot extends Equatable {
  /// Jami to'langan summa (completed payments, UZS).
  final int totalPaid;

  /// Ochiq qarzdorlik yig'indisi (UZS).
  final int outstandingDebt;

  /// Completed to'lovlar soni.
  final int paymentCount;

  /// Pending/cancelled/refunded to'lovlar soni.
  final int pendingPaymentCount;

  /// Eng so'nggi completed to'lov sanasi (null — hech qachon to'lamagan).
  final DateTime? lastPaymentDate;

  /// Eng yaqin overdue qarz sanasi (null — overdue qarz yo'q).
  final DateTime? nearestOverdueAt;

  /// Barcha to'lovlar (tarix) — paginatsiya UI uchun ishlatilishi mumkin.
  /// Snapshot o'zida to'liq tarix saqlaydi; 1000+ to'lov bo'lsa, page
  /// provider orqali alohida o'qiladi (snapshot faqat aggregation).
  final List<Payment> paymentHistory;

  /// Aktiv (yopilmagan) qarzdorliklar.
  final List<Debt> activeDebts;

  const FinancialSnapshot({
    required this.totalPaid,
    required this.outstandingDebt,
    required this.paymentCount,
    required this.pendingPaymentCount,
    required this.lastPaymentDate,
    required this.nearestOverdueAt,
    required this.paymentHistory,
    required this.activeDebts,
  });

  /// Bo'sh snapshot — student hali hech qachon to'lov qilmagan.
  const FinancialSnapshot.empty()
      : totalPaid = 0,
        outstandingDebt = 0,
        paymentCount = 0,
        pendingPaymentCount = 0,
        lastPaymentDate = null,
        nearestOverdueAt = null,
        paymentHistory = const [],
        activeDebts = const [];

  bool get hasAnyPayment => paymentCount > 0;
  bool get hasDebt => outstandingDebt > 0;
  bool get hasOverdue => nearestOverdueAt != null;

  /// Sof balans: totalPaid - outstandingDebt.
  int get netBalance => totalPaid - outstandingDebt;

  @override
  List<Object?> get props => [
        totalPaid,
        outstandingDebt,
        paymentCount,
        pendingPaymentCount,
        lastPaymentDate,
        nearestOverdueAt,
        paymentHistory,
        activeDebts,
      ];
}
