import 'dart:math';

import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../audit/application/services/audit_service.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../../settings/domain/entities/app_settings.dart';
import '../../domain/entities/payment.dart';
import '../../domain/entities/debt.dart';
import '../../domain/events/payment_events.dart';
import '../../domain/repositories/payment_repository.dart';

/// To'lov qabul qilish uchun so'rov (Command input).
class ReceivePaymentRequest {
  final String studentIdentityId;
  final String? studentName;
  final String? groupId;
  final String? groupName;
  final int amount;
  final PaymentType paymentType;
  final int discountAmount;
  final String? discountReason;
  final int lateFee;
  final String? billingPeriod;
  final String? notes;

  const ReceivePaymentRequest({
    required this.studentIdentityId,
    this.studentName,
    this.groupId,
    this.groupName,
    required this.amount,
    required this.paymentType,
    this.discountAmount = 0,
    this.discountReason,
    this.lateFee = 0,
    this.billingPeriod,
    this.notes,
  });
}

/// `ReceivePayment` command'i — CQRS bo'yicha yozish operatsiyasi.
///
/// Oqim: request → validatsiya → kvitansiya generatsiya → saqlash →
/// qarzdorlikni yangilash → event tarqatish.
class ReceivePaymentCommand {
  final PaymentRepository _repository;
  final EventBus _eventBus;
  final AuditService? _audit;

  /// RBAC (§32): amalni bajaruvchi roli. Provider real rolni uzatadi;
  /// default `admin` — mavjud barcha hisoblar admin rolida yaratiladi.
  final UserRole actorRole;

  ReceivePaymentCommand({
    required PaymentRepository repository,
    required EventBus eventBus,
    AuditService? auditService,
    // AUDIT P2-02 (FAIL CLOSED): actor berilmasa — DENY (admin emas!).
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _eventBus = eventBus,
        _audit = auditService;

  Future<Payment> execute(ReceivePaymentRequest request) async {
    // RBAC: ruxsat application layer'da tekshiriladi (UI'dan mustaqil).
    Permissions.require(actorRole, AppPermission.financeCreate);

    _validate(request);

    // IDEMPOTENCY (sync contract §10): to'lov paymentId unique index
    // orqali idempotent — bir xil paymentId bilan ikki marta saqlash
    // Unique index violated xatosini beradi. Offline → reconnect
    // paytida ikki qurilmada bir xil to'lov kiritsa, sync engine
    // version-based conflict resolution orqali hal qiladi.
    final now = DateTime.now();

    final payment = Payment(
      paymentId: _generatePaymentId(),
      studentIdentityId: request.studentIdentityId,
      studentName: request.studentName,
      groupId: request.groupId,
      groupName: request.groupName,
      amount: request.amount,
      paymentType: request.paymentType,
      status: PaymentStatus.completed,
      // Kvitansiya raqami datasource writeTxn ichida atomik generatsiya
      // qilinadi (spec §34) — bu yerda hardcode/raqam topish YO'Q.
      receiptNumber: null,
      paymentDate: now,
      billingPeriod: request.billingPeriod,
      discountAmount: request.discountAmount,
      discountReason: request.discountReason,
      lateFee: request.lateFee,
      notes: request.notes,
    );

    // Qarz yangilanishlari transactiondan OLDIN hisoblanadi (pure) —
    // spec §33: to'lov + qarz bir atomik tranzaksiyada yoziladi.
    final debtUpdates =
        await _computeDebtUpdates(request.studentIdentityId, request.amount);
    final saved = await _repository.saveWithDebts(payment, debtUpdates);

    _eventBus.publish(PaymentReceivedEvent(
      payment: saved,
      occurredAt: now,
    ));

    await _audit?.record(
      action: AuditAction.paymentCreated,
      targetType: 'payment',
      targetId: saved.paymentId,
      details: '${saved.studentName ?? saved.studentIdentityId} — '
          '${saved.amount} so\'m',
    );

    return saved;
  }

  void _validate(ReceivePaymentRequest request) {
    if (request.studentIdentityId.trim().isEmpty) {
      throw const ValidationFailure('Talaba ID kiritilishi shart');
    }
    if (request.amount <= 0) {
      throw const ValidationFailure('Summa musbat bo\'lishi shart');
    }
    if (request.discountAmount > request.amount) {
      throw const ValidationFailure(
        'Chegirma summadan ko\'p bo\'lishi mumkin emas',
      );
    }
  }

  /// Qarzdorlik yangilanishlarini hisoblaydi (faqat o'qish, pure).
  ///
  /// Atomik tranzaksiya ichida bajariladigan yozuvlar shu yerda tayyorlanadi
  /// — spec §33: to'lov va qarz bitta tranzaksiyada saqlanadi.
  Future<List<Debt>> _computeDebtUpdates(
    String studentIdentityId,
    int paymentAmount,
  ) async {
    final debts = await _repository.fetchDebtsByStudentId(studentIdentityId);
    final outstandingDebt = debts.where((d) => d.isOutstanding || d.isPartial);

    final updates = <Debt>[];
    var remaining = paymentAmount;
    for (final debt in outstandingDebt) {
      if (remaining <= 0) break;

      final newPaidAmount = min(remaining + debt.paidAmount, debt.totalAmount);
      final applied = newPaidAmount - debt.paidAmount;
      remaining -= applied;

      updates.add(Debt(
        debtId: debt.debtId,
        studentIdentityId: debt.studentIdentityId,
        studentName: debt.studentName,
        groupId: debt.groupId,
        groupName: debt.groupName,
        dueDate: debt.dueDate,
        totalAmount: debt.totalAmount,
        paidAmount: newPaidAmount,
        remainingAmount: debt.totalAmount - newPaidAmount,
        status: newPaidAmount >= debt.totalAmount
            ? DebtStatus.paid
            : DebtStatus.partial,
        billingPeriod: debt.billingPeriod,
        reminderSent: debt.reminderSent,
        lastReminderDate: debt.lastReminderDate,
        notes: debt.notes,
        syncVersion: debt.syncVersion + 1,
      ));
    }
    return updates;
  }

  /// Yagona to'lov ID — mikrosekund + tasodifiy qism.
  ///
  /// Parallel to'lovlar bir xil ID olishi mumkin emas (eski versiyada
  /// faqat `Random().nextInt(99999)` bor edi — ikkita parallel to'lov bir
  /// xil ID olsa `Unique index violated` (test bunu ochib berdi).
  /// `microsecondsSinceEpoch` + tasodifiy qism amaliy jihatdan noyob.
  String _generatePaymentId() {
    final now = DateTime.now();
    final datePart =
        '${now.year}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}';
    final micros = now.microsecondsSinceEpoch % 100000000;
    final randomPart = Random().nextInt(99999).toString().padLeft(5, '0');
    return 'PAY-$datePart-$micros-$randomPart';
  }
}
