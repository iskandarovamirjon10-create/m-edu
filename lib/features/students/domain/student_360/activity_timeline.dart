import 'package:equatable/equatable.dart';

/// Student 360 — ACTIVITY TIMELINE.
///
/// Identifikatsiya qilingan event'lar Student 360 ning yagona timeline
/// ko'rsatkichi. Har bir event `EventType` (string) va `occurredAt`
/// (DateTime) ga ega.
///
/// EVENT SOURCES (REAL, FABRICATE EMAS):
/// - IdentityActivityRepository (Identity timeline — har bir
///   Identity uchun audit-style activity yozuvlari).
/// - AuditRepository (cross-module audit log: payment, group change,
///   status change, va h.k.).
/// - LeadActivity (CRM lead tarixi, agar mavjud bo'lsa).
///
/// Hozirda timeline'ni quyidagi eventlardan yig'amiz:
/// - IDENTITY_REGISTERED (IdentityActivityTypes.registered)
/// - IDENTITY_STATUS_CHANGED (IdentityActivityTypes.statusChanged)
/// - IDENTITY_FACE_ENROLLED (IdentityActivityTypes.faceEnrolled)
/// - IDENTITY_PAYMENT_RECEIVED (IdentityActivityTypes.paymentReceived)
/// - IDENTITY_ATTENDANCE_MARKED (IdentityActivityTypes.attendanceMarked)
/// - IDENTITY_MERGED (IdentityActivityTypes.identityMerged)
/// - IDENTITY_ENROLLMENT_FAILED (IdentityActivityTypes.enrollmentFailed)
/// - STUDENT_CREATED (audit)
/// - STUDENT_UPDATED (audit)
/// - STUDENT_ARCHIVED (audit)
/// - STUDENT_RESTORED (audit)
/// - STUDENT_GRADUATED (audit)
/// - STUDENT_TRANSFERRED (audit)
/// - STUDENT_DELETED (audit)
/// - GROUP_CHANGED (audit)
/// - PAYMENT_CREATED (audit)
/// - DEBT_CREATED (audit)
/// - EXPENSE_CREATED (audit)
/// - ATTENDANCE_EDITED (audit)
/// - TELEGRAM_LINKED (audit)
/// - REPORT_DELETED (audit)
/// - LEAD_CAPTURED (audit)
/// - LEAD_STAGE_CHANGED (audit)
/// - LEAD_CONVERTED (audit)
/// - LEAD_MARKED_LOST (audit)
/// - LEAD_FOLLOWUP_SCHEDULED (audit)
/// - LEAD_UPDATED (audit)
///
/// UNSUPPORTED events (timeline'da HECH QACHON ko'rinmaydi):
/// - SMS_SENT — M-EDU SMS log qilmaydi (`sms:` intent — tashqi app).
/// - REPORT_GENERATED — hozirda audit'ga yozilmaydi.
/// - NOTE_ADDED — M-EDU'da alohida NOTE event type MAVJUD EMAS.
///   Buni qo'shish uchun yangi audit action kerak.
class TimelineEvent extends Equatable {
  final String id;
  final String type;
  final String description;
  final DateTime occurredAt;

  /// Event qaysi modul'dan kelgan (identity / audit / crm).
  final String source;

  const TimelineEvent({
    required this.id,
    required this.type,
    required this.description,
    required this.occurredAt,
    required this.source,
  });

  @override
  List<Object?> get props => [id, type, description, occurredAt, source];
}

/// Timeline'da ko'rinadigan event turlari (string constants).
/// M-EDU audit + identity activity type'lariga mos.
abstract final class TimelineEventTypes {
  // Identity
  static const String identityRegistered = 'IDENTITY_REGISTERED';
  static const String identityStatusChanged = 'IDENTITY_STATUS_CHANGED';
  static const String identityFaceEnrolled = 'IDENTITY_FACE_ENROLLED';
  static const String identityPaymentReceived = 'IDENTITY_PAYMENT_RECEIVED';
  static const String identityAttendanceMarked = 'IDENTITY_ATTENDANCE_MARKED';
  static const String identityMerged = 'IDENTITY_MERGED';
  static const String identityEnrollmentFailed = 'IDENTITY_ENROLLMENT_FAILED';

  // Student
  static const String studentCreated = 'STUDENT_CREATED';
  static const String studentUpdated = 'STUDENT_UPDATED';
  static const String studentArchived = 'STUDENT_ARCHIVED';
  static const String studentRestored = 'STUDENT_RESTORED';
  static const String studentGraduated = 'STUDENT_GRADUATED';
  static const String studentTransferred = 'STUDENT_TRANSFERRED';
  static const String studentDeleted = 'STUDENT_DELETED';
  static const String groupChanged = 'GROUP_CHANGED';

  // Payments
  static const String paymentCreated = 'PAYMENT_CREATED';
  static const String debtCreated = 'DEBT_CREATED';
  static const String expenseCreated = 'EXPENSE_CREATED';
  static const String paymentRefunded = 'PAYMENT_REFUNDED';
  static const String paymentCancelled = 'PAYMENT_CANCELLED';

  // Attendance
  static const String attendanceEdited = 'ATTENDANCE_EDITED';

  // Communications
  static const String telegramLinked = 'TELEGRAM_LINKED';
  static const String faceEnrolled = 'FACE_ENROLLED';
  static const String faceRemoved = 'FACE_REMOVED';

  // CRM
  static const String leadCaptured = 'LEAD_CAPTURED';
  static const String leadStageChanged = 'LEAD_STAGE_CHANGED';
  static const String leadConverted = 'LEAD_CONVERTED';
  static const String leadMarkedLost = 'LEAD_MARKED_LOST';
  static const String leadFollowUpScheduled = 'LEAD_FOLLOWUP_SCHEDULED';
  static const String leadUpdated = 'LEAD_UPDATED';

  // Reports
  static const String reportDeleted = 'REPORT_DELETED';
}

/// Activity timeline — vaqt bo'yicha saralangan event'lar.
class ActivityTimeline extends Equatable {
  final List<TimelineEvent> events;

  /// Total event count (paginatsiya uchun).
  final int totalCount;

  /// Eventlar to'plami yig'ildimi?
  final bool isComplete;

  const ActivityTimeline({
    required this.events,
    required this.totalCount,
    required this.isComplete,
  });

  /// Bo'sh timeline.
  const ActivityTimeline.empty()
      : events = const [],
        totalCount = 0,
        isComplete = true;

  /// Default — bo'sh timeline (snapshot yaratilganda).
  factory ActivityTimeline.partial(List<TimelineEvent> events) {
    return ActivityTimeline(
      events: List.unmodifiable(events),
      totalCount: events.length,
      isComplete: false,
    );
  }

  bool get hasAny => events.isNotEmpty;

  @override
  List<Object?> get props => [events, totalCount, isComplete];
}
