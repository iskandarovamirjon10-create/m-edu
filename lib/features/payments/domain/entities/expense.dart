import 'package:equatable/equatable.dart';

/// Xarajat turi.
enum ExpenseType {
  rent,
  salary,
  utilities,
  equipment,
  marketing,
  supplies,
  other,
}

/// Xarajat entity'si — o'quv markazining chiqimlari.
///
/// Kirimlar (Payment) bilan birga balans va moliyaviy hisobotlarni
/// hisoblash uchun ishlatiladi.
class Expense extends Equatable {
  /// Xarajatning yagona identifikatori.
  final String expenseId;

  /// Xarajat turi.
  final ExpenseType expenseType;

  /// Xarajat nomi/izohi.
  final String title;

  /// Summa (UZS).
  final int amount;

  /// Xarajat sanasi.
  final DateTime expenseDate;

  /// Qaysi davr uchun (masalan, "2026-08").
  final String billingPeriod;

  /// Qabul qiluvchi (kimga to'landi).
  final String? payee;

  /// Izoh.
  final String? notes;

  /// Kim tomonidan kiritildi.
  final String? createdBy;

  /// Sinxronlash versiyasi.
  final int syncVersion;

  /// Hali serverga sinxronlanmagan.
  final bool pendingSync;

  const Expense({
    required this.expenseId,
    required this.expenseType,
    required this.title,
    required this.amount,
    required this.expenseDate,
    required this.billingPeriod,
    this.payee,
    this.notes,
    this.createdBy,
    this.syncVersion = 1,
    this.pendingSync = true,
  });

  @override
  List<Object?> get props => [
        expenseId,
        expenseType,
        title,
        amount,
        expenseDate,
        billingPeriod,
        payee,
        notes,
        createdBy,
        syncVersion,
        pendingSync,
      ];
}
