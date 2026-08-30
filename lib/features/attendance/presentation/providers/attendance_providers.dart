import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../../features/auth/presentation/providers/auth_providers.dart';
import '../../../../features/identity/presentation/providers/identity_providers.dart';
import '../../../../features/audit/presentation/providers/audit_providers.dart';
import '../../../../features/scheduling/application/services/lesson_instance_service.dart';
import '../../../../features/scheduling/domain/entities/lesson_instance.dart';
import '../../../../features/scheduling/presentation/providers/schedule_providers.dart';
import '../../application/commands/mark_attendance_status_command.dart';
import '../../application/commands/record_attendance_command.dart';
import '../../application/queries/attendance_queries.dart';
import '../../application/services/attendance_activity_recorder.dart';
import '../../application/services/attendance_session_service.dart';
import '../../domain/entities/attendance_entry.dart';
import '../../domain/entities/attendance_session.dart';
import '../../domain/repositories/attendance_repository.dart';
import '../../domain/repositories/attendance_session_repository.dart';
import '../../infrastructure/datasources/isar_attendance_datasource.dart';
import '../../infrastructure/datasources/isar_attendance_session_datasource.dart';
import '../../infrastructure/repositories_impl/attendance_repository_impl.dart';
import '../../infrastructure/repositories_impl/attendance_session_repository_impl.dart';

final attendanceRepositoryProvider = Provider<AttendanceRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return AttendanceRepositoryImpl(IsarAttendanceDataSource(db.instance));
});

final attendanceQueriesProvider = Provider<AttendanceQueries>(
  (ref) => AttendanceQueries(repository: ref.watch(attendanceRepositoryProvider)),
);

final recordAttendanceCommandProvider = Provider<RecordAttendanceCommand>(
  (ref) => RecordAttendanceCommand(
    repository: ref.watch(attendanceRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Davomat holatini belgilash/tahrirlash command'i (spec §21-24).
final markAttendanceStatusCommandProvider =
    Provider<MarkAttendanceStatusCommand>((ref) {
  final user = ref.watch(currentUserProvider);
  return MarkAttendanceStatusCommand(
    repository: ref.watch(attendanceRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    auditService: ref.watch(auditServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
    actorUserId: user?.userId,
    actorName: user?.name,
  );
});

/// Davomat belgilashda Identity audit-log'ga yozadigan xizmat.
final attendanceActivityRecorderProvider =
    Provider<AttendanceActivityRecorder>(
  (ref) => AttendanceActivityRecorder(
    identityRepository: ref.watch(identityRepositoryProvider),
  ),
);

/// Yozuvlarni yangilash uchun versiya hisoblagichi.
final attendanceVersionProvider = StateProvider<int>((ref) => 0);

/// Sessiya holati o'zgarganda versiya hisoblagichi (P1.5).
final attendanceSessionVersionProvider = StateProvider<int>((ref) => 0);

/// Attendance session repository provider (P1.5).
final attendanceSessionRepositoryProvider =
    Provider<AttendanceSessionRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return AttendanceSessionRepositoryImpl(
    IsarAttendanceSessionDataSource(db.instance),
  );
});

/// Sessiya xizmati (ochish/yopish, event tarqatish).
final attendanceSessionServiceProvider = Provider<AttendanceSessionService>(
  (ref) => AttendanceSessionService(
    repository: ref.watch(attendanceSessionRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
  ),
);

/// Hozirgi faol dars uchun ATTENDANCE SESSION (P1.5).
///
/// Faol dars bor bo'lsa sessiyani ochadi/hozirlaydi (duplicate bo'lmaydi,
/// restartdan keyin Isar'dan tiklanadi). Faol dars yo'q bo'lsa — null.
///
/// Sessiya holati real repository'dan keladi: loading/empty/error/success
/// — [activeLessonProvider] va [attendanceSessionServiceProvider] orqali.
final attendanceSessionProvider = FutureProvider<AttendanceSession?>((ref) {
  ref.watch(attendanceSessionVersionProvider);
  ref.watch(attendanceVersionProvider);
  ref.watch(scheduleListVersionProvider);
  return _openSessionForActiveLesson(ref);
});

Future<AttendanceSession?> _openSessionForActiveLesson(Ref ref) async {
  final lesson = await ref.watch(activeLessonProvider.future);
  if (lesson == null) return null;
  return ref
      .watch(attendanceSessionServiceProvider)
      .openForLesson(lesson, DateTime.now());
}

/// Bugungi davomat ro'yxati (dashboard/legacy kundalik ko'rinish).
final todayAttendanceProvider = FutureProvider<List<AttendanceEntry>>((ref) {
  ref.watch(attendanceVersionProvider);
  return ref.watch(attendanceQueriesProvider).fetchToday();
});

/// Bugungi statistika.
final todayAttendanceStatsProvider = FutureProvider<AttendanceStats>((ref) {
  ref.watch(attendanceVersionProvider);
  return ref.watch(attendanceQueriesProvider).fetchTodayStats();
});

/// Sana oralig'idagi davomat yozuvlari (Tarix — SCREEN 21).
final attendanceBetweenProvider =
    FutureProvider.family<List<AttendanceEntry>, ({DateTime from, DateTime to})>(
        (ref, range) {
  ref.watch(attendanceVersionProvider);
  return ref
      .watch(attendanceQueriesProvider)
      .fetchBetween(range.from, range.to);
});

/// Lesson Detail → Attendance Marking uchun TANLANGAN dars konteksti.
///
/// Attendance sahifasi odatda `activeLessonProvider` bilan ishlaydi (faol
/// dars). Lesson Detail'dagi "Davomat belgilash" tugmasi esa o'sha darsni
/// oldindan tanlab ochadi — hatto dars hozir faol bo'lmasa ham (o'tgan/
/// kelajak dars). Face oqimi ham shu kontekstni ishlatadi.
final selectedMarkingLessonProvider =
    StateProvider<LessonInstance?>((ref) => null);

/// Dashboard ogohlantirishi uchun: 24 soatdan KO'P kutib qolgan, hali
/// davomat belgilanmagan darslar soni (spec: "Kutilmoqda holatidagi dars
/// 24 soatdan ko'p qolsa, Dashboard ogohlantirishiga chiqadi").
///
/// Xatolik/yuklanmagan holatda 0 qaytaradi — Alert Center hech qachon
/// yolg'on ogohlantirish yoki blok ko'rsatmaydi (xato alert emas).
final pendingAttendanceCountProvider = FutureProvider<int>((ref) async {
  try {
    final schedules = await ref.watch(scheduleListProvider.future);
    if (schedules.isEmpty) return 0;

    final now = DateTime.now();
    final start = now.subtract(const Duration(days: 3));
    final entries = await ref
        .watch(attendanceQueriesProvider)
        .fetchBetween(start, now);
    final markedLessonIds =
        entries.where((e) => e.lessonId != null).map((e) => e.lessonId).toSet();

    var pending = 0;
    for (final schedule in schedules) {
      // So'nggi 3 kundagi dars instansiyalari (deterministik lessonId).
      for (var offset = 0; offset < 3; offset++) {
        final day = now.subtract(Duration(days: offset));
        if (!LessonInstanceService.coversDate(schedule, day)) continue;
        final instance = LessonInstanceService.instanceFor(schedule, day);
        if (instance == null) continue;
        if (markedLessonIds.contains(instance.lessonId)) continue;
        // Dars tugagan vaqt (kun + endTime).
        final end = _minutesToTime(instance.endTime);
        final lessonEnd = DateTime(
          day.year,
          day.month,
          day.day,
          end.$1,
          end.$2,
        );
        if (now.difference(lessonEnd).inHours > 24) pending++;
      }
    }
    return pending;
  } catch (_) {
    // Ma'lumot manbasi mavjud emas (test/offline) — alert ko'rsatilmaydi.
    return 0;
  }
});

(int, int) _minutesToTime(String time) {
  final parts = time.split(':');
  return (int.parse(parts[0]), int.parse(parts[1]));
}

/// Hozir FAOL dars — REAL jadvaldan (LessonInstanceService.activeLesson).
///
/// P1: Attendance sahifasi, Face, QR va Manual — hammasi shu yagona
/// kontekstdan ishlaydi. Qiymat real repository (schedule list)dan keladi:
///
/// - `loading` — jadval hali yuklanmoqda (real repo state).
/// - `error` — jadval so'rovida xato (real repo state).
/// - `data == null` — bugun hozir faol dars yo'q → "Hozir faol dars yo'q"
///   empty state (hech qanday fake/fallback yo'q).
/// - `data != null` — faol dars konteksti (`lessonId` majburiy o'tadi).
///
/// Jadval o'zgarganda (scheduleListVersionProvider) avtomatik qayta
/// hisoblanadi — restartdan keyin ham real DB'dan tiklangan jadvalga
/// ko'ra ishlaydi (P1 #12).
final activeLessonProvider = FutureProvider<LessonInstance?>((ref) {
  ref.watch(scheduleListVersionProvider);
  final schedulesFuture = ref.watch(scheduleListProvider.future);
  return schedulesFuture.then(
    (schedules) => LessonInstanceService.activeLesson(
      schedules,
      DateTime.now(),
    ),
  );
});

/// Bitta dars (lesson instance) bo'yicha davomat yozuvlari — V3 (P1).
///
/// [activeLessonProvider] bilan birga ishlatiladi: faol dars kontekstidagi
/// ro'yxat aynan shu darsning yozuvlaridan iborat (kundalik emas).
/// `attendanceVersionProvider` watch qilinadi — belgilash/status o'zgarishi
/// event orqali kelganda ro'yxat avtomatik yangilanadi (C-03).
final lessonAttendanceProvider =
    FutureProvider.family<List<AttendanceEntry>, String>((ref, lessonId) {
  ref.watch(attendanceVersionProvider);
  return ref.watch(attendanceQueriesProvider).fetchByLesson(lessonId);
});
