import 'package:flutter/foundation.dart';

import '../../../scheduling/application/services/lesson_instance_service.dart';
import '../../../scheduling/domain/entities/schedule.dart';
import '../../../scheduling/domain/repositories/schedule_repository.dart';
import '../../../students/domain/entities/student.dart';
import '../../domain/entities/attendance_entry.dart';
import '../../domain/repositories/attendance_repository.dart';

/// Student davomat statistikasi — DERIVED value (spec §8).
///
/// Source of truth: `AttendanceRecord` + `ScheduleRecord`. Bu qiymat
/// hech qayerda mutable field sifatida saqlanmaydi — har safar so'rovda
/// hisoblanadi (yoki Riverpod orqali cache'lanadi, §5).
class AttendanceStatistics {
  /// Davr ichida rejalashtirilgan REAL darslar soni (denominator).
  final int scheduledLessons;

  /// Present deb belgilangan darslar.
  final int presentLessons;

  /// Late (kechikkan) darslar — present sifatida hisoblanadi, lekin
  /// alohida statistikada saqlanadi (user qarori).
  final int lateLessons;

  /// Excused (kechirilgan) darslar — denominatorga kirmaydi (user qarori).
  final int excusedLessons;

  /// Absent — rejalashtirilgan, lekin kelmagan darslar.
  final int absentLessons;

  const AttendanceStatistics({
    required this.scheduledLessons,
    required this.presentLessons,
    required this.lateLessons,
    required this.excusedLessons,
    required this.absentLessons,
  });

  /// Sizning formula: presentLessons = present + late.
  int get presentCount => presentLessons + lateLessons;

  /// Denominator: excused chiqariladi (asosli sabab bilan kelmagan —
  /// foizni tushirmaydi, user qarori).
  int get denominator => scheduledLessons - excusedLessons;

  /// attendancePercentage (0-100).
  double get percentage =>
      denominator > 0 ? (presentCount / denominator) * 100 : 0;
}

/// Student davomat foizini hisoblaydigan derived service.
///
/// Formulasi (Phase 5 user talabi):
/// ```
/// scheduledLessons = LESSON INSTANCE'lar (assignedAt..bugun) — bir kunda
///                    bir nechta dars bo'lsa har biri alohida hisoblanadi
/// presentLessons   = present + late (attendance yozuvlari)
/// excusedLessons   = denominatorga kirmaydi (alohida domain policy)
/// absentLessons    = scheduled − (present + late + excused)
/// percentage       = scheduled > 0 ? (present + late) / (scheduled − excused) * 100 : 0
/// ```
///
/// P0-02: attendance yozuvi `lessonId` bilan bo'lsa — aynan o'sha darsga
/// moslanadi; legacy (V2, lessonId null) yozuvlar sana bo'yicha (orqaga
/// moslik). Shu tufayli bir kunda ikkita dars bo'lsa ham statistika
/// to'g'ri hisoblanadi.
class AttendanceStatisticsService {
  final AttendanceRepository _attendanceRepository;
  final ScheduleRepository _scheduleRepository;

  AttendanceStatisticsService({
    required AttendanceRepository attendanceRepository,
    required ScheduleRepository scheduleRepository,
  })  : _attendanceRepository = attendanceRepository,
        _scheduleRepository = scheduleRepository;

  /// Bitta student uchun statistikani hisoblaydi (granular, §5).
  Future<AttendanceStatistics> fetchForStudent(Student student) async {
    final schedules = student.groupId == null
        ? <Schedule>[]
        : await _scheduleRepository.fetchByGroupId(student.groupId!);
    final entries = await _attendanceRepository.fetchForIdentity(
      student.identityId,
    );

    return compute(
      student: student,
      schedules: schedules,
      entries: entries,
    );
  }

  /// Ko'p studentlar uchun statistikani BIR marta so'rov bilan hisoblaydi
  /// (dashboard/report aggregate — N+1 query'ning oldini oladi, §96).
  ///
  /// Schedule va attendance yozuvlari bir marta olinadi, so'ng xotirada
  /// guruhlanadi. Bu DERIVED hisob — source of truth o'zgarmaydi (§8).
  ///
  /// PERFORMANCE: so'rov oralig'i studentlarning HAQIQIY davriga
  /// cheklanadi (eng erta qo'shilishdan eng kech tugashgacha) — butun
  /// tarixni xotiraga yuklash shart emas (§96).
  Future<Map<String, AttendanceStatistics>> fetchForStudents(
    List<Student> students,
  ) async {
    final allSchedules = await _scheduleRepository.fetchAll();

    // Haqiqiy davr chegaralari: eng erta assignedAt/enrolledAt dan
    // eng kech completedAt/bugungacha. Bo'sh ro'yxat — hech qanday
    // attendance so'rovi qilinmaydi.
    var fetchFrom = DateTime.now();
    var fetchTo = DateTime.now();
    if (students.isNotEmpty) {
      fetchFrom = students
          .map((s) => _dayOf(s.assignedAt ?? s.enrolledAt))
          .reduce((a, b) => a.isBefore(b) ? a : b);
      fetchTo = students
          .map((s) => _dayOf(s.completedAt ?? DateTime.now()))
          .reduce((a, b) => a.isAfter(b) ? a : b);
    }
    final allEntries = await _attendanceRepository.fetchBetween(
      fetchFrom,
      fetchTo.add(const Duration(days: 1)),
    );

    final schedulesByGroup = <String, List<Schedule>>{};
    for (final schedule in allSchedules) {
      schedulesByGroup
          .putIfAbsent(schedule.groupId, () => [])
          .add(schedule);
    }
    final entriesByStudent = <String, List<AttendanceEntry>>{};
    for (final entry in allEntries) {
      entriesByStudent
          .putIfAbsent(entry.identityId, () => [])
          .add(entry);
    }

    return {
      for (final student in students)
        student.identityId: compute(
          student: student,
          schedules: schedulesByGroup[student.groupId] ?? const [],
          entries: entriesByStudent[student.identityId] ?? const [],
        ),
    };
  }

  /// TOZA formula — test qilinadigan yadro (UI/database'siz).
  ///
  /// [student] — davr chegaralarini aniqlash uchun: boshlanish =
  /// `assignedAt` (guruhga qo'shilgan sana) yoki `enrolledAt`; tugash =
  /// `completedAt` (arxivlangan/bitirilgan) yoki bugun.
  ///
  /// QOIDALAR (user talablari):
  /// - Kelajakdagi darslar denominatorga kirmaydi.
  /// - Student guruhga qo'shilgan sanadan oldingi darslar hisoblanmaydi.
  /// - Student chiqarilgan/arxivlangan bo'lsa, keyingi darslar hisoblanmaydi.
  /// - Excused denominatorga kirmaydi, present/absent deb qabul qilinmaydi.
  /// - Scheduled lesson bo'lmagan kun attendance denominatoriga kirmaydi.
  @visibleForTesting
  static AttendanceStatistics compute({
    required Student student,
    required List<Schedule> schedules,
    required List<AttendanceEntry> entries,
    DateTime? now,
  }) {
    final periodStart = _dayOf(student.assignedAt ?? student.enrolledAt);
    // `now` — deterministik test uchun; production'da DateTime.now().
    final periodEnd = _dayOf(student.completedAt ?? now ?? DateTime.now());

    // ── Rejalashtirilgan REAL darslar (INSTANCE darajasida, P0-02) ─────
    // Bir kunda bir nechta dars bo'lishi mumkin — har (schedule, sana)
    // juftligi alohida scheduled lesson hisoblanadi (eski Set bilan ikki
    // dars bitta bo'lib qolardi).
    final scheduledInstances =
        LessonInstanceService.instancesInPeriod(schedules, periodStart, periodEnd);
    final scheduledLessonIds = <String>{
      for (final instance in scheduledInstances) instance.lessonId,
    };
    // Legacy (V2, lessonId null) yozuvlar uchun sana bo'yicha orqaga moslik.
    final scheduledDates = <DateTime>{
      for (final instance in scheduledInstances) instance.date,
    };

    // ── Student attendance yozuvlari (status bo'yicha ajratish) ────────
    var present = 0;
    var late = 0;
    var excused = 0;
    for (final entry in entries) {
      if (entry.role != 'student') continue;
      // V2: attendanceDate = primary yozuv sanasi; legacy → timestamp.
      final date = _dayOf(entry.attendanceDate);
      final isScheduled = entry.lessonId != null
          ? scheduledLessonIds.contains(entry.lessonId)
          : scheduledDates.contains(date);
      if (!isScheduled) continue;

      switch (entry.status) {
        case 'late':
          late++;
        case 'present':
          present++;
        case 'excused':
          excused++;
        default:
          // absent / noma'lum — denominator hisobidan chiqadi.
          break;
      }
    }

    final scheduledLessons = scheduledInstances.length;
    final accounted = present + late + excused;
    final absent = (scheduledLessons - accounted).clamp(0, scheduledLessons);

    return AttendanceStatistics(
      scheduledLessons: scheduledLessons,
      presentLessons: present,
      lateLessons: late,
      excusedLessons: excused,
      absentLessons: absent,
    );
  }

  static DateTime _dayOf(DateTime t) => DateTime(t.year, t.month, t.day);
}
