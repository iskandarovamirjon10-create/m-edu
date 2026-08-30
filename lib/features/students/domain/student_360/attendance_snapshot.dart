import 'package:equatable/equatable.dart';

/// Student 360 — ATTENDANCE snapshot.
///
/// `AttendanceStatisticsService.fetchForStudent` dan olingan tayyor
/// statistikani o'zida saqlaydi. Aggregate qiymat — har safar
/// hisoblanmaydi, balki [Student360Snapshot] kompozitsiya qilingan
/// vaqtda bir marta service orqali olinadi.
///
/// [isAvailable] = false bo'lsa — service mavjud emas yoki xato
/// bo'lgan; snapshot bo'sh qaytadi (crash emas, UNVERIFIED marker).
class AttendanceSnapshot extends Equatable {
  /// Service'dan olingan yoki hisoblangan statistika.
  final int scheduledLessons;
  final int presentLessons;
  final int lateLessons;
  final int excusedLessons;
  final int absentLessons;

  /// [AttendanceStatisticsService] ishlatildimi?
  /// false = snapshot bo'sh (UNVERIFIED), true = real data.
  final bool isAvailable;

  const AttendanceSnapshot({
    required this.scheduledLessons,
    required this.presentLessons,
    required this.lateLessons,
    required this.excusedLessons,
    required this.absentLessons,
    required this.isAvailable,
  });

  /// Bo'sh snapshot — statistika service xato qaytargan yoki
  /// student hali guruhga tayinlanmagan holatda.
  const AttendanceSnapshot.unavailable()
      : scheduledLessons = 0,
        presentLessons = 0,
        lateLessons = 0,
        excusedLessons = 0,
        absentLessons = 0,
        isAvailable = false;

  /// present + late — formula `AttendanceStatistics.percentage` ga mos.
  int get totalAttended => presentLessons + lateLessons;

  /// Denominator — excused hisobga olinmaydi. [clamp] yordamida manfiy
  /// qiymatdan qochamiz (F7: scheduled < excused bo'lsa invariant buziladi;
  /// service'da keladigan 0 yoki manfiy qiymat uchun 0 qaytaramiz — bu
  /// foiz 100% dan oshmasligini ta'minlaydi).
  int get denominator {
    final raw = scheduledLessons - excusedLessons;
    return raw < 0 ? 0 : raw;
  }

  /// Davomat foizi 0..100. [denominator] non-negative bo'lgani uchun
  /// bu qiymat ham 0..100 oraliqda.
  double get percentage =>
      denominator > 0 ? (totalAttended / denominator) * 100 : 0;

  @override
  List<Object?> get props => [
        scheduledLessons,
        presentLessons,
        lateLessons,
        excusedLessons,
        absentLessons,
        isAvailable,
      ];
}
