import 'package:isar/isar.dart';

part 'settings_record.g.dart';

/// `AppSettings` entity'sining Isar'da saqlanadigan ko'rinishi.
@collection
class SettingsRecord {
  Id id = Isar.autoIncrement;

  late String language;
  late String themeMode;
  late bool notificationsEnabled;
  late bool pushEnabled;
  late bool smsEnabled;
  late bool telegramEnabled;
  String? printerName;
  late String paperSize;
  late bool autoBackupEnabled;
  late int backupIntervalDays;
  DateTime? lastBackupDate;
  late int glassIntensity;

  // Isar migratsiyasida eski bazalarda xatolik bo'lmasligi uchun
  // yangi maydonlarga default qiymatlar beramiz.
  bool hikvisionEnabled = false;
  String? hikvisionIp;
  int hikvisionPort = 554;
  String? hikvisionUsername;
  String? hikvisionPassword;
  int hikvisionChannel = 1;

  /// RTSP oqim yo'li — Hikvision bo'lmagan kameralar (Dahua, TP-Link,
  /// Reolink va h.k.) uchun maxsus yo'l ko'rsatish imkoniyati.
  /// Bo'sh bo'lsa Hikvision standart yo'li ishlatiladi
  /// (/Streaming/Channels/101).
  String? hikvisionRtspPath;
  bool autoMarkAttendance = true;
  int scanIntervalMs = 1200;
  double matchThreshold = 0.92;
  double ambiguousThreshold = 0.88;
  String? telegramBotToken;
  bool sendMonthlyReport = false;
  String? lastMonthlyReportSent;
  int syncVersion = 1;
}
