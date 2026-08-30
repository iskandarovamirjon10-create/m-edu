import '../../../../core/event_bus/event_bus.dart';
import '../../../scheduling/domain/entities/lesson_instance.dart';
import '../../domain/entities/attendance_session.dart';
import '../../domain/events/attendance_events.dart';
import '../../domain/repositories/attendance_session_repository.dart';

/// Attendance session'larini boshqaruvchi xizmat (P1.5).
///
/// Faol dars aniqlanganda [openForLesson] sessiyani ochadi (yoki mavjudini
/// qaytaradi — duplicate bo'lmaydi). Dars tugagach [closeByLesson] bilan
/// yopiladi. Sessiya Isar'da saqlanadi: restartdan keyin tiklanadi,
/// offline ishlaydi.
class AttendanceSessionService {
  final AttendanceSessionRepository _repository;
  final EventBus _eventBus;

  AttendanceSessionService({
    required AttendanceSessionRepository repository,
    required EventBus eventBus,
  })  : _repository = repository,
        _eventBus = eventBus;

  /// Dars uchun sessiyani ochadi/hozirlaydi (idempotent).
  ///
  /// - Birinchi ochilish: yangi sessiya + `AttendanceSessionOpenedEvent`
  ///   (event faqat HAQIQIY yaratilishda chiqadi — `createIfAbsent` atomic,
  ///   parallel ochilishda duplicate event bo'lmaydi).
  /// - Mavjud: holat o'zgarsa yangilanadi, duplicate YARATILMAYDI.
  Future<AttendanceSession> openForLesson(
    LessonInstance lesson,
    DateTime now,
  ) async {
    final status = _statusFor(lesson, now);

    // Atomic create-or-null: yaratish bilan event chiqarish bir-biriga
    // race bo'lmaydi (DB darajasida writeTxn ichida himoyalangan).
    final session = AttendanceSession(
      sessionId: 'SESSION-${lesson.lessonId}',
      lessonId: lesson.lessonId,
      groupId: lesson.groupId,
      openedAt: now,
      status: status,
      closedAt: status == AttendanceSessionStatus.completed ? now : null,
    );
    final created = await _repository.createIfAbsent(session);
    if (created != null) {
      _eventBus.publish(AttendanceSessionOpenedEvent(
        session: created,
        occurredAt: now,
      ));
      return created;
    }

    // Mavjud sessiya: holat o'zgargan bo'lsa yangilaymiz (idempotent).
    final existing = await _repository.fetchByLesson(lesson.lessonId);
    if (existing != null && existing.status != status) {
      return _repository.upsert(
        existing.copyWith(
          status: status,
          closedAt: status == AttendanceSessionStatus.completed ? now : null,
        ),
      );
    }
    return existing ?? session;
  }

  /// Dars sessiyasini yopadi (completed + closedAt).
  Future<AttendanceSession?> closeByLesson(
    String lessonId,
    DateTime closedAt,
  ) =>
      _repository.closeByLesson(lessonId, closedAt);

  /// Hozirgi vaqtga mos sessiya holati.
  ///
  /// - Dars sanasi kelajakda → notStarted.
  /// - Dars sanasi o'tgan → completed.
  /// - Dars boshlanishidan oldin → notStarted.
  /// - Dars vaqtida → active.
  /// - Dars tugaganidan keyin → completed.
  AttendanceSessionStatus _statusFor(
    LessonInstance lesson,
    DateTime now,
  ) {
    // Sana tekshiruvi: faqat vaqt oralig'ini solishtirish boshqa kundagi
    // darsga noto'g'ri holat berishi mumkin (review P1.5 #3).
    final lessonDay = DateTime(
      lesson.date.year,
      lesson.date.month,
      lesson.date.day,
    );
    final today = DateTime(now.year, now.month, now.day);
    if (lessonDay.isBefore(today)) return AttendanceSessionStatus.completed;
    if (lessonDay.isAfter(today)) return AttendanceSessionStatus.notStarted;

    final nowMinutes = now.hour * 60 + now.minute;
    final start = _toMinutes(lesson.startTime);
    final end = _toMinutes(lesson.endTime);
    if (nowMinutes < start) return AttendanceSessionStatus.notStarted;
    if (nowMinutes >= end) return AttendanceSessionStatus.completed;
    return AttendanceSessionStatus.active;
  }

  static int _toMinutes(String time) {
    final parts = time.split(':');
    return int.parse(parts[0]) * 60 + int.parse(parts[1]);
  }
}
