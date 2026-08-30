import '../../../../core/event_bus/event_bus.dart';
import '../entities/attendance_session.dart';

/// Dars davomat sessiyasi ochilgan/hozirlangan hodisasi (P1.5).
///
/// Sessiya ochilganda chiqadi — dashboard/statistika sessiya holatidan
/// xabardor bo'ladi (qo'lda refresh shart emas).
class AttendanceSessionOpenedEvent extends DomainEvent {
  final AttendanceSession session;

  @override
  final DateTime occurredAt;

  const AttendanceSessionOpenedEvent({
    required this.session,
    required this.occurredAt,
  });
}

/// Davomat holati o'zgargan hodisasi (present/late/absent/excused).
class AttendanceStatusChangedEvent extends DomainEvent {
  final String identityId;
  final String fullName;

  /// Yangi holat: present | late | absent | excused.
  final String status;

  /// Oldingi holat (edit bo'lsa; birinchi belgilashda null).
  final String? previousStatus;

  @override
  final DateTime occurredAt;

  const AttendanceStatusChangedEvent({
    required this.identityId,
    required this.fullName,
    required this.status,
    this.previousStatus,
    required this.occurredAt,
  });
}

/// Davomat belgilanganligi hodisasi.
class AttendanceMarkedEvent extends DomainEvent {
  final String identityId;
  final String fullName;

  /// face | qr | manual.
  final String method;
  final DateTime timestamp;

  @override
  final DateTime occurredAt;

  const AttendanceMarkedEvent({
    required this.identityId,
    required this.fullName,
    required this.method,
    required this.timestamp,
  }) : occurredAt = timestamp;
}
