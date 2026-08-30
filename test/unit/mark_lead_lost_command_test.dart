import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/crm/application/commands/mark_lead_lost_command.dart';
import 'package:m_edu/features/crm/domain/entities/lead.dart';
import 'package:m_edu/features/crm/domain/entities/lead_activity.dart';
import 'package:m_edu/features/crm/domain/events/lead_events.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

import '../helpers/fake_lead_repository.dart';

void main() {
  group('MarkLeadLostCommand', () {
    late FakeLeadRepository repository;
    late EventBus eventBus;
    late MarkLeadLostCommand command;

    setUp(() {
      repository = FakeLeadRepository();
      eventBus = EventBus();
      command = MarkLeadLostCommand(
        repository: repository,
        eventBus: eventBus,
        actorRole: UserRole.superAdmin,
      );
    });

    Lead storedLead({LeadStage stage = LeadStage.contacted}) {
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

    test('lead lost stage ga otadi, sabab saqlanadi, event chiqadi',
        () async {
      storedLead();
      final publishedFuture = eventBus
          .on<LeadLostEvent>()
          .first
          .then((e) => (reason: e.reason, stage: e.lead.stage));

      final result = await command.execute(const MarkLeadLostRequest(
        leadId: 'LEAD-2026-000001',
        reason: 'Narx mos kelmadi',
      ));

      final published = await publishedFuture;

      expect(result.stage, LeadStage.lost);
      expect(result.lostReason, 'Narx mos kelmadi');
      expect(result.isLost, isTrue);
      expect(result.isStageFinal, isTrue);

      expect(repository.activities.length, 1);
      expect(repository.activities.first.type, LeadActivityTypes.markedLost);
      expect(
        repository.activities.first.description,
        contains('Narx mos kelmadi'),
      );

      expect(published.reason, 'Narx mos kelmadi');
      expect(published.stage, LeadStage.lost);
    });

    test('bos sabab ValidationFailure', () async {
      storedLead();

      expect(
        () => command.execute(const MarkLeadLostRequest(
          leadId: 'LEAD-2026-000001',
          reason: '   ',
        )),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('FINAL holatdan (converted) lost qilib bolmaydi', () async {
      storedLead(stage: LeadStage.converted);

      expect(
        () => command.execute(const MarkLeadLostRequest(
          leadId: 'LEAD-2026-000001',
          reason: 'Sabab',
        )),
        throwsA(isA<ValidationFailure>()),
      );
      expect(repository.saved.first.stage, LeadStage.converted);
    });

    test('lead topilmasa NotFoundFailure', () async {
      expect(
        () => command.execute(const MarkLeadLostRequest(
          leadId: 'LEAD-9999',
          reason: 'Sabab',
        )),
        throwsA(isA<NotFoundFailure>()),
      );
    });

    test('RBAC: ruxsatsiz rol uchun PermissionDeniedFailure', () async {
      storedLead();
      final denied = MarkLeadLostCommand(
        repository: repository,
        eventBus: eventBus,
        actorRole: UserRole.teacher,
      );

      expect(
        () => denied.execute(const MarkLeadLostRequest(
          leadId: 'LEAD-2026-000001',
          reason: 'Sabab',
        )),
        throwsA(isA<PermissionDeniedFailure>()),
      );
    });
  });
}
