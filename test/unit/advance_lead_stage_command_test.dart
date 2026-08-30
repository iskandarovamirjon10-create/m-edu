import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/crm/application/commands/advance_lead_stage_command.dart';
import 'package:m_edu/features/crm/domain/entities/lead.dart';
import 'package:m_edu/features/crm/domain/entities/lead_activity.dart';
import 'package:m_edu/features/crm/domain/events/lead_events.dart';
import 'package:m_edu/features/crm/domain/value_objects/lead_score.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

import '../helpers/fake_lead_repository.dart';

void main() {
  group('AdvanceLeadStageCommand', () {
    late FakeLeadRepository repository;
    late EventBus eventBus;
    late AdvanceLeadStageCommand command;

    setUp(() {
      repository = FakeLeadRepository();
      eventBus = EventBus();
      command = AdvanceLeadStageCommand(
        repository: repository,
        eventBus: eventBus,
        actorRole: UserRole.superAdmin,
      );
    });

    Lead storedLead({LeadStage stage = LeadStage.newLead}) {
      final lead = Lead(
        leadId: 'LEAD-2026-000001',
        fullName: 'Ali Valiyev',
        phone: '+998901234567',
        source: LeadSource.walkIn,
        stage: stage,
        createdAt: DateTime(2026, 8, 1),
      );
      repository.saved.add(lead);
      return lead;
    }

    test('newLead → contacted: bosqich o\'zgaradi, lastContactedAt '
        'yangilanadi, event from/to bilan', () async {
      storedLead();
      final publishedFuture = eventBus
          .on<LeadStageChangedEvent>()
          .first
          .then((e) => (from: e.fromStage, to: e.toStage));

      final result = await command.execute(const AdvanceLeadStageRequest(
        leadId: 'LEAD-2026-000001',
        newStage: LeadStage.contacted,
      ));

      final published = await publishedFuture;

      expect(result.stage, LeadStage.contacted);
      // contacted'ga o'tish — lastContactedAt hozirgi vaqtga tenglanadi.
      expect(result.lastContactedAt, isNotNull);
      expect(result.updatedAt, isNotNull);

      // Activity yozilgan.
      expect(repository.activities.length, 1);
      expect(
        repository.activities.first.type,
        LeadActivityTypes.stageChanged,
      );
      expect(
        repository.activities.first.description,
        contains('Yangi → Bog\'lanildi'),
      );

      // Event to'g'ri from/to bilan.
      expect(published.from, LeadStage.newLead);
      expect(published.to, LeadStage.contacted);
    });

    test('contacted → trialScheduled: lastContactedAt O\'ZGARMAYDI', () async {
      final contacted = storedLead(stage: LeadStage.contacted)
          .copyWith(lastContactedAt: DateTime(2026, 8, 5));
      repository.saved[0] = contacted;

      final result = await command.execute(const AdvanceLeadStageRequest(
        leadId: 'LEAD-2026-000001',
        newStage: LeadStage.trialScheduled,
      ));

      expect(result.stage, LeadStage.trialScheduled);
      expect(result.lastContactedAt, DateTime(2026, 8, 5));
    });

    test('orqaga qaytish (trialScheduled → contacted) final bo\'lmagan '
        'bosqichlar orasida ruxsat etiladi', () async {
      storedLead(stage: LeadStage.trialScheduled);

      final result = await command.execute(const AdvanceLeadStageRequest(
        leadId: 'LEAD-2026-000001',
        newStage: LeadStage.contacted,
      ));

      expect(result.stage, LeadStage.contacted);
    });

    test('FINAL qoida: converted leaddan qaytish MUMKIN EMAS', () async {
      storedLead(stage: LeadStage.converted);

      expect(
        () => command.execute(const AdvanceLeadStageRequest(
          leadId: 'LEAD-2026-000001',
          newStage: LeadStage.contacted,
        )),
        throwsA(isA<ValidationFailure>()),
      );
      // Yozuv o'zgarmagan.
      expect(repository.saved.first.stage, LeadStage.converted);
      expect(repository.activities, isEmpty);
    });

    test('FINAL qoida: lost leaddan qaytish MUMKIN EMAS', () async {
      storedLead(stage: LeadStage.lost);

      expect(
        () => command.execute(const AdvanceLeadStageRequest(
          leadId: 'LEAD-2026-000001',
          newStage: LeadStage.newLead,
        )),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('newStage == converted/lost — alohida command talab qilinadi',
        () async {
      storedLead();

      // converted'ga bu command orqali o'tib bo'lmaydi.
      expect(
        () => command.execute(const AdvanceLeadStageRequest(
          leadId: 'LEAD-2026-000001',
          newStage: LeadStage.converted,
        )),
        throwsA(isA<ValidationFailure>()),
      );
      // lost'ga ham.
      expect(
        () => command.execute(const AdvanceLeadStageRequest(
          leadId: 'LEAD-2026-000001',
          newStage: LeadStage.lost,
        )),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('bir xil bosqichga o\'tish — no-op, ValidationFailure', () async {
      storedLead(stage: LeadStage.contacted);

      expect(
        () => command.execute(const AdvanceLeadStageRequest(
          leadId: 'LEAD-2026-000001',
          newStage: LeadStage.contacted,
        )),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('lead topilmasa NotFoundFailure', () async {
      expect(
        () => command.execute(const AdvanceLeadStageRequest(
          leadId: 'LEAD-9999',
          newStage: LeadStage.contacted,
        )),
        throwsA(isA<NotFoundFailure>()),
      );
    });

    test('RBAC: ruxsatsiz rol uchun PermissionDeniedFailure', () async {
      storedLead();
      final denied = AdvanceLeadStageCommand(
        repository: repository,
        eventBus: eventBus,
        actorRole: UserRole.teacher,
      );

      expect(
        () => denied.execute(const AdvanceLeadStageRequest(
          leadId: 'LEAD-2026-000001',
          newStage: LeadStage.contacted,
        )),
        throwsA(isA<PermissionDeniedFailure>()),
      );
    });

    test('score qayta hisoblanadi (sovib qolish qoidasi ta\'sir qiladi)',
        () async {
      // 4 kun oldin yaratilgan, hali newLead — "sovib qolyapti" (-2).
      final stale = Lead(
        leadId: 'LEAD-2026-000001',
        fullName: 'Ali Valiyev',
        phone: '+998901234567',
        source: LeadSource.referral,
        stage: LeadStage.newLead,
        createdAt: DateTime(2026, 8, 1), // 10 kun oldin
      );
      repository.saved.add(stale);

      final result = await command.execute(const AdvanceLeadStageRequest(
        leadId: 'LEAD-2026-000001',
        newStage: LeadStage.contacted,
      ));

      // Bosqich contacted bo'ldi → "sovib qolish" jazosi yo'qoladi:
      // +2 ism+telefon, +2 referral, +1 yaqinda aloqa (endigina contacted) = 5.
      expect(result.score, 5);
      expect(result.scoreBucket, LeadScoreBucket.hot);
    });
  });
}
