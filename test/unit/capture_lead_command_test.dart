import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/audit/application/services/audit_service.dart';
import 'package:m_edu/features/audit/domain/entities/audit_log_entry.dart';
import 'package:m_edu/features/crm/application/commands/capture_lead_command.dart';
import 'package:m_edu/features/crm/domain/entities/lead.dart';
import 'package:m_edu/features/crm/domain/entities/lead_activity.dart';
import 'package:m_edu/features/crm/domain/events/lead_events.dart';
import 'package:m_edu/features/crm/domain/value_objects/lead_score.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

import '../helpers/fake_lead_repository.dart';

void main() {
  group('CaptureLeadCommand', () {
    late FakeLeadRepository repository;
    late FakeLeadIdGenerator idGenerator;
    late EventBus eventBus;
    late CaptureLeadCommand command;

    setUp(() {
      repository = FakeLeadRepository();
      idGenerator = FakeLeadIdGenerator();
      eventBus = EventBus();
      command = CaptureLeadCommand(
        repository: repository,
        idGenerator: idGenerator,
        eventBus: eventBus,
        actorRole: UserRole.superAdmin,
      );
    });

    test("lead'ni Real ID, activity va event bilan saqlaydi", () async {
      final publishedFuture =
          eventBus.on<LeadCapturedEvent>().first.then((e) => e.lead);

      final result = await command.execute(const CaptureLeadRequest(
        fullName: 'Ali Valiyev',
        phone: '+998 90 123 45 67',
        source: LeadSource.walkIn,
      ));

      final published = await publishedFuture;

      expect(result.lead.leadId, 'LEAD-2026-000001');
      expect(result.lead.fullName, 'Ali Valiyev');
      expect(result.lead.stage, LeadStage.newLead);
      expect(result.hasDuplicates, isFalse);

      // Telefon normalizatsiyalangan.
      expect(result.lead.phone, '+998901234567');

      // Scoring hisoblangan (+2 ism+telefon).
      expect(result.lead.score, 2);
      expect(result.lead.scoreBucket, LeadScoreBucket.warm);

      // Repository'da saqlangan + activity yozilgan.
      expect(repository.saved.length, 1);
      expect(repository.activities.length, 1);
      expect(
        repository.activities.first.type,
        LeadActivityTypes.captured,
      );

      // Event tarqatilgan.
      expect(published.leadId, result.lead.leadId);
    });

    test('referral manba scorega +2 qo\'shadi', () async {
      final result = await command.execute(const CaptureLeadRequest(
        fullName: 'Bekzod Karimov',
        phone: '+998901234567',
        source: LeadSource.referral,
      ));

      expect(result.lead.score, 4); // +2 ism+telefon, +2 referral
      expect(result.lead.scoreBucket, LeadScoreBucket.warm);
    });

    test("bo'sh ism uchun ValidationFailure tashlaydi", () async {
      expect(
        () => command.execute(const CaptureLeadRequest(
          fullName: ' ',
          source: LeadSource.website,
        )),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test("noto'g'ri telefon uchun ValidationFailure tashlaydi", () async {
      expect(
        () => command.execute(const CaptureLeadRequest(
          fullName: 'Ali Valiyev',
          phone: '12',
          source: LeadSource.website,
        )),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test("noto'g'ri email uchun ValidationFailure tashlaydi", () async {
      expect(
        () => command.execute(const CaptureLeadRequest(
          fullName: 'Ali Valiyev',
          email: 'not-an-email',
          source: LeadSource.website,
        )),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('dedup tekshiruvi: o\'xshash lead bo\'lsa ogohlantiradi, '
        'LEKIN BLOKLAMAYDI', () async {
      // Oldin shu ism/telefonli lead bor.
      await repository.save(Lead(
        leadId: 'LEAD-2026-000001',
        fullName: 'Ali Valiyev',
        phone: '+998901234567',
        source: LeadSource.telegram,
        stage: LeadStage.newLead,
        createdAt: DateTime(2026, 8, 1),
      ));
      // Generator 1-dan boshlasin — yangi lead 000002 bo'ladi.
      command = CaptureLeadCommand(
        repository: repository,
        idGenerator: FakeLeadIdGenerator(startFrom: 1),
        eventBus: eventBus,
        actorRole: UserRole.superAdmin,
      );

      final result = await command.execute(const CaptureLeadRequest(
        fullName: 'Ali Valiyev',
        phone: '+998901234567',
        source: LeadSource.walkIn,
      ));

      // Ogohlantirish bor...
      expect(result.hasDuplicates, isTrue);
      expect(result.possibleDuplicates.first.fullName, 'Ali Valiyev');

      // ...lekin lead BARIBIR saqlangan (spec: ogohlantirish, bloklamaydi).
      expect(repository.saved.length, 2);
      expect(result.lead.leadId, 'LEAD-2026-000002');
    });

    test('umumiy ism bilan boshqa lead bo\'lsa ham saqlanadi', () async {
      await repository.save(Lead(
        leadId: 'LEAD-2026-000001',
        fullName: 'Ali Valiyev',
        source: LeadSource.walkIn,
        stage: LeadStage.newLead,
        createdAt: DateTime(2026, 8, 1),
      ));
      command = CaptureLeadCommand(
        repository: repository,
        idGenerator: FakeLeadIdGenerator(startFrom: 1),
        eventBus: eventBus,
        actorRole: UserRole.superAdmin,
      );

      final result = await command.execute(const CaptureLeadRequest(
        fullName: 'Ali Valiyev',
        phone: '+998907654321', // boshqa telefon — hali ham ism mosligi bo'yicha ogohlantiradi
        source: LeadSource.walkIn,
      ));

      expect(result.hasDuplicates, isTrue);
      expect(repository.saved.length, 2);
    });

    test("o'xshashlik bo'lmasa ogohlantirish yo'q", () async {
      final result = await command.execute(const CaptureLeadRequest(
        fullName: 'Yangi Ism',
        source: LeadSource.website,
      ));

      expect(result.hasDuplicates, isFalse);
      expect(result.possibleDuplicates, isEmpty);
    });

    test('RBAC: ruxsatsiz rol uchun PermissionDeniedFailure', () async {
      final denied = CaptureLeadCommand(
        repository: repository,
        idGenerator: idGenerator,
        eventBus: eventBus,
        actorRole: UserRole.teacher,
      );

      expect(
        () => denied.execute(const CaptureLeadRequest(
          fullName: 'Ali Valiyev',
          source: LeadSource.walkIn,
        )),
        throwsA(isA<PermissionDeniedFailure>()),
      );
    });

    test('audit yozuvi leadCaptured bilan qayd etiladi', () async {
      final audit = _FakeAudit();
      final audited = CaptureLeadCommand(
        repository: repository,
        idGenerator: idGenerator,
        eventBus: eventBus,
        auditService: audit,
        actorRole: UserRole.superAdmin,
      );

      await audited.execute(const CaptureLeadRequest(
        fullName: 'Ali Valiyev',
        source: LeadSource.instagram,
      ));

      expect(audit.records.length, 1);
      expect(audit.records.first.action, AuditAction.leadCaptured);
      expect(audit.records.first.targetType, 'lead');
      expect(audit.records.first.details, contains('Ali Valiyev'));
    });
  });
}

/// Audit yozuvlarini xotirada ushlab turadigan soxta xizmat.
class _FakeAudit implements AuditService {
  final List<AuditLogEntry> records = [];

  @override
  Future<void> record({
    required AuditAction action,
    required String targetType,
    required String targetId,
    AuditResult result = AuditResult.success,
    String? details,
  }) async {
    records.add(AuditLogEntry(
      auditId: 'AUD-${records.length}',
      actorUserId: 'u1',
      actorName: 'Test',
      action: action,
      occurredAt: DateTime(2026, 8, 11),
      targetType: targetType,
      targetId: targetId,
      result: result,
      details: details,
    ));
  }

  @override
  Future<void> recordFailure({
    required AuditAction action,
    required String targetType,
    required String targetId,
    String? details,
  }) {
    return record(
      action: action,
      targetType: targetType,
      targetId: targetId,
      result: AuditResult.failed,
      details: details,
    );
  }
}
