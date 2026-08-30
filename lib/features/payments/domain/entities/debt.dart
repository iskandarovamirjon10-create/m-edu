import 'package:equatable/equatable.dart';

/// Qarzdorlik holati.
enum DebtStatus { outstanding, partial, paid, writtenOff }

/// Qarzdorlik entity'si (spec §6 #30).
///
/// Har bir talaba uchun oylik to'lov qarzdorligini kuzatadi.
class Debt extends Equatable {
  /// Qarzdorlik ID'si.
  final String debtId;

  /// Talaba identity ID'si.
  final String studentIdentityId;

  /// Talaba ismi (denormalized).
  final String? studentName;

  /// Guruh ID'si.
  final String? groupId;

  /// Guruh nomi (denormalized).
  final String? groupName;

  /// To'lov muddati (oylik to'lov uchun).
  final DateTime dueDate;

  /// To'lanishi kerak bo'lgan summa (UZS).
  final int totalAmount;

  /// To'langan summa (UZS).
  final int paidAmount;

  /// Qoldiq (UZS).
  final int remainingAmount;

  /// Qarzdorlik holati.
  final DebtStatus status;

  /// Qaysi oy uchun (masalan, "2026-08").
  final String billingPeriod;

  /// Eslatma yuborilganligi.
  final bool reminderSent;

  /// Oxirgi eslatma sanasi.
  final DateTime? lastReminderDate;

  /// Izoh.
  final String? notes;

  /// Sinxronlash versiyasi.
  final int syncVersion;

  const Debt({
    required this.debtId,
    required this.studentIdentityId,
    this.studentName,
    this.groupId,
    this.groupName,
    required this.dueDate,
    required this.totalAmount,
    this.paidAmount = 0,
    this.remainingAmount = 0,
    this.status = DebtStatus.outstanding,
    required this.billingPeriod,
    this.reminderSent = false,
    this.lastReminderDate,
    this.notes,
    this.syncVersion = 1,
  });

  bool get isOutstanding => status == DebtStatus.outstanding;
  bool get isPartial => status == DebtStatus.partial;
  bool get isPaid => status == DebtStatus.paid;
  bool get isOverdue => DateTime.now().isAfter(dueDate) && !isPaid;

  /// To'lov foizi (0-100).
  double get paymentPercentage =>
      totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

  @override
  List<Object?> get props => [
        debtId,
        studentIdentityId,
        studentName,
        groupId,
        groupName,
        dueDate,
        totalAmount,
        paidAmount,
        remainingAmount,
        status,
        billingPeriod,
        reminderSent,
        lastReminderDate,
        notes,
        syncVersion,
      ];
}
