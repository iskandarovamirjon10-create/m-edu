import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/di/core_providers.dart';
import '../core/event_bus/event_bus.dart';
import '../core/event_bus/event_projector.dart';
import '../features/attendance/domain/events/attendance_events.dart';
import '../features/attendance/presentation/providers/attendance_providers.dart';
import '../features/crm/domain/events/lead_events.dart';
import '../features/crm/presentation/providers/lead_providers.dart';
import '../features/attendance/presentation/providers/attendance_statistics_providers.dart';
import '../features/audit/presentation/providers/audit_providers.dart';
import '../features/grades/domain/events/grade_events.dart';
import '../features/grades/presentation/providers/grade_providers.dart';
import '../features/groups/domain/events/group_events.dart';
import '../features/groups/presentation/providers/group_providers.dart';
import '../features/identity/domain/events/identity_events.dart';
import '../features/identity/presentation/providers/identity_providers.dart';
import '../features/notifications/domain/events/notification_events.dart';
import '../features/notifications/presentation/providers/notification_providers.dart';
import '../features/organization/domain/events/organization_events.dart';
import '../features/organization/presentation/providers/organization_providers.dart';
import '../features/payments/domain/events/payment_events.dart';
import '../features/payments/presentation/providers/payment_providers.dart';
import '../features/scheduling/domain/events/schedule_events.dart';
import '../features/scheduling/presentation/providers/schedule_providers.dart';
import '../features/settings/domain/entities/app_settings.dart';
import '../features/students/application/commands/register_student_command.dart';
import '../features/students/application/services/student_enrollment_projector.dart';
import '../features/students/application/services/student_payment_projector.dart';
import '../features/students/domain/events/student_events.dart';
import '../features/students/presentation/providers/student_providers.dart';
import '../features/teachers/application/commands/register_teacher_command.dart';
import '../features/teachers/application/services/teacher_enrollment_projector.dart';
import '../features/teachers/domain/events/teacher_events.dart';
import '../features/teachers/presentation/providers/teacher_providers.dart';

/// C-03: Domain Event → Riverpod state sinxronizatsiya ko'prigi.
///
/// MUAMMO (audit): Command'lar `EventBus`'ga event tarqatardi, lekin
/// production'da hech kim quloq solmasdi — UI'lar qo'lda `state++`
/// bilan yangilanardi. Buning oqibatida cross-module consistency
/// buzilardi: to'lov qabul qilinsa `studentList`, dashboard va hisobotlar
/// stale qolardi; guruh/jadval/xona yaratilsa ro'yxatlar yangilanmasdi.
///
/// YECHIM: Yagona ko'prik barcha domain eventlarni eshitib, o'ziga
/// tegishli Riverpod version providerlarini oshiradi. Version
/// providerlarini watch qilgan har bir FutureProvider o'z ma'lumotini
/// qayta so'raydi — hech qanday qo'lda refresh talab qilinmaydi (§55, §79).
///
/// QAYERDA YASHAYDI: `lib/app/` — kompozitsiya ildizi (composition root).
/// `main.dart` dagi `MEduApp.build` da watch qilinadi va ilova hayoti
/// davomida yashaydi. Xuddi `main.dart` kabi feature'lararo ulanishni
/// boshqaradi (Dependency Rule istisnosi — faqat ulanish nuqtasi).
final eventSyncProvider = Provider<EventSyncCoordinator>((ref) {
  final coordinator = EventSyncCoordinator(
    bus: ref.watch(eventBusProvider),
    ref: ref,
  );
  coordinator.start();
  ref.onDispose(coordinator.dispose);
  return coordinator;
});

/// Event → version ko'prigi va proyeksiyalarni boshqaruvchi.
class EventSyncCoordinator {
  final EventBus _bus;
  final Ref _ref;
  final List<StreamSubscription<dynamic>> _subscriptions = [];
  final List<EventProjector> _projectors = [];

  EventSyncCoordinator({required EventBus bus, required Ref ref})
      : _bus = bus,
        _ref = ref;

  void start() {
    // ── Read-model proyeksiyalari ───────────────────────────────────────
    // Identity → Student/Teacher (C-02) va Payment → Student (C-03).
    //
    // CRITICAL regression: Proyeksiyalar app ishga tushganda (splash, hali
    // login qilinmagan) quriladi. `registerStudentCommandProvider` o'sha
    // paytda `actorRoleProvider` → `unknown` ni yopib olgan edi — Riverpod
    // Provider cached bo'lgani uchun keyin login qilinganda ham yangilanmasdi.
    // Oqibat: Identity'dan o'tgan HAR QANDAY o'quvchi/o'qituvchi proyeksiya
    // command'ida `Permissions.require(unknown, ...)` bilan yiqilib, ro'yxat
    // va dashboard doim bo'sh qolardi.
    //
    // YECHIM: proyeksiya — foydalanuvchi amali EMAS, tizim ichki operatsiyasi
    // (foydalanuvchi amali Identity registratsiyasida allaqachon RBAC'dan
    // o'tgan). Shuning uchun proyeksiya command'lari `superAdmin` rol bilan
    // quriladi — roldan mustaqil, doim ishlaydi.
    _projectors.addAll([
      StudentEnrollmentProjector(
        registerStudentCommand: RegisterStudentCommand(
          repository: _ref.read(studentRepositoryProvider),
          identityRepository: _ref.read(identityRepositoryProvider),
          eventBus: _bus,
          auditService: _ref.read(auditServiceProvider),
          actorRole: UserRole.superAdmin,
        ),
        identityRepository: _ref.read(identityRepositoryProvider),
        eventBus: _bus,
      ),
      TeacherEnrollmentProjector(
        registerTeacherCommand: RegisterTeacherCommand(
          repository: _ref.read(teacherRepositoryProvider),
          identityRepository: _ref.read(identityRepositoryProvider),
          eventBus: _bus,
          actorRole: UserRole.superAdmin,
        ),
        identityRepository: _ref.read(identityRepositoryProvider),
        eventBus: _bus,
      ),
      StudentPaymentProjector(
        studentRepository: _ref.read(studentRepositoryProvider),
        eventBus: _bus,
      ),
    ]);

    void bump(StateProvider<int> version) {
      _ref.read(version.notifier).state++;
    }

    // ── Identity ────────────────────────────────────────────────────────
    _on<IdentityRegisteredEvent>((_) => bump(identityListVersionProvider));
    _on<IdentityStatusChangedEvent>((_) => bump(identityListVersionProvider));
    _on<IdentityMergedEvent>((_) {
      bump(identityListVersionProvider);
      bump(studentListVersionProvider);
    });

    // ── Students ────────────────────────────────────────────────────────
    _on<StudentRegisteredEvent>((_) => bump(studentListVersionProvider));
    _on<StudentUpdatedEvent>((_) => bump(studentListVersionProvider));
    _on<StudentStatusChangedEvent>((_) => bump(studentListVersionProvider));
    _on<StudentDeletedEvent>((_) {
      // O'chirilgan talaba barcha ro'yxatlardan yo'qoladi.
      bump(studentListVersionProvider);
      bump(identityListVersionProvider);
      bump(groupListVersionProvider);
    });
    _on<StudentTransferredEvent>((_) {
      bump(studentListVersionProvider);
      bump(groupListVersionProvider);
    });

    // ── Attendance ──────────────────────────────────────────────────────
    // Phase 5: faqat affected student'ning stats'i invalidatsiya qilinadi
    // (targeted invalidation) — butun jadval qayta hisoblanmaydi (user
    // talabi). attendanceVersion esa ro'yxatlar (bugungi davomat) uchun.
    _on<AttendanceMarkedEvent>((event) {
      bump(attendanceVersionProvider);
      _ref.invalidate(studentAttendanceStatsProvider(event.identityId));
    });
    // P1.5: sessiya ochilganda sessiya state'larini yangilaydi.
    _on<AttendanceSessionOpenedEvent>(
      (_) => bump(attendanceSessionVersionProvider),
    );
    _on<AttendanceStatusChangedEvent>((event) {
      bump(attendanceVersionProvider);
      _ref.invalidate(studentAttendanceStatsProvider(event.identityId));
    });

    // ── Payments / Finance ──────────────────────────────────────────────
    _on<PaymentReceivedEvent>((_) {
      bump(paymentListVersionProvider);
      bump(studentListVersionProvider);
    });
    _on<DebtCreatedEvent>((_) => bump(paymentListVersionProvider));
    _on<ExpenseCreatedEvent>((_) => bump(paymentListVersionProvider));

    // ── Grades (baholar) ───────────────────────────────────────────────
    _on<GradeAddedEvent>((_) => bump(gradeListVersionProvider));
    _on<GradeDeletedEvent>((_) => bump(gradeListVersionProvider));

    // ── Groups ──────────────────────────────────────────────────────────
    // Guruh tahrirlangan/a'zo o'zgarganda guruh VA talaba ro'yxatlari
    // yangilanadi (a'zolarning groupName/groupId denormalizatsiyasi).
    _on<GroupCreatedEvent>((_) => bump(groupListVersionProvider));
    _on<GroupUpdatedEvent>((_) {
      bump(groupListVersionProvider);
      bump(studentListVersionProvider);
    });
    _on<GroupMemberAddedEvent>((_) {
      bump(groupListVersionProvider);
      bump(studentListVersionProvider);
    });
    _on<GroupMemberRemovedEvent>((_) {
      bump(groupListVersionProvider);
      bump(studentListVersionProvider);
    });

    // ── Teachers ────────────────────────────────────────────────────────
    _on<TeacherRegisteredEvent>((_) {
      bump(teacherListVersionProvider);
      bump(identityListVersionProvider);
    });
    _on<TeacherStatusChangedEvent>((_) => bump(teacherListVersionProvider));
    _on<TeacherDeletedEvent>((_) {
      // O'chirilgan o'qituvchi barcha ro'yxatlardan yo'qoladi.
      bump(teacherListVersionProvider);
      bump(identityListVersionProvider);
      bump(groupListVersionProvider);
    });
    _on<TeacherAssignedToGroupEvent>((_) {
      bump(teacherListVersionProvider);
      bump(groupListVersionProvider);
    });

    // ── Schedule / Rooms ────────────────────────────────────────────────
    _on<ScheduleCreatedEvent>((_) => bump(scheduleListVersionProvider));
    _on<RoomCreatedEvent>((_) => bump(scheduleListVersionProvider));

    // ── Notifications ───────────────────────────────────────────────────
    _on<NotificationCreatedEvent>((_) => bump(notificationListVersionProvider));
    _on<PaymentReminderSentEvent>((_) {
      bump(notificationListVersionProvider);
      bump(paymentListVersionProvider);
    });

    // ── Organization ────────────────────────────────────────────────────
    _on<OrganizationSetupCompletedEvent>(
      (_) => bump(organizationSetupVersionProvider),
    );

    // ── CRM (Lead Pipeline) ─────────────────────────────────────────────
    // Barcha lead event'lar Kanban/list versiyasini oshiradi; konvertatsiya
    // identity+student ro'yxatlarini ham yangilaydi (student yaratildi).
    _on<LeadCapturedEvent>((_) => bump(leadListVersionProvider));
    _on<LeadStageChangedEvent>((_) => bump(leadListVersionProvider));
    _on<LeadLostEvent>((_) => bump(leadListVersionProvider));
    _on<LeadFollowUpScheduledEvent>((_) => bump(leadListVersionProvider));
    _on<LeadUpdatedEvent>((_) => bump(leadListVersionProvider));
    _on<LeadConvertedEvent>((_) {
      bump(leadListVersionProvider);
      bump(identityListVersionProvider);
      bump(studentListVersionProvider);
    });
  }

  void _on<T extends DomainEvent>(void Function(T event) handler) {
    _subscriptions.add(_bus.on<T>().listen(handler));
  }

  void dispose() {
    for (final subscription in _subscriptions) {
      subscription.cancel();
    }
    for (final projector in _projectors) {
      projector.dispose();
    }
  }
}
