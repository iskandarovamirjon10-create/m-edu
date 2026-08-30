import 'package:equatable/equatable.dart';

/// To'lov holati.
enum PaymentStatus { pending, completed, failed, refunded, cancelled }

/// To'lov turi.
enum PaymentType {
  cash,
  card,
  transfer,
  online,
  other,
}

/// To'lov entity'si (spec §6 #28-33).
///
/// To'lov quyidagi ma'lumotlarni saqlaydi:
/// - To'lov ID (yagona)
/// - Talaba identity ID'si
/// - Guruh ID'si
/// - Summa (UZS)
/// - To'lov turi
/// - To'lov holati
/// - Kvitansiya raqami
/// - To'lov sanasi
/// - Izoh
class Payment extends Equatable {
  /// To'lovning yagona identifikatori.
  final String paymentId;

  /// Talaba identity ID'si.
  final String studentIdentityId;

  /// Talaba ismi (denormalized).
  final String? studentName;

  /// Guruh ID'si.
  final String? groupId;

  /// Guruh nomi (denormalized).
  final String? groupName;

  /// To'lov summasi (UZS).
  final int amount;

  /// To'lov turi.
  final PaymentType paymentType;

  /// To'lov holati.
  final PaymentStatus status;

  /// Kvitansiya raqami (avtomatik generatsiya).
  final String? receiptNumber;

  /// To'lov sanasi.
  final DateTime paymentDate;

  /// To'lov muddati (agar bo'lsa).
  final DateTime? dueDate;

  /// Qaysi oy uchun to'lov (masalan, "2026-08").
  final String? billingPeriod;

  /// Chegirma summasi (UZS).
  final int discountAmount;

  /// Chegirma sababi.
  final String? discountReason;

  /// Qo'shimcha to'lov (late fee).
  final int lateFee;

  /// Izoh.
  final String? notes;

  /// Kim tomonidan qabul qilindi (admin identity ID).
  final String? receivedBy;

  /// Sinxronlash versiyasi.
  final int syncVersion;

  /// Hali serverga sinxronlanmagan.
  final bool pendingSync;

  const Payment({
    required this.paymentId,
    required this.studentIdentityId,
    this.studentName,
    this.groupId,
    this.groupName,
    required this.amount,
    required this.paymentType,
    required this.paymentDate,
    this.status = PaymentStatus.pending,
    this.receiptNumber,
    this.dueDate,
    this.billingPeriod,
    this.discountAmount = 0,
    this.discountReason,
    this.lateFee = 0,
    this.notes,
    this.receivedBy,
    this.syncVersion = 1,
    this.pendingSync = true,
  });

  /// To'lov summasi (chegirmasiz).
  int get totalAmount => amount + lateFee;

  /// To'langan summa (chegirma ayirilgandan keyin).
  int get paidAmount => amount - discountAmount + lateFee;

  /// Qarz miqdori (agar to'lov to'liq emas bo'lsa).
  int get outstandingAmount {
    if (status == PaymentStatus.completed) return 0;
    return paidAmount;
  }

  bool get isCompleted => status == PaymentStatus.completed;
  bool get isPending => status == PaymentStatus.pending;
  bool get isFailed => status == PaymentStatus.failed;
  bool get isOverdue =>
      dueDate != null && DateTime.now().isAfter(dueDate!) && !isCompleted;

  @override
  List<Object?> get props => [
        paymentId,
        studentIdentityId,
        studentName,
        groupId,
        groupName,
        amount,
        paymentType,
        status,
        receiptNumber,
        paymentDate,
        dueDate,
        billingPeriod,
        discountAmount,
        discountReason,
        lateFee,
        notes,
        receivedBy,
        syncVersion,
        pendingSync,
      ];
}
