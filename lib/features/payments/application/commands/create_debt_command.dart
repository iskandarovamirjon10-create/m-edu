import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../audit/application/services/audit_service.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../../settings/domain/entities/app_settings.dart';
import '../../domain/entities/debt.dart';
import '../../domain/events/payment_events.dart';
import '../../domain/repositories/payment_repository.dart';

/// Qarzdorlik yaratish uchun so'rov.
class CreateDebtRequest {
  final String studentIdentityId;
  final String? studentName;
  final String? groupId;
  final String? groupName;
  final DateTime dueDate;
  final int totalAmount;
  final String billingPeriod;
  final String? notes;

  const CreateDebtRequest({
    required this.studentIdentityId,
    this.studentName,
    this.groupId,
    this.groupName,
    required this.dueDate,
    required this.totalAmount,
    required this.billingPeriod,
    this.notes,
  });
}

/// `CreateDebt` command'i — talabaga qarzdorlik yaratish.
class CreateDebtCommand {
  final PaymentRepository _repository;
  final EventBus _eventBus;
  final AuditService? _audit;
  final UserRole actorRole;

  CreateDebtCommand({
    required PaymentRepository repository,
    required EventBus eventBus,
    AuditService? auditService,
    // AUDIT P2-02 (FAIL CLOSED): actor berilmasa — DENY (admin emas!).
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _eventBus = eventBus,
        _audit = auditService;

  Future<Debt> execute(CreateDebtRequest request) async {
    // RBAC: moliya operatsiyasi — ruxsat application layer'da tekshiriladi.
    Permissions.require(actorRole, AppPermission.financeCreate);

    _validate(request);

    // Bu oy uchun allaqachon qarzdorlik mavjudligini tekshirish.
    final existingDebts = await _repository.fetchDebtsByStudentId(
      request.studentIdentityId,
    );
    final samePeriod = existingDebts.where(
      (d) => d.billingPeriod == request.billingPeriod,
    );
    if (samePeriod.isNotEmpty) {
      throw const ValidationFailure(
        'Bu oy uchun qarzdorlik allaqachon yaratilgan',
      );
    }

    final now = DateTime.now();
    final debt = Debt(
      debtId: _generateDebtId(),
      studentIdentityId: request.studentIdentityId,
      studentName: request.studentName,
      groupId: request.groupId,
      groupName: request.groupName,
      dueDate: request.dueDate,
      totalAmount: request.totalAmount,
      paidAmount: 0,
      remainingAmount: request.totalAmount,
      status: DebtStatus.outstanding,
      billingPeriod: request.billingPeriod,
      notes: request.notes,
    );

    final saved = await _repository.saveDebt(debt);

    _eventBus.publish(DebtCreatedEvent(
      debt: saved,
      occurredAt: now,
    ));

    await _audit?.record(
      action: AuditAction.debtCreated,
      targetType: 'debt',
      targetId: saved.debtId,
      details: '${saved.studentName ?? saved.studentIdentityId} — '
          '${saved.totalAmount} so\'m (${saved.billingPeriod})',
    );

    return saved;
  }

  void _validate(CreateDebtRequest request) {
    if (request.studentIdentityId.trim().isEmpty) {
      throw const ValidationFailure('Talaba ID kiritilishi shart');
    }
    if (request.totalAmount <= 0) {
      throw const ValidationFailure('Summa musbat bo\'lishi shart');
    }
    if (request.billingPeriod.trim().isEmpty) {
      throw const ValidationFailure('To\'lov davri kiritilishi shart');
    }
  }

  String _generateDebtId() {
    final now = DateTime.now();
    final datePart =
        '${now.year}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}';
    final randomPart = DateTime.now().millisecondsSinceEpoch % 100000;
    return 'DEBT-$datePart-${randomPart.toString().padLeft(5, '0')}';
  }
}
