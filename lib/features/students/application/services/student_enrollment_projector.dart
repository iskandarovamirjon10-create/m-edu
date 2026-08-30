import 'dart:async';

import '../../../../core/services/app_logger.dart';

import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/event_bus/event_projector.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../identity/domain/entities/identity_activity.dart';
import '../../../identity/domain/events/identity_events.dart';
import '../../../identity/domain/repositories/identity_repository.dart';
import '../commands/register_student_command.dart';

/// `IdentityRegisteredEvent` (rol = student) → Student yozuvi proyeksiyasi.
///
/// C-02: Ro'yxatdan o'tish faqat Identity yozardi — Student yozuvi hech
/// qachon yaratilmagani uchun O'quvchilar ro'yxati va dashboard doim
/// bo'sh qolardi. Bu proyeksiya Identity domain event'ini eshitib,
/// Student'ni avtomatik yaratadi.
///
/// NEGA EVENT-DRIVEN? Identity o'z domain'ida, Student esa students
/// domain'ida yashaydi. Feature'lar bir-biriga to'g'ridan-to'g'ri
/// bog'lanmaydi — Domain Event orqali bog'lanadi (§55). Identity
/// yozilgach `IdentityRegisteredEvent` tarqaladi, bu proyeksiya esa
/// o'z domain'ida javob beradi.
///
/// Xatolik yashirilmaydi (§10): muvaffaqiyatsizlik audit-log'ga
/// (`ENROLLMENT_FAILED`) yoziladi va `debugPrint` bilan log qilinadi.
class StudentEnrollmentProjector implements EventProjector {
  final RegisterStudentCommand _registerStudentCommand;
  final IdentityRepository _identityRepository;
  final EventBus _eventBus;

  late final StreamSubscription<IdentityRegisteredEvent> _subscription;

  StudentEnrollmentProjector({
    required RegisterStudentCommand registerStudentCommand,
    required IdentityRepository identityRepository,
    required EventBus eventBus,
  })  : _registerStudentCommand = registerStudentCommand,
        _identityRepository = identityRepository,
        _eventBus = eventBus {
    _subscription = _eventBus.on<IdentityRegisteredEvent>().listen(_handle);
  }

  Future<void> _handle(IdentityRegisteredEvent event) async {
    if (event.identity.role != IdentityRole.student) return;

    try {
      await _registerStudentCommand.execute(
        RegisterStudentRequest(identityId: event.identity.identityId),
      );
    } catch (error) {
      AppLogger.warning(
        'StudentEnrollmentProjector: Student creation failed '
        '(${event.identity.identityId}): ${error.runtimeType}',
      );
      try {
        await _identityRepository.recordActivity(IdentityActivity(
          identityId: event.identity.identityId,
          type: IdentityActivityTypes.enrollmentFailed,
          description:
              'Talaba yozuvini avtomatik yaratish muvaffaqiyatsiz: $error',
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
