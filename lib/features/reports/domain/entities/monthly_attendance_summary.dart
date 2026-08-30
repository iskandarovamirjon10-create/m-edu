import 'package:equatable/equatable.dart';

/// Bir o'quvchining bir oylik davomat hisoboti (necha kun kelgan/kelmagan).
///
/// Oy yakunida ota-onalarga Telegram orqali yuboriladigan ma'lumot.
class MonthlyAttendanceSummary extends Equatable {
  final String identityId;

  /// O'quvchining to'liq ismi (Identity'dan).
  final String fullName;

  final String? groupName;

  /// Ota-ona/vasiy ma'lumotlari.
  final String? parentName;
  final String? parentPhone;

  /// Telegram chat ID (null = hali bog'lanmagan).
  final String? parentTelegramId;

  /// Oy davomida kelgan (davomat belgilangan) kunlar soni.
  final int presentDays;

  /// Kechikkan kunlar soni (status = 'late').
  final int lateDays;

  /// Kelmagan (o'tkazib yuborilgan) kunlar soni.
  final int absentDays;

  /// Sababli (excused) kunlar soni.
  final int excusedDays;

  /// Jami o'quv kunlari (dushanba–juma, oy boshidan bugungacha).
  final int totalSchoolDays;

  const MonthlyAttendanceSummary({
    required this.identityId,
    required this.fullName,
    this.groupName,
    this.parentName,
    this.parentPhone,
    this.parentTelegramId,
    required this.presentDays,
    this.lateDays = 0,
    required this.absentDays,
    this.excusedDays = 0,
    required this.totalSchoolDays,
  });

  /// Telegram orqali hisobot olishi mumkin bo'lgan ota-ona bormi?
  bool get hasTelegramContact =>
      parentTelegramId != null && parentTelegramId!.trim().isNotEmpty;

  /// Davomat foizi (0-100) — kelgan + kechikkan kunlar jami o'quv kunlariga nisbatan.
  double get attendancePercent => totalSchoolDays == 0
      ? 0.0
      : ((presentDays + lateDays) / totalSchoolDays) * 100;

  @override
  List<Object?> get props => [
        identityId,
        fullName,
        groupName,
        parentName,
        parentPhone,
        parentTelegramId,
        presentDays,
        lateDays,
        absentDays,
        excusedDays,
        totalSchoolDays,
      ];
}
