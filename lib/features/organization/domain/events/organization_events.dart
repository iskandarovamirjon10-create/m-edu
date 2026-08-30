import '../../../../core/event_bus/event_bus.dart';
import '../entities/organization.dart';

/// First-run wizard yakunlanganda — tashkilot o'rnatildi.
class OrganizationSetupCompletedEvent extends DomainEvent {
  final Organization organization;
  @override
  final DateTime occurredAt;

  const OrganizationSetupCompletedEvent({
    required this.organization,
    required this.occurredAt,
  });
}
