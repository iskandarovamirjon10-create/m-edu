import 'package:equatable/equatable.dart';

/// Ilova sozlamalari entity'si (spec §6 #42-45).
///
/// Quyidagi sozlamalarni saqlaydi:
/// - Til
/// - Mavzu (dark/light/system)
/// - Bildirishnomalar
/// - Printer sozlamalari
/// - Zaxira nusxalash
class AppSettings extends Equatable {
  /// Qo'llab-quvvatlanadigan tillar (Phase 4 — "uz default" kafolati).
  ///
  /// O'qish (repository normallashtirish) va yozish (command validatsiya)
  /// chegaralari bir xil ro'yxatni ishlatadi — bir-biridan ajralib
  /// ketmasligi uchun yagona manba.
  static const supportedLanguages = {'uz', 'ru', 'en'};
  /// Tanlangan til (uz, ru, en).
  final String language;

  /// Mavzu rejimi.
  final AppThemeMode themeMode;

  /// Bildirishnomalar yoqilgan.
  final bool notificationsEnabled;

  /// Push bildirishnomalar yoqilgan.
  final bool pushEnabled;

  /// SMS bildirishnomalar yoqilgan.
  final bool smsEnabled;

  /// Telegram bildirishnomalar yoqilgan.
  final bool telegramEnabled;

  /// Printer nomi.
  final String? printerName;

  /// Printer hajmi (A4, A5, va h.k.).
  final String paperSize;

  /// Avtomatik zaxira nusxalash.
  final bool autoBackupEnabled;

  /// Zaxira nusxalash davri (kun).
  final int backupIntervalDays;

  /// Oxirgi zaxira nusxalash sanasi.
  final DateTime? lastBackupDate;

  /// Glass intensity (0-100%).
  final int glassIntensity;

  // ─── Hikvision kamera / Face ID sozlamalari ──────────────────────────

  /// Hikvision kamera ulangan (Face ID yoqilgan).
  final bool hikvisionEnabled;

  /// Kamera IP manzili.
  final String? hikvisionIp;

  /// RTSP port (odatda 554).
  final int hikvisionPort;

  /// Kamera login.
  final String? hikvisionUsername;

  /// Kamera parol.
  final String? hikvisionPassword;

  /// Kanal raqami (1 dan boshlab).
  final int hikvisionChannel;

  /// RTSP oqim yo'li — Hikvision bo'lmagan kameralar uchun maxsus yo'l
  /// (masalan, Dahua: `/cam/realmonitor?channel=1&subtype=0`, TP-Link:
  /// `/stream1`, Reolink: `/h264Preview_01_main`). Bo'sh bo'lsa Hikvision
  /// standart yo'li (`/Streaming/Channels/101`) ishlatiladi.
  final String? hikvisionRtspPath;

  /// Yuz tanilganda davomatni avtomatik belgilash.
  final bool autoMarkAttendance;

  /// Skanlash oralig'i (ms) — RTSP oqimidan qancha tez-tez kadr olinadi.
  final int scanIntervalMs;

  /// Face ID moslik chegarasi (0..1) — undan yuqori o'xshashlik "tanildi".
  final double matchThreshold;

  /// Noaniq zona chegarasi (0..1) — shu qiymat bilan [matchThreshold]
  /// orasidagi o'xshashlik noaniq deb hisoblanadi.
  final double ambiguousThreshold;

  // ─── Oylik davomat hisoboti (Telegram) ────────────────────────────

  /// Telegram bot token (ota-onalarga hisobot yuborish uchun).
  final String? telegramBotToken;

  /// Oylik davomat hisobotini ota-onalarga Telegram orqali yuborish.
  /// Settings'dan o'chirib qo'yish mumkin.
  final bool sendMonthlyReport;

  /// Oxirgi yuborilgan hisobot oyi ("2026-08" ko'rinishida, null = yuborilmagan).
  final String? lastMonthlyReportSent;

  /// Sinxronlash versiyasi.
  final int syncVersion;

  const AppSettings({
    this.language = 'uz',
    this.themeMode = AppThemeMode.system,
    this.notificationsEnabled = true,
    this.pushEnabled = true,
    this.smsEnabled = false,
    this.telegramEnabled = false,
    this.printerName,
    this.paperSize = 'A4',
    this.autoBackupEnabled = false,
    this.backupIntervalDays = 7,
    this.lastBackupDate,
    this.glassIntensity = 80,
    this.hikvisionEnabled = false,
    this.hikvisionIp,
    this.hikvisionPort = 554,
    this.hikvisionUsername,
    this.hikvisionPassword,
    this.hikvisionChannel = 1,
    this.hikvisionRtspPath,
    this.autoMarkAttendance = true,
    this.scanIntervalMs = 1200,
    this.matchThreshold = 0.92,
    this.ambiguousThreshold = 0.88,
    this.telegramBotToken,
    this.sendMonthlyReport = false,
    this.lastMonthlyReportSent,
    this.syncVersion = 1,
  });

  AppSettings copyWith({
    String? language,
    AppThemeMode? themeMode,
    bool? notificationsEnabled,
    bool? pushEnabled,
    bool? smsEnabled,
    bool? telegramEnabled,
    String? printerName,
    String? paperSize,
    bool? autoBackupEnabled,
    int? backupIntervalDays,
    DateTime? lastBackupDate,
    int? glassIntensity,
    bool? hikvisionEnabled,
    String? hikvisionIp,
    int? hikvisionPort,
    String? hikvisionUsername,
    String? hikvisionPassword,
    int? hikvisionChannel,
    String? hikvisionRtspPath,
    bool? autoMarkAttendance,
    int? scanIntervalMs,
    double? matchThreshold,
    double? ambiguousThreshold,
    String? telegramBotToken,
    bool? sendMonthlyReport,
    String? lastMonthlyReportSent,
  }) {
    return AppSettings(
      language: language ?? this.language,
      themeMode: themeMode ?? this.themeMode,
      notificationsEnabled: notificationsEnabled ?? this.notificationsEnabled,
      pushEnabled: pushEnabled ?? this.pushEnabled,
      smsEnabled: smsEnabled ?? this.smsEnabled,
      telegramEnabled: telegramEnabled ?? this.telegramEnabled,
      printerName: printerName ?? this.printerName,
      paperSize: paperSize ?? this.paperSize,
      autoBackupEnabled: autoBackupEnabled ?? this.autoBackupEnabled,
      backupIntervalDays: backupIntervalDays ?? this.backupIntervalDays,
      lastBackupDate: lastBackupDate ?? this.lastBackupDate,
      glassIntensity: glassIntensity ?? this.glassIntensity,
      hikvisionEnabled: hikvisionEnabled ?? this.hikvisionEnabled,
      hikvisionIp: hikvisionIp ?? this.hikvisionIp,
      hikvisionPort: hikvisionPort ?? this.hikvisionPort,
      hikvisionUsername: hikvisionUsername ?? this.hikvisionUsername,
      hikvisionPassword: hikvisionPassword ?? this.hikvisionPassword,
      hikvisionChannel: hikvisionChannel ?? this.hikvisionChannel,
      hikvisionRtspPath: hikvisionRtspPath ?? this.hikvisionRtspPath,
      autoMarkAttendance: autoMarkAttendance ?? this.autoMarkAttendance,
      scanIntervalMs: scanIntervalMs ?? this.scanIntervalMs,
      matchThreshold: matchThreshold ?? this.matchThreshold,
      ambiguousThreshold:
          ambiguousThreshold ?? this.ambiguousThreshold,
      telegramBotToken: telegramBotToken ?? this.telegramBotToken,
      sendMonthlyReport: sendMonthlyReport ?? this.sendMonthlyReport,
      lastMonthlyReportSent:
          lastMonthlyReportSent ?? this.lastMonthlyReportSent,
      syncVersion: syncVersion + 1,
    );
  }

  @override
  List<Object?> get props => [
        language,
        themeMode,
        notificationsEnabled,
        pushEnabled,
        smsEnabled,
        telegramEnabled,
        printerName,
        paperSize,
        autoBackupEnabled,
        backupIntervalDays,
        lastBackupDate,
        glassIntensity,
        hikvisionEnabled,
        hikvisionIp,
        hikvisionPort,
        hikvisionUsername,
        hikvisionPassword,
        hikvisionChannel,
        hikvisionRtspPath,
        autoMarkAttendance,
        scanIntervalMs,
        matchThreshold,
        ambiguousThreshold,
        telegramBotToken,
        sendMonthlyReport,
        lastMonthlyReportSent,
        syncVersion,
      ];
}

/// Mavzu rejimi (Flutter'dagi `ThemeMode` bilan to'qnashuvni oldini olish
/// uchun alohida nomlangan).
enum AppThemeMode { light, dark, system }

/// Foydalanuvchi roli.
///
/// AUDIT P1-04 (FAIL CLOSED): `unknown` — sessiyada rol bo'lmasa yoki
/// noma'lum bo'lsa ishlatiladi. `Permissions.can(unknown, ...)` doim
/// `false` qaytaradi — noma'lum foydalanuvchi hech qachon admin
/// bo'lmaydi (spec §14).
/// AUDIT P2-02 (RBAC): rollar to'plami.
///
/// - `superAdmin` — egasi (birinchi hisob).
/// - `director` — direktor (admin darajasida, users boshqaruvi yo'q).
/// - `admin` — administrator.
/// - `manager` — menejer (operatsion + moliya ko'rish).
/// - `teacher` — o'qituvchi (davomat, jadval, hisobotlar).
/// - `staff` — xodim (odamlar/guruhlar bilan ishlash).
/// - `student` / `parent` — admin ilovasiga kirmaydi (DENY by default).
/// - `unknown` — belgilanmagan (hech qanday ruxsat yo'q, fail-closed).
enum UserRole {
  superAdmin,
  director,
  admin,
  manager,
  teacher,
  staff,
  student,
  parent,
  unknown;

  /// Saqlash/sessiya wire formati (AppConstants bilan mos):
  /// `superAdmin` → `'super_admin'`, qolganlari → enum nomi.
  ///
  /// AUDIT P2-03 (wire-format konsistensiyasi): Enum nomi `'superAdmin'`
  /// (camelCase), lekin [LocalAuthStore] va [AppConstants.roleSuperAdmin]
  /// `'super_admin'` (snake_case) saqlaydi. Rol bilan taqqoslashda `.name`
  /// emas, shu `wire` ishlatilishi shart — aks holda "oxirgi super admin"
  /// himoyasi ishlamay qoladi (fail-open!) va real super_admin `unknown`
  /// sifatida ko'rinib DENY oladi (fail-closed xavfsiz, lekin buzilgan).
  String get wire => switch (this) {
        UserRole.superAdmin => 'super_admin',
        _ => name,
      };

  /// Wire string'dan rol — FAIL CLOSED: topilmasa `unknown`.
  ///
  /// Ikkala formatni ham qabul qiladi ('superAdmin' yoki 'super_admin').
  /// `values.byName` dan farqli — noma'lum qiymatda exception emas,
  /// `unknown` qaytaradi (hech qachon admin emas).
  static UserRole fromWire(String? value) {
    if (value == null || value.isEmpty) return UserRole.unknown;
    for (final role in UserRole.values) {
      if (role.name == value || role.wire == value) return role;
    }
    return UserRole.unknown;
  }
}

/// Foydalanuvchi entity'si.
class AppUser extends Equatable {
  final String userId;
  final String identityId;
  final String email;
  final UserRole role;
  final bool isActive;
  final DateTime createdAt;
  final DateTime? lastLoginAt;

  const AppUser({
    required this.userId,
    required this.identityId,
    required this.email,
    required this.role,
    this.isActive = true,
    required this.createdAt,
    this.lastLoginAt,
  });

  bool get isSuperAdmin => role == UserRole.superAdmin;
  bool get isAdmin =>
      role == UserRole.admin ||
      role == UserRole.superAdmin ||
      role == UserRole.director;

  @override
  List<Object?> get props => [
        userId,
        identityId,
        email,
        role,
        isActive,
        createdAt,
        lastLoginAt,
      ];
}

/// Fan (subject) entity'si.
class Subject extends Equatable {
  final String subjectId;
  final String name;
  final String? code;
  final String? color;
  final bool isActive;

  const Subject({
    required this.subjectId,
    required this.name,
    this.code,
    this.color,
    this.isActive = true,
  });

  @override
  List<Object?> get props => [subjectId, name, code, color, isActive];
}
