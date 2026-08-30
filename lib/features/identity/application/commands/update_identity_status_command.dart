import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../domain/entities/identity.dart';
import '../../domain/entities/identity_activity.dart';
import '../../domain/events/identity_events.dart';
import '../../domain/repositories/identity_repository.dart';

/// Identity status workflow command'i
/// (faol → muzlatilgan → bitirgan → arxiv, spec §4 #11).
class UpdateIdentityStatusCommand {
  final IdentityRepository _repository;
  final EventBus _eventBus;

  /// RBAC (AUDIT P2-02): status o'zgartirish — o'quvchilar boshqaruvi.
  final UserRole actorRole;

  UpdateIdentityStatusCommand({
    required IdentityRepository repository,
    required EventBus eventBus,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _eventBus = eventBus;

  Future<Identity> execute(String identityId, IdentityStatus newStatus) async {
    Permissions.require(actorRole, AppPermission.studentsArchive);

    final current = await _repository.fetchByIdentityId(identityId);
    if (current == null) {
      throw NotFoundFailure('Identity topilmadi: $identityId');
    }

    if (!_isValidTransition(current.status, newStatus)) {
      throw ValidationFailure(
        'Ruxsat etilmagan holat o\'tishi: ${current.status.name} → '
        '${newStatus.name}',
      );
    }

    final updated = await _repository.updateStatus(identityId, newStatus);

    final activity = IdentityActivity(
      identityId: identityId,
      type: IdentityActivityTypes.statusChanged,
      description: 'Holat o\'zgardi: ${_statusLabel(current.status)} → '
          '${_statusLabel(newStatus)}',
      occurredAt: DateTime.now(),
    );
    await _repository.recordActivity(activity);

    _eventBus.publish(IdentityStatusChangedEvent(
      identity: updated,
      previousStatus: current.status.name,
      occurredAt: DateTime.now(),
    ));

    return updated;
  }

  /// Status workflow'i (spec §4 #11): faol → muzlatilgan → bitirgan → arxiv.
  ///
  /// Ruxsat etilgan o'tishlar (UI bilan bir xil):
  ///   active    → frozen / graduated / archived
  ///   frozen    → active (qayta faollashtirish)
  ///   graduated → archived
  ///   archived  → active (qayta faollashtirish)
  bool _isValidTransition(IdentityStatus from, IdentityStatus to) {
    if (from == to) return false;
    return switch (from) {
      IdentityStatus.active => to == IdentityStatus.frozen ||
          to == IdentityStatus.graduated ||
          to == IdentityStatus.archived,
      IdentityStatus.frozen => to == IdentityStatus.active,
      IdentityStatus.graduated => to == IdentityStatus.archived,
      IdentityStatus.archived => to == IdentityStatus.active,
    };
  }

  static String _statusLabel(IdentityStatus status) {
    return switch (status) {
      IdentityStatus.active => 'faol',
      IdentityStatus.frozen => 'muzlatilgan',
      IdentityStatus.graduated => 'bitirgan',
      IdentityStatus.archived => 'arxivlangan',
    };
  }
}
