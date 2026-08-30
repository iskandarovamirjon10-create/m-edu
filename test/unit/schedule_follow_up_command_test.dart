import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/crm/application/commands/schedule_follow_up_command.dart';
import 'package:m_edu/features/crm/domain/entities/lead.dart';
import 'package:m_edu/features/crm/domain/entities/lead_activity.dart';
import 'package:m_edu/features/crm/domain/events/lead_events.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

import '../helpers/fake_lead_repository.dart';

void main() {
  group('ScheduleFollowUpCommand', () {
    late FakeLeadRepository repository;
    late EventBus eventBus;
    late ScheduleFollowUpCommand command;

    setUp(() {
      repository = FakeLeadRepository();
      eventBus = EventBus();
      command = ScheduleFollowUpCommand(
        repository: repository,
        eventBus: eventBus,
        actorRole: UserRole.superAdmin,
      );
    });

    void storedLead() {
      repository.saved.add(Lead(
        leadId: 'LEAD-2026-000001',
        fullName: 'Ali Valiyev',
        phone: '+998901234567',
        source: LeadSource.walkIn,
        stage: LeadStage.contacted,
        createdAt: DateTime(2026, 8, 1),
      ));
    }

    test('nextFollowUpAt urnatiladi, event chiqadi', () async {
      storedLead();
      final followUpAt = DateTime.now().add(const Duration(days: 3));
      final publishedFuture = eventBus
          .on<LeadFollowUpScheduledEvent>()
          .first
          .then((e) => (e.followUpAt, e.lead.stage));

      final result = await command.execute(ScheduleFollowUpRequest(
        leadId: 'LEAD-2026-000001',
        followUpAt: followUpAt,
      ));

      final published = await publishedFuture;

      expect(result.nextFollowUpAt, followUpAt);
      expect(result.updatedAt, isNotNull);

      expect(repository.activities.length, 1);
      expect(
        repository.activities.first.type,
        LeadActivityTypes.followUpScheduled,
      );

      expect(published.$1, followUpAt);
      expect(published.$2, LeadStage.contacted);
    });

    test("otgan vaqtga follow-up belgilab bolmaydi", () async {
      storedLead();

      expect(
        () => command.execute(ScheduleFollowUpRequest(
          leadId: 'LEAD-2026-000001',
          followUpAt: DateTime(2020, 1, 1),
        )),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('FINAL holatdagi leadga follow-up belgilab bolmaydi', () async {
      repository.saved.add(Lead(
        leadId: 'LEAD-2026-000001',
        fullName: 'Ali Valiyev',
        source: LeadSource.walkIn,
        stage: LeadStage.lost,
        createdAt: DateTime(2026, 8, 1),
      ));

      expect(
        () => command.execute(ScheduleFollowUpRequest(
          leadId: 'LEAD-2026-000001',
          followUpAt: DateTime.now().add(const Duration(days: 7)),
        )),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('lead topilmasa NotFoundFailure', () async {
      expect(
        () => command.execute(ScheduleFollowUpRequest(
          leadId: 'LEAD-9999',
          followUpAt: DateTime.now().add(const Duration(days: 7)),
        )),
        throwsA(isA<NotFoundFailure>()),
      );
    });

    test('RBAC: ruxsatsiz rol uchun PermissionDeniedFailure', () async {
      storedLead();
      final denied = ScheduleFollowUpCommand(
        repository: repository,
        eventBus: eventBus,
        actorRole: UserRole.teacher,
      );

      expect(
        () => denied.execute(ScheduleFollowUpRequest(
          leadId: 'LEAD-2026-000001',
          followUpAt: DateTime.now().add(const Duration(days: 7)),
        )),
        throwsA(isA<PermissionDeniedFailure>()),
      );
    });
  });
}
