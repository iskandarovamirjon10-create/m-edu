import 'dart:async';

import '../../../../core/services/app_logger.dart';

import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/event_bus/event_projector.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../identity/domain/entities/identity_activity.dart';
import '../../../identity/domain/events/identity_events.dart';
import '../../../identity/domain/repositories/identity_repository.dart';
import '../commands/register_teacher_command.dart';

/// `IdentityRegisteredEvent` (rol = teacher) → Teacher yozuvi proyeksiyasi.
///
/// C-02 bilan bir xil muammo: identity ro'yxatga olinganda Teacher
/// yozuvi yaratilmasdi — O'qituvchilar tabi doim bo'sh qolardi.
/// Bu proyeksiya [StudentEnrollmentProjector] bilan bir xil pattern'da
/// teacher'ni avtomatik yaratadi.
class TeacherEnrollmentProjector implements EventProjector {
  final RegisterTeacherCommand _registerTeacherCommand;
  final IdentityRepository _identityRepository;
  final EventBus _eventBus;

  late final StreamSubscription<IdentityRegisteredEvent> _subscription;

  TeacherEnrollmentProjector({
    required RegisterTeacherCommand registerTeacherCommand,
    required IdentityRepository identityRepository,
    required EventBus eventBus,
  })  : _registerTeacherCommand = registerTeacherCommand,
        _identityRepository = identityRepository,
        _eventBus = eventBus {
    _subscription = _eventBus.on<IdentityRegisteredEvent>().listen(_handle);
  }

  Future<void> _handle(IdentityRegisteredEvent event) async {
    if (event.identity.role != IdentityRole.teacher) return;

    try {
      await _registerTeacherCommand.execute(
        RegisterTeacherRequest(identityId: event.identity.identityId),
      );
    } catch (error) {
      AppLogger.warning(
        'TeacherEnrollmentProjector: Teacher creation failed '
        '(${event.identity.identityId}): ${error.runtimeType}',
      );
      try {
        await _identityRepository.recordActivity(IdentityActivity(
          identityId: event.identity.identityId,
          type: IdentityActivityTypes.enrollmentFailed,
          description:
              "O'qituvchi yozuvini avtomatik yaratish muvaffaqiyatsiz: $error",
          occurredAt: DateTime.now(),
        ));
      } catch (_) {
        // Audit-log yozilmasa ham asosiy xato allaqachon log qilingan.
      }
    }
  }

  @override
  void dispose() {
    _subscription.cancel();
  }
}
