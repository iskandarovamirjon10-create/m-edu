import 'package:equatable/equatable.dart';

import '../../../scheduling/domain/entities/schedule.dart';

/// Student 360 — SCHEDULE snapshot.
///
/// Bugungi va yaqin orada bo'ladigan darslar (joriy guruh asosida).
/// Schedule repository'dan o'qiladi, snapshot'ga birlashtiriladi.
///
/// `todayLessons` = bugun (DayOfWeek mos keladigan) darslar.
/// `upcomingLessons` = bugundan keyingi 7 kun ichidagi darslar.
class ScheduleSnapshot extends Equatable {
  /// Bugungi darslar (hozirgi DayOfWeek ga mos).
  final List<Schedule> todayLessons;

  /// Kelasi 7 kun ichidagi darslar.
  final List<Schedule> upcomingLessons;

  /// Hozirgi guruh ID (Student.groupId).
  final String? groupId;

  /// Snapshot muvaffaqiyatli qurildimi?
  /// false = guruhga tayinlanmagan yoki schedule repository xato.
  final bool isAvailable;

  const ScheduleSnapshot({
    required this.todayLessons,
    required this.upcomingLessons,
    required this.groupId,
    required this.isAvailable,
  });

  /// Bo'sh snapshot — student guruhga tayinlanmagan.
  const ScheduleSnapshot.empty()
      : todayLessons = const [],
        upcomingLessons = const [],
        groupId = null,
        isAvailable = false;

  bool get hasGroup => groupId != null;
  bool get hasTodayLessons => todayLessons.isNotEmpty;

  @override
  List<Object?> get props => [
        todayLessons,
        upcomingLessons,
        groupId,
        isAvailable,
      ];
}
