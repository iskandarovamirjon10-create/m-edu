import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';
import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/organization/application/commands/setup_organization_command.dart';
import 'package:m_edu/features/organization/domain/entities/organization.dart';
import 'package:m_edu/features/organization/domain/events/organization_events.dart';
import 'package:m_edu/features/organization/domain/repositories/organization_repository.dart';

void main() {
  group('SetupOrganizationCommand', () {
    late FakeOrganizationRepository repository;
    late EventBus eventBus;
    late SetupOrganizationCommand command;

    setUp(() {
      repository = FakeOrganizationRepository();
      eventBus = EventBus();
      command = SetupOrganizationCommand(
        repository: repository,
        eventBus: eventBus,
        actorRole: UserRole.superAdmin,
      );
    });

    test('tashkilotni saqlaydi va hodisa tarqatadi', () async {
      final publishedFuture = eventBus
          .on<OrganizationSetupCompletedEvent>()
          .first
          .then((e) => e.organization);

      final organization = await command.execute(
        const SetupOrganizationRequest(
          organizationName: 'Bilim ta\'lim markazi',
          branchName: 'Chilonzor filiali',
          roomName: 'Xona 204',
          courseName: 'Matematika',
        ),
      );

      expect(organization.organizationName, 'Bilim ta\'lim markazi');
      expect(organization.branchName, 'Chilonzor filiali');
      expect(organization.roomName, 'Xona 204');
      expect(organization.courseName, 'Matematika');
      expect(organization.pendingSync, isTrue);

      final published = await publishedFuture;
      expect(published.organizationName, 'Bilim ta\'lim markazi');
    });

    test('bo\'sh markaz nomi uchun ValidationFailure tashlaydi', () {
      expect(
        () => command.execute(
          const SetupOrganizationRequest(
            organizationName: ' ',
            branchName: 'Filial',
          ),
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('bo\'sh filial uchun ValidationFailure tashlaydi', () {
      expect(
        () => command.execute(
          const SetupOrganizationRequest(
            organizationName: 'Markaz',
            branchName: '',
          ),
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('ixtiyoriy maydonlar bo\'sh bo\'lsa null saqlanadi', () async {
      final organization = await command.execute(
        const SetupOrganizationRequest(
          organizationName: 'Markaz',
          branchName: 'Filial',
        ),
      );
      expect(organization.roomName, isNull);
      expect(organization.courseName, isNull);
    });
  });
}

class FakeOrganizationRepository implements OrganizationRepository {
  Organization? current;

  @override
  Future<Organization?> fetchCurrent() async => current;

  @override
  Future<Organization> save(Organization organization) async {
    current = organization;
    return organization;
  }
}
