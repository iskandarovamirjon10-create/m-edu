class AppConstants {
  AppConstants._();

  static const String appName = 'M-Edu';
  static const String appVersion = '1.0.0';
  static const String appDescription = "Ta'lim Markazi Boshqaruvi Tizimi";

  /// Offline-first lokal baza nomi (Isar).
  static const String databaseName = 'm_edu';

  /// Firebase konfiguratsiyasi source code'da EMAS — qurilmadagi
  /// `m_edu_firebase.json` faylida saqlanadi (qarang:
  /// core/network/infrastructure/remote/firebase_bootstrap.dart).
  /// Fayl yo'q bo'lsa app offline-first ishlaydi; placeholder kalit
  /// ishlatilmaydi (hech qanday fake/demo kalit mavjud emas).

  static const String roleSuperAdmin = 'super_admin';
  static const String roleAdmin = 'admin';
  static const String roleTeacher = 'teacher';
  static const String roleStudent = 'student';

  static const String currency = 'UZS';
  static const String currencySymbol = "so'm";

  // AUDIT (M-EDU-DEAD-001): pageSize/defaultLimit/connectTimeout/…
  // hech qayerda ishlatilmasdi (dead constants). Tarmoq taym-autlari
  // xizmatlar ichida aniq belgilanadi (masalan TelegramService
  // `Dio(BaseOptions(...))`), pagination hozircha kerak emas.
}
