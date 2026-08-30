import '../../../identity/domain/entities/identity_activity.dart';
import '../../../identity/domain/repositories/identity_repository.dart';
import '../../application/commands/record_attendance_command.dart';

/// Davomat belgilanganda Identity Activity Timeline'ga audit-log yozadi
/// (spec §3 — har bir muhim harakat qayd etiladi).
class AttendanceActivityRecorder {
  final IdentityRepository _identityRepository;

  AttendanceActivityRecorder({required IdentityRepository identityRepository})
      : _identityRepository = identityRepository;

  Future<void> record({
    required String identityId,
    required String method,
    AttendanceAction action = AttendanceAction.checkIn,
    double? confidence,
  }) async {
    final methodLabel = switch (method) {
      'face' => 'Face ID',
      'qr' => 'QR kod',
      _ => "qo'lda",
    };
    final actionLabel = switch (action) {
      AttendanceAction.checkIn => 'kirish',
      AttendanceAction.checkOut => 'chiqish',
      AttendanceAction.duplicate => 'takroriy',
    };
    await _identityRepository.recordActivity(
      IdentityActivity(
        identityId: identityId,
        type: IdentityActivityTypes.attendanceMarked,
        description: 'Davomat belgilandi ($actionLabel) — usul: $methodLabel'
            '${confidence != null ? ', ishonch: ${(confidence * 100).round()}%' : ''}',
        occurredAt: DateTime.now(),
      ),
    );
  }
}
