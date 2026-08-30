import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../audit/application/services/audit_service.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../../identity/domain/value_objects/phone_number.dart';
import '../../../settings/domain/entities/app_settings.dart';
import '../../domain/entities/lead.dart';
import '../../domain/entities/lead_activity.dart';
import '../../domain/events/lead_events.dart';
import '../../domain/repositories/lead_repository.dart';

/// Lead ma'lumotlarini (mas'ul, izoh, telefon, email) tahrirlash uchun
/// so'rov. Faqat ko'rsatilgan maydonlar yangilanadi.
class UpdateLeadDetailsRequest {
  final String leadId;

  /// Mas'ul foydalanuvchi (email) — `null` bilan bo'shatish mumkin emas
  /// (noto'g'ri foydalanish oldini olish uchun [clearAssigned] ishlating).
  final String? assignedToUserId;

  final String? notes;
  final String? phone;
  final String? email;

  /// `assignedToUserId`'ni bo'shatish uchun (null o'rniga true).
  final bool clearAssigned;

  const UpdateLeadDetailsRequest({
    required this.leadId,
    this.assignedToUserId,
    this.notes,
    this.phone,
    this.email,
    this.clearAssigned = false,
  });
}

/// `UpdateLeadDetails` command'i — lead'ni tahrirlash.
///
/// `null` qolgan maydonlar o'zgartirilmaydi (copyWith pattern'i).
/// Telefon raqami normalizatsiya qilinadi; noto'g'ri bo'lsa xato.
class UpdateLeadDetailsCommand {
  final LeadRepository _repository;
  final EventBus _eventBus;
  final AuditService? _audit;

  /// RBAC: default `unknown` — DENY (fail-closed).
  final UserRole actorRole;

  UpdateLeadDetailsCommand({
    required LeadRepository repository,
    required EventBus eventBus,
    AuditService? auditService,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _eventBus = eventBus,
        _audit = auditService;

  Future<Lead> execute(UpdateLeadDetailsRequest request) async {
    Permissions.require(actorRole, AppPermission.crmLeadsEdit);

    final lead = await _repository.fetchByLeadId(request.leadId);
    if (lead == null) {
      throw NotFoundFailure('Lead topilmadi: ${request.leadId}');
    }

    final normalizedPhone = _normalizePhone(request.phone);
    final now = DateTime.now();
    final updated = lead.copyWith(
      assignedToUserId:
          request.clearAssigned ? null : request.assignedToUserId,
      notes: request.notes,
      phone: normalizedPhone ?? lead.phone,
      email: request.email?.trim().toLowerCase() ?? lead.email,
      updatedAt: now,
      syncVersion: lead.syncVersion + 1,
    );
    final saved = await _repository.update(updated);

    final changed = <String>[];
    if (request.assignedToUserId != null ||
        request.clearAssigned) {
      changed.add('mas\'ul: ${saved.assignedToUserId ?? 'yo\'q'}');
    }
    if (request.notes != null) changed.add('izoh yangilandi');
    if (request.phone != null) changed.add('telefon yangilandi');
    if (request.email != null) changed.add('email yangilandi');

    if (changed.isNotEmpty) {
      final activity = LeadActivity(
        leadId: saved.leadId,
        type: LeadActivityTypes.updated,
        description: 'Lead tahrirlandi — ${changed.join(', ')}',
        occurredAt: now,
      );
      await _repository.recordActivity(activity);

      await _audit?.record(
        action: AuditAction.leadUpdated,
        targetType: 'lead',
        targetId: saved.leadId,
        details: '${saved.fullName} — ${changed.join(', ')}',
      );

      // UI stale qolmasligi uchun event → event_sync version bump.
      _eventBus.publish(LeadUpdatedEvent(lead: saved, occurredAt: now));
    }

    return saved;
  }

  /// Telefon raqamini normalizatsiya qiladi; bo'sh/yo'q bo'lsa null.
  /// Noto'g'ri raqam uchun `ValidationFailure` tashlaydi.
  String? _normalizePhone(String? phone) {
    if (phone == null || phone.trim().isEmpty) return null;
    try {
      return PhoneNumber.validate(phone).normalized;
    } on FormatException catch (e) {
      throw ValidationFailure(e.message);
    }
  }
}
