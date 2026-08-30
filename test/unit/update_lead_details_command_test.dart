import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/crm/application/commands/update_lead_details_command.dart';
import 'package:m_edu/features/crm/domain/entities/lead.dart';
import 'package:m_edu/features/crm/domain/entities/lead_activity.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

import '../helpers/fake_lead_repository.dart';

void main() {
  group('UpdateLeadDetailsCommand', () {
    late FakeLeadRepository repository;
    late UpdateLeadDetailsCommand command;

    setUp(() {
      repository = FakeLeadRepository();
      command = UpdateLeadDetailsCommand(
        repository: repository,
        eventBus: EventBus(),
        actorRole: UserRole.superAdmin,
      );
    });

    void storedLead() {
      repository.saved.add(Lead(
        leadId: 'LEAD-2026-000001',
        fullName: 'Ali Valiyev',
        phone: '+998901234567',
        email: 'ali@example.com',
        source: LeadSource.walkIn,
        stage: LeadStage.contacted,
        createdAt: DateTime(2026, 8, 1),
      ));
    }

    test('masul va izoh yangilanadi, UPDATED activity yoziladi', () async {
      storedLead();

      final result = await command.execute(UpdateLeadDetailsRequest(
        leadId: 'LEAD-2026-000001',
        assignedToUserId: 'admin@medu.uz',
        notes: 'Sinov darsiga chaqirildi',
      ));

      expect(result.assignedToUserId, 'admin@medu.uz');
      expect(result.notes, 'Sinov darsiga chaqirildi');

      expect(repository.activities.length, 1);
      expect(repository.activities.first.type, LeadActivityTypes.updated);
      expect(
        repository.activities.first.description,
        contains("mas'ul: admin@medu.uz"),
      );
    });

    test('null qolgan maydonlar ozgarmaydi (copyWith semantics)', () async {
      storedLead();

      final result = await command.execute(UpdateLeadDetailsRequest(
        leadId: 'LEAD-2026-000001',
        notes: 'Faqat izoh',
      ));

      expect(result.phone, '+998901234567');
      expect(result.email, 'ali@example.com');
      expect(result.assignedToUserId, isNull);
    });

    test('clearAssigned masulni boshatadi', () async {
      storedLead();
      repository.saved[0] =
          repository.saved[0].copyWith(assignedToUserId: 'admin@medu.uz');

      final result = await command.execute(UpdateLeadDetailsRequest(
        leadId: 'LEAD-2026-000001',
        clearAssigned: true,
      ));

      expect(result.assignedToUserId, isNull);
    });

    test('notogri telefon ValidationFailure', () async {
      storedLead();

      expect(
        () => command.execute(UpdateLeadDetailsRequest(
          leadId: 'LEAD-2026-000001',
          phone: 'abc',
        )),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('lead topilmasa NotFoundFailure', () async {
      expect(
        () => command.execute(UpdateLeadDetailsRequest(
          leadId: 'LEAD-9999',
          notes: 'izoh',
        )),
        throwsA(isA<NotFoundFailure>()),
      );
    });

    test('RBAC: ruxsatsiz rol uchun PermissionDeniedFailure', () async {
      storedLead();
      final denied = UpdateLeadDetailsCommand(
        repository: repository,
        eventBus: EventBus(),
        actorRole: UserRole.teacher,
      );

      expect(
        () => denied.execute(UpdateLeadDetailsRequest(
          leadId: 'LEAD-2026-000001',
          notes: 'izoh',
        )),
        throwsA(isA<PermissionDeniedFailure>()),
      );
    });
  });
}
