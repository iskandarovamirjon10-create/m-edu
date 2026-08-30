import 'package:flutter/foundation.dart' show debugPrint;

import '../../../../core/error/failures.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../../audit/domain/repositories/audit_repository.dart';
import '../../../attendance/application/services/attendance_statistics_service.dart';
import '../../../crm/domain/entities/lead_activity.dart';
import '../../../crm/domain/repositories/lead_repository.dart';
import '../../../identity/domain/repositories/identity_repository.dart';
import '../../../notifications/domain/entities/notification.dart' as notif;
import '../../../notifications/domain/repositories/notification_repository.dart';
import '../../../payments/domain/entities/debt.dart';
import '../../../payments/domain/entities/payment.dart';
import '../../../payments/domain/repositories/payment_repository.dart';
import '../../../scheduling/domain/entities/schedule.dart';
import '../../../scheduling/domain/repositories/schedule_repository.dart';
import '../../domain/entities/student.dart';
import '../../domain/repositories/student_repository.dart';
import '../../domain/student_360/academic_snapshot.dart';
import '../../domain/student_360/activity_timeline.dart';
import '../../domain/student_360/attendance_snapshot.dart';
import '../../domain/student_360/audit_snapshot.dart';
import '../../domain/student_360/communication_snapshot.dart';
import '../../domain/student_360/crm_snapshot.dart';
import '../../domain/student_360/family_snapshot.dart';
import '../../domain/student_360/financial_snapshot.dart';
import '../../domain/student_360/identity_snapshot.dart';
import '../../domain/student_360/schedule_snapshot.dart';
import '../../domain/student_360/student_360.dart';

/// Student 360 aggregator — barcha snapshot'larni bir aggregate'da
/// birlashtiruvchi service.
///
/// Domain qoidalari:
/// 1. Asosiy o'qishlar (Identity, Student) — XATO bo'lsa, [NotFoundFailure]
///    qaytaramiz (top-level error). Snapshot sub-modullardan xato
///    kelsa, graceful degradation (bo'sh snapshot).
/// 2. Snapshot sub-failure'lari [debugPrint] orqali log qilinadi
///    (release build'da yo'q). Aggregate BUILD bo'ladi (qisman snapshot
///    ham foydali).
/// 3. Faqat REAL repository'lardan o'qiladi. Hech qanday hardcoded
///    fallback, mock, yoki fabricate YO'Q.
///
/// XATO STRATEGIYASI:
/// - IdentityRepository.fetchByIdentityId → null → NotFoundFailure
/// - StudentRepository.fetchByIdentityId → null → NotFoundFailure
/// - Attendance xato → AttendanceSnapshot.unavailable()
/// - Payments xato → FinancialSnapshot.empty()
/// - CRM xato → CrmSnapshot.empty()
/// - Schedule xato → ScheduleSnapshot.empty()
/// - Notification xato → CommunicationSnapshot.empty()
/// - Audit xato → AuditSnapshot.empty()
class Student360Aggregator {
  static const int _maxNotificationHistory = 50;
  static const int _maxPaymentHistory = 200;
  static const int _maxLeadActivities = 50;
  static const int _maxRecentAudits = 5;

  final StudentRepository _studentRepository;
  final IdentityRepository _identityRepository;
  final AttendanceStatisticsService _attendanceStatisticsService;
  final PaymentRepository _paymentRepository;
  final LeadRepository _leadRepository;
  final ScheduleRepository _scheduleRepository;
  final NotificationRepository _notificationRepository;
  final AuditRepository _auditRepository;

  /// Vaqt manbai (test uchun inject qilinadi — production: DateTime.now()).
  /// `_safeSchedule` da `DateTime.now()` ishlatmaslik uchun (F11: non-deterministic).
  final DateTime Function() _now;

  Student360Aggregator({
    required StudentRepository studentRepository,
    required IdentityRepository identityRepository,
    required AttendanceStatisticsService attendanceStatisticsService,
    required PaymentRepository paymentRepository,
    required LeadRepository leadRepository,
    required ScheduleRepository scheduleRepository,
    required NotificationRepository notificationRepository,
    required AuditRepository auditRepository,
    DateTime Function()? now,
  })  : _studentRepository = studentRepository,
        _identityRepository = identityRepository,
        _attendanceStatisticsService = attendanceStatisticsService,
        _paymentRepository = paymentRepository,
        _leadRepository = leadRepository,
        _scheduleRepository = scheduleRepository,
        _notificationRepository = notificationRepository,
        _auditRepository = auditRepository,
        _now = now ?? DateTime.now;

  /// Berilgan identityId uchun Student 360 aggregate quradi.
  ///
  /// Throws [NotFoundFailure] agar student yoki identity topilmasa.
  /// Boshqa modullardan xato bo'lsa, qisman snapshot qaytadi
  /// (UI graceful ko'rsatadi).
  Future<Student360> aggregate(String identityId) async {
    // 1) Identity + Student — top-level, xato bo'lsa tashlaymiz.
    final identity = await _identityRepository.fetchByIdentityId(identityId);
    if (identity == null) {
      throw NotFoundFailure(
        "Shaxs topilmadi: $identityId",
      );
    }
    final student = await _studentRepository.fetchByIdentityId(identityId);
    if (student == null) {
      throw NotFoundFailure(
        "Talaba yozuvi topilmadi: $identityId",
      );
    }

    // 2) Snapshotlarni parallel o'qish — tezroq.
    // F4 fix: outer try-catch har bir sub-snapshot'ni o'rab olmaydi —
    // har bir sub-snapshot o'zining try-catch'iga ega. Parallel
    // bajarilish mustaqil (birining xatosi boshqasini to'xtatmaydi).
    final results = await Future.wait<Object>([
      _safeAttendance(student),
      _safeFinancial(identityId),
      _safeCrm(identityId),
      _safeCommunication(identityId, student),
      _safeSchedule(student),
      _safeTimeline(identityId),
      _safeAudit(identityId, student),
    ]);

    return Student360(
      identityId: identityId,
      student: student,
      identity: StudentIdentitySnapshot.fromIdentity(identity),
      family: FamilySnapshot(
        guardianName: student.parentName,
        guardianPhone: student.parentPhone,
        guardianTelegramId: student.parentTelegramId,
        hasLinkedIdentity: student.parentId != null &&
            student.parentId!.isNotEmpty,
      ),
      academic: AcademicSnapshot(
        currentGroupId: student.groupId,
        currentGroupName: student.groupName,
        academicYear: student.academicYear,
        studentStatus: student.studentStatus.name,
        pendingTransferToGroupId: student.transferToGroupId,
        transferStatus: student.transferStatus.name,
        enrolledAt: student.enrolledAt,
        assignedAt: student.assignedAt,
        completedAt: student.completedAt,
      ),
      attendance: results[0] as AttendanceSnapshot,
      financial: results[1] as FinancialSnapshot,
      crm: results[2] as CrmSnapshot,
      communication: results[3] as CommunicationSnapshot,
      schedule: results[4] as ScheduleSnapshot,
      timeline: results[5] as ActivityTimeline,
      audit: results[6] as AuditSnapshot,
      generatedAt: _now(),
    );
  }

  // ─── Snapshot sub-builders (graceful degradation) ────────────────

  Future<AttendanceSnapshot> _safeAttendance(Student student) async {
    try {
      final stats =
          await _attendanceStatisticsService.fetchForStudent(student);
      return AttendanceSnapshot(
        scheduledLessons: stats.scheduledLessons,
        presentLessons: stats.presentLessons,
        lateLessons: stats.lateLessons,
        excusedLessons: stats.excusedLessons,
        absentLessons: stats.absentLessons,
        isAvailable: true,
      );
    } catch (e, st) {
      _logSnapshotFailure('attendance', e, st);
      return const AttendanceSnapshot.unavailable();
    }
  }

  Future<FinancialSnapshot> _safeFinancial(String identityId) async {
    try {
      final payments = await _paymentRepository.fetchByStudentId(identityId);
      final debts = await _paymentRepository.fetchDebtsByStudentId(identityId);

      // F21 fix: faqat COMPLETED statusdagilarni SANASH — cancelled/refunded/
      // failed lar real to'lovga kirmaydi. `paidAmount` formula esa
      // discount+lateFee ni o'z ichiga oladi — bu SOTILGAN summa
      // (qabul qilingan reja), completed statusda.
      final completedPayments =
          payments.where((Payment p) => p.status == PaymentStatus.completed);
      final pendingPayments =
          payments.where((Payment p) => p.status == PaymentStatus.pending);

      // F8 fix: paymentHistory bounded — UI uchun 200 ta yetarli.
      // To'liq tarix uchun alohida page provider ishlatiladi.
      final paymentHistory = payments.length > _maxPaymentHistory
          ? payments.sublist(0, _maxPaymentHistory)
          : List<Payment>.unmodifiable(payments);

      final totalPaid =
          completedPayments.fold<int>(0, (s, p) => s + p.paidAmount);

      // Active debt = outstanding yoki partial.
      final activeDebts = debts
          .where((Debt d) =>
              d.status == DebtStatus.outstanding ||
              d.status == DebtStatus.partial)
          .toList();

      final outstandingDebt =
          activeDebts.fold<int>(0, (s, d) => s + d.remainingAmount);

      // F13 fix: now() injected — deterministik test.
      final now = _now();
      DateTime? lastPayment;
      for (final p in completedPayments) {
        if (lastPayment == null || p.paymentDate.isAfter(lastPayment)) {
          lastPayment = p.paymentDate;
        }
      }

      DateTime? nearestOverdue;
      for (final d in activeDebts) {
        if (now.isAfter(d.dueDate) &&
            (nearestOverdue == null || d.dueDate.isBefore(nearestOverdue))) {
          nearestOverdue = d.dueDate;
        }
      }

      return FinancialSnapshot(
        totalPaid: totalPaid,
        outstandingDebt: outstandingDebt,
        paymentCount: completedPayments.length,
        pendingPaymentCount: pendingPayments.length,
        lastPaymentDate: lastPayment,
        nearestOverdueAt: nearestOverdue,
        paymentHistory: paymentHistory,
        activeDebts: List<Debt>.unmodifiable(activeDebts),
      );
    } catch (e, st) {
      _logSnapshotFailure('financial', e, st);
      return const FinancialSnapshot.empty();
    }
  }

  Future<CrmSnapshot> _safeCrm(String identityId) async {
    try {
      // F1 fix: indexed lookup (`convertedToIdentityId` indexed) — N+1
      // (`fetchAll` + filter) o'rniga bitta query.
      // F2 fix: agar natija topilmasa — boshqa lead'lar bilan chalkashlik
      // yo'q (konvertatsiya 1:1, `LeadStage.converted` isFinal).
      final lead = await _leadRepository.fetchByConvertedIdentityId(
        identityId,
      );
      if (lead == null) {
        return const CrmSnapshot.empty();
      }

      // Lead activity'larni o'qish.
      final allActivities = await _leadRepository.fetchActivities(lead.leadId);

      // F3 fix: convertedAt ni `LeadActivityTypes.converted` activity
      // dan olamiz (haqiqiy konvertatsiya sanasi). Lead.updatedAt esa
      // har qanday update (notes, score) uchun o'zgaradi.
      DateTime? convertedAt;
      for (final activity in allActivities) {
        if (activity.type == LeadActivityTypes.converted) {
          if (convertedAt == null ||
              activity.occurredAt.isAfter(convertedAt)) {
            convertedAt = activity.occurredAt;
          }
        }
      }

      // F9 fix: lead activities bounded.
      final activities = allActivities.length > _maxLeadActivities
          ? allActivities.sublist(0, _maxLeadActivities)
          : List<LeadActivity>.unmodifiable(allActivities);

      return CrmSnapshot(
        hasLead: true,
        source: lead.source.name,
        capturedAt: lead.createdAt,
        convertedAt: convertedAt,
        responsibleModeratorId: lead.assignedToUserId,
        notes: lead.notes,
        score: lead.score,
        leadActivities: activities,
      );
    } catch (e, st) {
      _logSnapshotFailure('crm', e, st);
      return const CrmSnapshot.empty();
    }
  }

  Future<CommunicationSnapshot> _safeCommunication(
    String identityId,
    Student student,
  ) async {
    try {
      // F15 fix: student allaqachon `aggregate()` da o'qilgan —
      // qayta fetch qilmaymiz. Parametr sifatida qabul qilamiz.
      final chatId = student.parentTelegramId;
      final telegramLinked = chatId != null && chatId.isNotEmpty;

      // F16 fix: notification history bounded.
      List<notif.AppNotification> notifications = const [];
      try {
        final fetched =
            await _notificationRepository.fetchByTarget(identityId);
        notifications = fetched.length > _maxNotificationHistory
            ? fetched.sublist(0, _maxNotificationHistory)
            : List<notif.AppNotification>.unmodifiable(fetched);
      } catch (e, st) {
        _logSnapshotFailure('communication.notifications', e, st);
        notifications = const [];
      }

      return CommunicationSnapshot(
        telegramLinked: telegramLinked,
        telegramChatId: chatId,
        notificationHistory: notifications,
        smsHistory: const [],
        smsAvailable: false,
      );
    } catch (e, st) {
      _logSnapshotFailure('communication', e, st);
      return const CommunicationSnapshot.empty();
    }
  }

  Future<ScheduleSnapshot> _safeSchedule(Student student) async {
    try {
      if (student.groupId == null) {
        return const ScheduleSnapshot(
          todayLessons: [],
          upcomingLessons: [],
          groupId: null,
          isAvailable: true,
        );
      }
      final all = await _scheduleRepository.fetchByGroupId(student.groupId!);
      // F11 fix: now() injected — deterministik.
      final today = _now();
      final todayDow = _dayOfWeekFromDate(today);

      final todayLessons = all
          .where((Schedule s) => s.dayOfWeek == todayDow)
          .toList();

      final upcomingLessons = all
          .where((Schedule s) => s.dayOfWeek != todayDow)
          .toList();

      return ScheduleSnapshot(
        todayLessons: List<Schedule>.unmodifiable(todayLessons),
        upcomingLessons: List<Schedule>.unmodifiable(upcomingLessons),
        groupId: student.groupId,
        isAvailable: true,
      );
    } catch (e, st) {
      _logSnapshotFailure('schedule', e, st);
      return const ScheduleSnapshot.empty();
    }
  }

  Future<ActivityTimeline> _safeTimeline(String identityId) async {
    try {
      final events = <TimelineEvent>[];

      // 1) IdentityActivity (identity timeline).
      final identityActivities =
          await _identityRepository.fetchActivities(identityId);
      for (final a in identityActivities) {
        events.add(TimelineEvent(
          id: 'identity-activity-${a.occurredAt.microsecondsSinceEpoch}',
          type: a.type,
          description: a.description,
          occurredAt: a.occurredAt,
          source: 'identity',
        ));
      }

      // 2) Audit log (cross-module). F18 fix: id-based deduplication.
      // Set ga solinib, takrorlanish oldini olamiz.
      final seenIds = <String>{
        for (final e in events) e.id,
      };

      Future<void> addAuditEvents(String targetType) async {
        try {
          final auditEntries =
              await _auditRepository.fetchByTarget(targetType, identityId);
          for (final entry in auditEntries) {
            final id = 'audit-${entry.auditId}';
            if (!seenIds.add(id)) continue; // dedup
            events.add(TimelineEvent(
              id: id,
              type: entry.action.name,
              description: entry.actionLabel,
              occurredAt: entry.occurredAt,
              source: 'audit',
            ));
          }
        } catch (e, st) {
          _logSnapshotFailure('timeline.audit.$targetType', e, st);
        }
      }

      await addAuditEvents('student');
      await addAuditEvents('identity');

      // Vaqt bo'yicha kamayish tartibida saralash.
      events.sort((a, b) => b.occurredAt.compareTo(a.occurredAt));

      return ActivityTimeline.partial(List.unmodifiable(events));
    } catch (e, st) {
      _logSnapshotFailure('timeline', e, st);
      return const ActivityTimeline.empty();
    }
  }

  Future<AuditSnapshot> _safeAudit(String identityId, Student student) async {
    try {
      // F12 fix: payment audit'larni HEMMA student uchun global ravishda
      // qaytarmaymiz — faqat shu student'ga tegishli paymentlarni filter
      // qilamiz. Buning uchun avval payment ID'larni olish, keyin
      // audit'larni targeted query qilamiz.
      final studentAudits =
          await _auditRepository.fetchByTarget('student', identityId);
      final identityAudits =
          await _auditRepository.fetchByTarget('identity', identityId);

      // Student'ning payment ID'larini olish — faqat shu student'ga tegishli
      // payment audit'larini olish uchun.
      final payments = await _paymentRepository.fetchByStudentId(identityId);
      final paymentIds = payments.map((p) => p.paymentId).toSet();

      // Payment audit'larini olib, faqat shu student'ga tegishlilarini saqlaymiz.
      // Eslatma: `fetchByTarget` indexed query — N ta payment uchun N ta query.
      // Bu trade-off: payment'lar soni odatda kichik (10-100/student), shuning
      // uchun bu safe. Parallel fetch.
      final paymentAuditLists = await Future.wait(
        paymentIds.map(
          (pid) => _auditRepository.fetchByTarget('payment', pid),
        ),
      );
      final paymentAudits = paymentAuditLists.expand((x) => x).toList();

      final allAudits = <AuditLogEntry>[
        ...studentAudits,
        ...identityAudits,
        ...paymentAudits,
      ];

      // F18 fix: id-based dedup.
      final unique = <String, AuditLogEntry>{};
      for (final a in allAudits) {
        unique.putIfAbsent(a.auditId, () => a);
      }
      final dedupedAudits = unique.values.toList();

      dedupedAudits.sort((a, b) => b.occurredAt.compareTo(a.occurredAt));

      DateTime? oldest;
      DateTime? newest;
      if (dedupedAudits.isNotEmpty) {
        newest = dedupedAudits.first.occurredAt;
        oldest = dedupedAudits.last.occurredAt;
      }

      final recent = dedupedAudits.take(_maxRecentAudits).toList();

      return AuditSnapshot(
        entries: List<AuditLogEntry>.unmodifiable(dedupedAudits),
        recentEntries: List<AuditLogEntry>.unmodifiable(recent),
        oldestAt: oldest,
        newestAt: newest,
      );
    } catch (e, st) {
      _logSnapshotFailure('audit', e, st);
      return const AuditSnapshot.empty();
    }
  }

  /// Snapshot sub-failure log. Release build'da yo'q.
  void _logSnapshotFailure(String snapshot, Object e, StackTrace st) {
    debugPrint('Student360Aggregator: $snapshot snapshot failed: $e');
    if (const bool.fromEnvironment('VERBOSE_LOG', defaultValue: false)) {
      debugPrint('Stack trace: $st');
    }
  }

  /// DateTime → DayOfWeek konvertatsiya.
  ///
  /// DateTime.weekday: 1=Monday .. 7=Sunday — Schedule.domain
  /// DayOfWeek enum'i bilan mos.
  static DayOfWeek dayOfWeekFromDate(DateTime date) {
    switch (date.weekday) {
      case DateTime.monday:
        return DayOfWeek.monday;
      case DateTime.tuesday:
        return DayOfWeek.tuesday;
      case DateTime.wednesday:
        return DayOfWeek.wednesday;
      case DateTime.thursday:
        return DayOfWeek.thursday;
      case DateTime.friday:
        return DayOfWeek.friday;
      case DateTime.saturday:
        return DayOfWeek.saturday;
      case DateTime.sunday:
        return DayOfWeek.sunday;
      default:
        return DayOfWeek.monday;
    }
  }

  /// Backwards-compatible private alias.
  DayOfWeek _dayOfWeekFromDate(DateTime date) => dayOfWeekFromDate(date);
}
