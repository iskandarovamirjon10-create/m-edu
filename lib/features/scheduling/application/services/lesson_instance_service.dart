import '../../domain/entities/lesson_instance.dart';
import '../../domain/entities/schedule.dart';

/// Schedule shablonidan dars instance'larini hosil qiluvchi xizmat.
///
/// `LessonInstance` DB'da alohida saqlanmaydi — deterministik ravishda
/// shablondan HISOBLANADI. Bir xil (schedule, sana) juftligi → bir xil
/// `lessonId` — idempotent, dublikat xavfi yo'q.
///
/// Cancelled holatdagi jadval instance hosil qilmaydi (dars bekor).
class LessonInstanceService {
  const LessonInstanceService();

  /// Aniq instance ID: `LESSON-{scheduleId}-{yyyyMMdd}`.
  /// Masalan: `LESSON-SCH-20260811-00042-20260811`.
  static String lessonIdFor(Schedule schedule, DateTime date) {
    final day = _dayOf(date);
    final datePart = '${day.year}'
        '${day.month.toString().padLeft(2, '0')}'
        '${day.day.toString().padLeft(2, '0')}';
    return 'LESSON-${schedule.scheduleId}-$datePart';
  }

  /// [date] kuni shablonga ko'ra dars mavjudmi?
  ///
  /// - Cancelled dars — yo'q.
  /// - [Schedule.specificDate] bor bo'lsa — faqat o'sha sana.
  /// - Aks holda recurring: hafta kuni mos + [Schedule.startDate]..[endDate]
  ///   oralig'ida (chegaralar ixtiyoriy).
  static bool coversDate(Schedule schedule, DateTime date) {
    if (schedule.status == ScheduleStatus.cancelled) return false;
    final day = _dayOf(date);

    if (schedule.specificDate != null) {
      return _dayOf(schedule.specificDate!) == day;
    }

    if (_weekdayValue(schedule.dayOfWeek) != day.weekday) return false;
    final start = schedule.startDate;
    final end = schedule.endDate;
    if (start != null && day.isBefore(_dayOf(start))) return false;
    if (end != null && day.isAfter(_dayOf(end))) return false;
    return true;
  }

  /// [date] kungi instance (dars bo'lmasa null).
  static LessonInstance? instanceFor(Schedule schedule, DateTime date) {
    if (!coversDate(schedule, date)) return null;
    return LessonInstance(
      lessonId: lessonIdFor(schedule, date),
      scheduleId: schedule.scheduleId,
      date: _dayOf(date),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      subject: schedule.subject,
      groupId: schedule.groupId,
      groupName: schedule.groupName,
      teacherName: schedule.teacherName,
      roomName: schedule.roomName,
    );
  }

  /// [date] kungi barcha instance'lar (vaqt bo'yicha tartiblangan).
  static List<LessonInstance> instancesForDate(
    Iterable<Schedule> schedules,
    DateTime date,
  ) {
    final list = <LessonInstance>[];
    for (final schedule in schedules) {
      final instance = instanceFor(schedule, date);
      if (instance != null) list.add(instance);
    }
    list.sort((a, b) => a.startTime.compareTo(b.startTime));
    return list;
  }

  /// Hozir FAOL bo'lgan dars instance'i (dars vaqti oralig'ida).
  ///
  /// Qoida: sana bugun va `startTime <= hozir < endTime`. Faol dars
  /// bo'lmasa null — face/QR/manual oqimlarida "Faol dars mavjud emas"
  /// holati uchun.
  ///
  /// OVERLAP (LESSON-OVERLAP audit): bir vaqtda BIR NECHTA dars faol
  /// bo'lsa (masalan 09:00-10:00 va 09:30-10:30), birinchi topilganiga
  /// ko'r-ko'rona qaytish YO'Q — deterministik qoida:
  ///   1) Eng kech boshlangan dars g'olib (hozirgi vaqtga eng yaqin boshlangan
  ///      — eng "aniq" faol sessiya);
  ///   2) Teng boshlanishda kichikroq [Schedule.scheduleId] g'olib
  ///      (lexicographic — tuzilma tartibi emas, barqaror qoida).
  ///
  /// Xulosa: har qanday jadval to'plamida natija DETERMINISTIK — qaysi
  /// darsga davomat yozilishi kontekstdan qat'iy nazar bir xil.
  static LessonInstance? activeLesson(
    Iterable<Schedule> schedules,
    DateTime now,
  ) {
    final today = _dayOf(now);
    final nowMinutes = now.hour * 60 + now.minute;

    LessonInstance? best;
    for (final schedule in schedules) {
      final instance = instanceFor(schedule, today);
      if (instance == null) continue;
      final start = _toMinutes(instance.startTime);
      final end = _toMinutes(instance.endTime);
      if (nowMinutes < start || nowMinutes >= end) continue;
      if (best == null || _prefer(instance, best)) best = instance;
    }
    return best;
  }

  /// Deterministik g'olib: kechroq boshlangan; tengda kichikroq scheduleId.
  static bool _prefer(LessonInstance candidate, LessonInstance current) {
    final cmpStart = candidate.startTime.compareTo(current.startTime);
    if (cmpStart != 0) return cmpStart > 0;
    return candidate.scheduleId.compareTo(current.scheduleId) < 0;
  }

  /// [from]..[to] davridagi barcha instance'lar (statistika/report uchun).
  static List<LessonInstance> instancesInPeriod(
    Iterable<Schedule> schedules,
    DateTime from,
    DateTime to,
  ) {
    final list = <LessonInstance>[];
    for (final schedule in schedules) {
      if (schedule.status == ScheduleStatus.cancelled) continue;
      for (final date in _datesInPeriod(schedule, from, to)) {
        final instance = instanceFor(schedule, date);
        if (instance != null) list.add(instance);
      }
    }
    list.sort((a, b) => a.date.compareTo(b.date));
    return list;
  }

  /// Schedule davr ichidagi dars sanalari.
  ///
  /// - [Schedule.specificDate] bor bo'lsa — faqat o'sha sana (aniq dars).
  /// - Aks holda [Schedule.startDate]..[Schedule.endDate] oralig'ida
  ///   [Schedule.dayOfWeek] mos kelgan har bir sana = dars (recurring).
  static List<DateTime> _datesInPeriod(
    Schedule schedule,
    DateTime periodStart,
    DateTime periodEnd,
  ) {
    final dates = <DateTime>[];

    if (schedule.specificDate != null) {
      final date = _dayOf(schedule.specificDate!);
      if (!date.isBefore(periodStart) && !date.isAfter(periodEnd)) {
        dates.add(date);
      }
      return dates;
    }

    final start = _dayOf(schedule.startDate ?? periodStart);
    final end = _dayOf(schedule.endDate ?? periodEnd);
    final from = start.isBefore(periodStart) ? periodStart : start;
    final to = end.isAfter(periodEnd) ? periodEnd : end;

    // Recurring dars: period ichida hafta kuni mos kelgan sanalar.
    // Birinchi mos kundan boshlab 7-kun qadam bilan yuriladi (tezroq).
    final weekday = _weekdayValue(schedule.dayOfWeek);
    var first = from;
    final offset = (weekday - first.weekday) % 7;
    first = first.add(Duration(days: offset));
    for (var d = first; !d.isAfter(to); d = d.add(const Duration(days: 7))) {
      dates.add(d);
    }
    return dates;
  }

  static DateTime _dayOf(DateTime t) => DateTime(t.year, t.month, t.day);

  static int _weekdayValue(DayOfWeek day) => switch (day) {
        DayOfWeek.monday => DateTime.monday,
        DayOfWeek.tuesday => DateTime.tuesday,
        DayOfWeek.wednesday => DateTime.wednesday,
        DayOfWeek.thursday => DateTime.thursday,
        DayOfWeek.friday => DateTime.friday,
        DayOfWeek.saturday => DateTime.saturday,
        DayOfWeek.sunday => DateTime.sunday,
      };

  static int _toMinutes(String time) {
    final parts = time.split(':');
    return int.parse(parts[0]) * 60 + int.parse(parts[1]);
  }
}
