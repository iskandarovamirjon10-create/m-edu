import 'package:equatable/equatable.dart';

/// Dars holati.
enum ScheduleStatus { scheduled, ongoing, completed, cancelled }

/// Haftaning kuni.
enum DayOfWeek {
  monday,
  tuesday,
  wednesday,
  thursday,
  friday,
  saturday,
  sunday,
}

/// Dars jadvali entity'si (spec §6 #19-22).
///
/// Har bir dars uchun:
/// - Guruh
/// - O'qituvchi
/// - Xona
/// - Vaqt (boshlanish/tugash)
/// - Kun
class Schedule extends Equatable {
  /// Jadvalning yagona identifikatori.
  final String scheduleId;

  /// Guruh ID'si.
  final String groupId;

  /// Guruh nomi (denormalized).
  final String? groupName;

  /// O'qituvchi identity ID'si.
  final String teacherId;

  /// O'qituvchi ismi (denormalized).
  final String? teacherName;

  /// Xona ID'si.
  final String roomId;

  /// Xona nomi (denormalized).
  final String? roomName;

  /// Haftaning kuni.
  final DayOfWeek dayOfWeek;

  /// Dars boshlanish vaqti (HH:mm).
  final String startTime;

  /// Dars tugash vaqti (HH:mm).
  final String endTime;

  /// Fan nomi.
  final String? subject;

  /// Dars holati.
  final ScheduleStatus status;

  /// Sana (agar aniq sana kerak bo'lsa).
  final DateTime? specificDate;

  /// Boshlanish sanasi (recurring uchun).
  final DateTime? startDate;

  /// Tugash sanasi (recurring uchun).
  final DateTime? endDate;

  /// Izoh.
  final String? notes;

  /// Sinxronlash versiyasi.
  final int syncVersion;

  const Schedule({
    required this.scheduleId,
    required this.groupId,
    this.groupName,
    required this.teacherId,
    this.teacherName,
    required this.roomId,
    this.roomName,
    required this.dayOfWeek,
    required this.startTime,
    required this.endTime,
    this.subject,
    this.status = ScheduleStatus.scheduled,
    this.specificDate,
    this.startDate,
    this.endDate,
    this.notes,
    this.syncVersion = 1,
  });

  /// Dars davomiyligi (daqiqa).
  int get durationMinutes {
    final start = _parseTime(startTime);
    final end = _parseTime(endTime);
    return end - start;
  }

  /// Dars davomiyligi (soat).
  double get durationHours => durationMinutes / 60;

  /// Vaqt oralig'i (masalan, "09:00 - 10:30").
  String get timeRange => '$startTime - $endTime';

  /// Kun nomi (o'zbekcha).
  String get dayName {
    return switch (dayOfWeek) {
      DayOfWeek.monday => 'Dushanba',
      DayOfWeek.tuesday => 'Seshanba',
      DayOfWeek.wednesday => 'Chorshanba',
      DayOfWeek.thursday => 'Payshanba',
      DayOfWeek.friday => 'Juma',
      DayOfWeek.saturday => 'Shanba',
      DayOfWeek.sunday => 'Yakshanba',
    };
  }

  int _parseTime(String time) {
    final parts = time.split(':');
    return int.parse(parts[0]) * 60 + int.parse(parts[1]);
  }

  @override
  List<Object?> get props => [
        scheduleId,
        groupId,
        teacherId,
        roomId,
        dayOfWeek,
        startTime,
        endTime,
        subject,
        status,
        specificDate,
        startDate,
        endDate,
        syncVersion,
      ];
}
