import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../audit/application/services/audit_service.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../../settings/domain/entities/app_settings.dart';
import '../../domain/entities/lead.dart';
import '../../domain/entities/lead_activity.dart';
import '../../domain/events/lead_events.dart';
import '../../domain/repositories/lead_repository.dart';
import '../../domain/services/lead_id_generator.dart';
import '../../domain/services/lead_score_calculator.dart';
import '../../../identity/domain/value_objects/phone_number.dart';

/// Yangi lead qo'lga kiritish uchun so'rov (Command input).
class CaptureLeadRequest {
  final String fullName;
  final String? phone;
  final String? email;
  final LeadSource source;
  final String? assignedToUserId;

  /// Mavjud talaba/ota-ona tavsiya qilgan bo'lsa (referral).
  final String? referredByIdentityId;
  final String? notes;

  const CaptureLeadRequest({
    required this.fullName,
    this.phone,
    this.email,
    required this.source,
    this.assignedToUserId,
    this.referredByIdentityId,
    this.notes,
  });
}

/// Capture natijasi — lead + dedup ogohlantirishi.
///
/// Spec §4: dedup tekshiruvi OGOHLANTIRADI, BLOKLAMAYDI. [possibleDuplicates]
/// bo'sh bo'lmasa, UI foydalanuvchiga \"o'xshash lead allaqachon bor\" deb
/// ko'rsatadi, lekin yozuv baribir saqlanadi.
class CaptureLeadResult {
  final Lead lead;
  final List<Lead> possibleDuplicates;

  const CaptureLeadResult({
    required this.lead,
    required this.possibleDuplicates,
  });

  bool get hasDuplicates => possibleDuplicates.isNotEmpty;
}

/// `CaptureLead` command'i — CQRS bo'yicha yozish operatsiyasi.
///
/// Oqim (spec §4): validatsiya → dedup tekshiruvi (ogohlantirish,
/// bloklamaydi) → Real ID → scoring → saqlash → activity → audit → event.
class CaptureLeadCommand {
  final LeadRepository _repository;
  final LeadIdGenerator _idGenerator;
  final EventBus _eventBus;
  final AuditService? _audit;

  /// RBAC (§32): amalni bajaruvchi roli. Default `unknown` — DENY
  /// (fail-closed).
  final UserRole actorRole;

  CaptureLeadCommand({
    required LeadRepository repository,
    required LeadIdGenerator idGenerator,
    required EventBus eventBus,
    AuditService? auditService,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _idGenerator = idGenerator,
        _eventBus = eventBus,
        _audit = auditService;

  Future<CaptureLeadResult> execute(CaptureLeadRequest request) async {
    // RBAC: ruxsat application layer'da tekshiriladi (UI'dan mustaqil).
    Permissions.require(actorRole, AppPermission.crmLeadsCreate);

    final normalizedPhone = _normalizePhone(request.phone);
    _validate(request, normalizedPhone);

    // Dedup tekshiruvi — ogohlantirish, bloklamaydi (spec §4).
    final possibleDuplicates = await _repository.searchByNameOrPhone(
      request.fullName.trim(),
    );
    final duplicates = <Lead>[];
    for (final candidate in possibleDuplicates) {
      final samePhone = normalizedPhone != null &&
          candidate.phone == normalizedPhone;
      final sameName = candidate.fullName
          .toLowerCase()
          .contains(request.fullName.trim().toLowerCase());
      if (samePhone || sameName) duplicates.add(candidate);
    }

    final now = DateTime.now();
    final leadId = await _idGenerator.next();

    final lead = Lead(
      leadId: leadId,
      fullName: request.fullName.trim(),
      phone: normalizedPhone,
      email: request.email?.trim().toLowerCase(),
      source: request.source,
      stage: LeadStage.newLead,
      score: 0, // scoring ishlatiladigan joyda hisoblanadi — saqlashdan keyin yangilanadi.
      assignedToUserId: request.assignedToUserId,
      referredByIdentityId: request.referredByIdentityId,
      notes: request.notes,
      createdAt: now,
      updatedAt: now,
      syncVersion: 1,
      pendingSync: true,
    );

    // Scoring — har doim joriy holatni aks ettiradi (spec §3.3).
    final scored = lead.copyWith(
      score: LeadScoreCalculator.calculate(lead, now: now).score,
    );

    final saved = await _repository.save(scored);

    final activity = LeadActivity(
      leadId: saved.leadId,
      type: LeadActivityTypes.captured,
      description:
          '${saved.fullName} (${_sourceLabel(saved.source)}) lead sifatida '
          'qo\'lga kiritildi. ID: ${saved.leadId}',
      occurredAt: now,
    );
    await _repository.recordActivity(activity);

    _eventBus.publish(LeadCapturedEvent(
      lead: saved,
      occurredAt: now,
    ));

    await _audit?.record(
      action: AuditAction.leadCaptured,
      targetType: 'lead',
      targetId: saved.leadId,
      details: '${saved.fullName} — manba: ${_sourceLabel(saved.source)}'
          '${duplicates.isEmpty ? '' : ' (${duplicates.length} ta o\'xshash)'}',
    );

    return CaptureLeadResult(lead: saved, possibleDuplicates: duplicates);
  }

  void _validate(CaptureLeadRequest request, String? normalizedPhone) {
    if (request.fullName.trim().isEmpty) {
      throw const ValidationFailure('Ism kiritilishi shart');
    }
    if (request.phone != null &&
        request.phone!.trim().isNotEmpty &&
        normalizedPhone == null) {
      throw const ValidationFailure("Telefon raqami noto'g'ri");
    }
    if (request.email != null &&
        request.email!.trim().isNotEmpty &&
        !request.email!.contains('@')) {
      throw const ValidationFailure('Email formati noto\'g\'ri');
    }
  }

  /// Telefon raqamini normalizatsiya qiladi; bo'sh/yo'q bo'lsa null.
  String? _normalizePhone(String? phone) {
    if (phone == null || phone.trim().isEmpty) return null;
    try {
      return PhoneNumber.validate(phone).normalized;
    } on FormatException catch (e) {
      throw ValidationFailure(e.message);
    }
  }

  static String _sourceLabel(LeadSource source) {
    return switch (source) {
      LeadSource.instagram => 'Instagram',
      LeadSource.telegram => 'Telegram',
      LeadSource.referral => 'Referral',
      LeadSource.walkIn => 'Walk-in',
      LeadSource.website => 'Veb-sayt',
      LeadSource.other => 'Boshqa',
    };
  }
}
