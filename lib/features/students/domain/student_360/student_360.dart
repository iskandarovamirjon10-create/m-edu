import 'package:equatable/equatable.dart';

import '../../../students/domain/entities/student.dart';
import 'academic_snapshot.dart';
import 'activity_timeline.dart';
import 'attendance_snapshot.dart';
import 'audit_snapshot.dart';
import 'communication_snapshot.dart';
import 'crm_snapshot.dart';
import 'family_snapshot.dart';
import 'financial_snapshot.dart';
import 'identity_snapshot.dart';
import 'schedule_snapshot.dart';

/// Student 360 — talaba haqida TO'LIQ ko'rinish.
///
/// Composed aggregate: har bir snapshot alohida domain'dan o'qiladi,
/// shu aggregate esa ularni birlashtirib UI ga yagona model qaytaradi.
///
/// ARXITEKTURA QOIDALARI:
/// - Immutable (Equatable, barcha snapshot'lar immutable).
/// - Domain composition — NOT a single 100-field class.
/// - Snapshot'lar MUSTAQIL: ulardan biri xato qaytarsa, boshqalari
///   o'qiladi (graceful degradation — UNVERIFIED marker snapshot
///   ichida, aggregate'da emas).
/// - `buildStudent360` factory service'da (ilova qatlamida) yashaydi;
///   bu yerda faqat composition.
///
/// SNAPSHOT'LAR:
/// - [StudentIdentitySnapshot] — Identity agregatining minimal ko'rinishi.
/// - [FamilySnapshot] — ota-ona/vasiy ma'lumotlari (Student'dan denormalized).
/// - [AcademicSnapshot] — guruh, status, transfer.
/// - [AttendanceSnapshot] — AttendanceStatisticsService dan olingan tayyor aggregate.
/// - [FinancialSnapshot] — Payment/Debt repository dan olingan tayyor aggregate.
/// - [CrmSnapshot] — Lead entity (agar convertedToIdentityId == identityId bo'lsa).
/// - [CommunicationSnapshot] — Telegram bog'lanishi, notification tarixi.
/// - [ScheduleSnapshot] — bugungi va yaqin darslar.
/// - [ActivityTimeline] — IdentityActivity + AuditLog birlashtirilgan timeline.
/// - [AuditSnapshot] — student/identity/payment target'lariga tegishli audit'lar.
///
/// O'QUVCHI: `Student` aggregate'ning to'liq entity'si. Bu UI
/// ko'rsatish uchun AYNAN kerak bo'lishi mumkin (guruh o'tkazish
/// imkoniyati va h.k.).
class Student360 extends Equatable {
  final String identityId;

  /// Asosiy student entity (to'liq).
  final Student student;

  final StudentIdentitySnapshot identity;
  final FamilySnapshot family;
  final AcademicSnapshot academic;
  final AttendanceSnapshot attendance;
  final FinancialSnapshot financial;
  final CrmSnapshot crm;
  final CommunicationSnapshot communication;
  final ScheduleSnapshot schedule;
  final ActivityTimeline timeline;
  final AuditSnapshot audit;

  /// Snapshot yaratilgan vaqt (cache invalidation uchun).
  final DateTime generatedAt;

  const Student360({
    required this.identityId,
    required this.student,
    required this.identity,
    required this.family,
    required this.academic,
    required this.attendance,
    required this.financial,
    required this.crm,
    required this.communication,
    required this.schedule,
    required this.timeline,
    required this.audit,
    required this.generatedAt,
  });

  bool get isActive => academic.isActive;
  bool get hasAttendanceData => attendance.isAvailable;
  bool get hasFinancialData => financial.hasAnyPayment || financial.hasDebt;
  bool get hasCrm => crm.hasLead;
  bool get hasTelegramLink => communication.telegramLinked;
  bool get hasGroup => academic.hasGroup;
  bool get hasAuditTrail => audit.hasAny;

  @override
  List<Object?> get props => [
        identityId,
        student,
        identity,
        family,
        academic,
        attendance,
        financial,
        crm,
        communication,
        schedule,
        timeline,
        audit,
        generatedAt,
      ];
}
