import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../domain/entities/organization.dart';
import '../../domain/events/organization_events.dart';
import '../../domain/repositories/organization_repository.dart';

/// First-run wizard uchun so'rov.
class SetupOrganizationRequest {
  final String organizationName;
  final String branchName;
  final String? roomName;
  final String? courseName;

  const SetupOrganizationRequest({
    required this.organizationName,
    required this.branchName,
    this.roomName,
    this.courseName,
  });
}

/// `SetupOrganization` command'i — tashkilotni o'rnatadi.
///
/// Spec §5: admin majburiy ravishda haqiqiy markaz nomi va filialni
/// kiritishi shart; xona/kurs ixtiyoriy (keyinroq sozlamalardan qo'shiladi).
class SetupOrganizationCommand {
  final OrganizationRepository _repository;
  final EventBus _eventBus;

  /// RBAC (AUDIT P2-02): tashkilotni faqat ruxsatli rol o'rnata oladi.
  /// `/setup` auth talab qiladi (router) — egasi (superAdmin) ruxsatga ega.
  final UserRole actorRole;

  SetupOrganizationCommand({
    required OrganizationRepository repository,
    required EventBus eventBus,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _eventBus = eventBus;

  Future<Organization> execute(SetupOrganizationRequest request) async {
    Permissions.require(actorRole, AppPermission.settingsEdit);
    _validate(request);

    final now = DateTime.now();
    final organization = Organization(
      organizationName: request.organizationName.trim(),
      branchName: request.branchName.trim(),
      roomName: _nullableTrim(request.roomName),
      courseName: _nullableTrim(request.courseName),
      createdAt: now,
      syncVersion: 1,
      pendingSync: true,
    );

    final saved = await _repository.save(organization);

    _eventBus.publish(OrganizationSetupCompletedEvent(
      organization: saved,
      occurredAt: now,
    ));

    return saved;
  }

  void _validate(SetupOrganizationRequest request) {
    if (request.organizationName.trim().isEmpty) {
      throw const ValidationFailure(
        'Markaz nomi kiritilishi shart — real tashkilot ma\'lumoti talab qilinadi',
      );
    }
    if (request.branchName.trim().isEmpty) {
      throw const ValidationFailure('Filial nomi kiritilishi shart');
    }
    if (request.organizationName.trim().length < 2) {
      throw const ValidationFailure(
        'Markaz nomi kamida 2 ta belgidan iborat bo\'lishi kerak',
      );
    }
  }

  String? _nullableTrim(String? value) {
    final trimmed = value?.trim();
    return (trimmed == null || trimmed.isEmpty) ? null : trimmed;
  }
}
