import 'dart:math';

import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/crm/application/commands/convert_lead_command.dart';
import 'package:m_edu/features/crm/domain/entities/lead.dart';
import 'package:m_edu/features/crm/domain/entities/lead_activity.dart';
import 'package:m_edu/features/crm/domain/events/lead_events.dart';
import 'package:m_edu/features/identity/application/commands/register_identity_command.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';
import 'package:m_edu/features/identity/domain/services/identity_id_generator.dart';
import 'package:m_edu/features/identity/domain/value_objects/real_id.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

import '../helpers/fake_lead_repository.dart';
import '../helpers/fake_repositories.dart';

void main() {
  // Fake generator deterministik — shu ID'ni qaytaradi (Random(42)).
  final expectedIdentityId = RealId.generate(
    now: DateTime(2026, 1, 1),
    random: Random(42),
  ).value;

  group('ConvertLeadCommand', () {
    late FakeLeadRepository leadRepository;
    late FakeIdentityRepository identityRepository;
    late EventBus eventBus;
    late ConvertLeadCommand command;

    ConvertLeadCommand buildCommand() {
      return ConvertLeadCommand(
        repository: leadRepository,
        registerIdentity: RegisterIdentityCommand(
          repository: identityRepository,
          idGenerator: _FakeIdentityIdGenerator(),
          eventBus: eventBus,
          actorRole: UserRole.superAdmin,
        ),
        eventBus: eventBus,
        actorRole: UserRole.superAdmin,
      );
    }

    setUp(() {
      leadRepository = FakeLeadRepository();
      identityRepository = FakeIdentityRepository();
      eventBus = EventBus();
      command = buildCommand();
    });

    void storedLead({LeadStage stage = LeadStage.trialScheduled}) {
      leadRepository.saved.add(Lead(
        leadId: 'LEAD-2026-000001',
        fullName: 'Ali Valiyev',
        phone: '+998901234567',
        email: 'ali@example.com',
        source: LeadSource.walkIn,
        stage: stage,
        createdAt: DateTime(2026, 8, 1),
      ));
    }

    test('lead converted boladi, Identity yaratiladi, event chiqadi',
        () async {
      storedLead();
      final publishedFuture = eventBus
          .on<LeadConvertedEvent>()
          .first
          .then((e) => (identityId: e.identityId, stage: e.lead.stage));

      final result = await command.execute(
        const ConvertLeadRequest(leadId: 'LEAD-2026-000001', lastName: 'Valiyev'),
      );

      final published = await publishedFuture;

      // Lead FINAL converted holatida.
      expect(result.stage, LeadStage.converted);
      expect(result.isConverted, isTrue);
      expect(result.convertedToIdentityId, expectedIdentityId);

      // Identity student sifatida yaratilgan.
      expect(identityRepository.identities.length, 1);
      final identity = identityRepository.identities.first;
      expect(identity.firstName, 'Ali');
      expect(identity.lastName, 'Valiyev');
      expect(identity.role, IdentityRole.student);
      expect(identity.phone, '+998901234567');
      expect(identity.email, 'ali@example.com');

      // Activity CONVERTED.
      expect(leadRepository.activities.length, 1);
      expect(leadRepository.activities.first.type, LeadActivityTypes.converted);
      expect(
        leadRepository.activities.first.description,
        contains(expectedIdentityId),
      );

      // Event.
      expect(published.identityId, expectedIdentityId);
      expect(published.stage, LeadStage.converted);
    });

    test("fullName dan familiya ajratiladi (lastName berilmaganda)",
        () async {
      storedLead();

      final result = await command.execute(
        const ConvertLeadRequest(leadId: 'LEAD-2026-000001', lastName: ''),
      );

      expect(identityRepository.identities.first.firstName, 'Ali');
      expect(identityRepository.identities.first.lastName, 'Valiyev');
      expect(result.stage, LeadStage.converted);
    });

    test('FINAL holatdan konvertatsiya qilib bolmaydi', () async {
      storedLead(stage: LeadStage.lost);

      expect(
        () => command.execute(
          const ConvertLeadRequest(leadId: 'LEAD-2026-000001', lastName: 'V'),
        ),
        throwsA(isA<ValidationFailure>()),
      );
      expect(identityRepository.identities, isEmpty);
      expect(leadRepository.saved.first.stage, LeadStage.lost);
    });

    test('lead topilmasa NotFoundFailure', () async {
      expect(
        () => command.execute(
          const ConvertLeadRequest(leadId: 'LEAD-9999', lastName: 'V'),
        ),
        throwsA(isA<NotFoundFailure>()),
      );
    });

    test('RBAC: ruxsatsiz rol uchun PermissionDeniedFailure', () async {
      storedLead();
      final denied = ConvertLeadCommand(
        repository: leadRepository,
        registerIdentity: RegisterIdentityCommand(
          repository: identityRepository,
          idGenerator: _FakeIdentityIdGenerator(),
          eventBus: eventBus,
          actorRole: UserRole.superAdmin,
        ),
        eventBus: eventBus,
        actorRole: UserRole.teacher,
      );

      expect(
        () => denied.execute(
          const ConvertLeadRequest(leadId: 'LEAD-2026-000001', lastName: 'V'),
        ),
        throwsA(isA<PermissionDeniedFailure>()),
      );
    });
  });
}

/// Deterministik ULID generator (A2/E2) — Random(42) har safar bir xil ID.
class _FakeIdentityIdGenerator implements IdentityIdGenerator {
  @override
  Future<RealId> next() async {
    return RealId.generate(
      now: DateTime(2026, 1, 1),
      random: Random(42),
    );
  }
}
