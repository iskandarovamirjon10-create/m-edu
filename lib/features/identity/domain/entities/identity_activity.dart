import 'package:equatable/equatable.dart';

/// Identity uchun audit-log hodisasi (spec §3 "Activity Timeline").
///
/// Har bir muhim harakat (ro'yxatdan o'tkazish, holat o'zgarishi,
/// to'lov, davomat) ushbu yozuvni generatsiya qiladi.
class IdentityActivity extends Equatable {
  final String identityId;
  final String type;
  final String description;
  final DateTime occurredAt;

  const IdentityActivity({
    required this.identityId,
    required this.type,
    required this.description,
    required this.occurredAt,
  });

  @override
  List<Object?> get props => [identityId, type, description, occurredAt];
}

/// Activity turlari — biznes tili bilan nomlangan (spec §1).
abstract final class IdentityActivityTypes {
  static const String registered = 'REGISTERED';
  static const String statusChanged = 'STATUS_CHANGED';
  static const String faceEnrolled = 'FACE_ENROLLED';
  static const String paymentReceived = 'PAYMENT_RECEIVED';
  static const String attendanceMarked = 'ATTENDANCE_MARKED';
  static const String identityMerged = 'IDENTITY_MERGED';

  /// Identity'ga tegishli yozuvni (Student/Teacher) avtomatik yaratish
  /// muvaffaqiyatsiz tugaganda (C-02 proyeksiyasi — xato yashirilmaydi, §10).
  static const String enrollmentFailed = 'ENROLLMENT_FAILED';
}
