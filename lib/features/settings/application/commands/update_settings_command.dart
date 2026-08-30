import '../../../../core/error/failures.dart';
import '../../../../core/security/permissions.dart';
import '../../../audit/application/services/audit_service.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../domain/entities/app_settings.dart';
import '../../domain/repositories/settings_repository.dart';

/// Ilova sozlamalarini yangilash uchun command.
class UpdateSettingsCommand {
  final SettingsRepository _repository;
  final AuditService? _audit;

  /// RBAC (§32): faqat admin/superAdmin sozlamalarni o'zgartira oladi.
  final UserRole actorRole;

  UpdateSettingsCommand({
    required SettingsRepository repository,
    AuditService? auditService,
    // AUDIT P2-02 (FAIL CLOSED): actor berilmasa — DENY (admin emas!).
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _audit = auditService;

  Future<AppSettings> execute(AppSettings newSettings) async {
    // RBAC: ruxsat application layer'da tekshiriladi.
    Permissions.require(actorRole, AppPermission.settingsEdit);

    // Til validatsiyasi (Phase 4 — "uz default" kafolati): faqat uz/ru/en
    // qabul qilinadi. Legacy/buzilgan qiymatlar DB'ga yozilmaydi — o'qish
    // chegarasi esa noto'g'ri qiymatni 'uz'ga normallashtiradi.
    if (!AppSettings.supportedLanguages.contains(newSettings.language)) {
      throw const ValidationFailure(
        "Til noto'g'ri — faqat 'uz', 'ru' yoki 'en' qo'llab-quvvatlanadi",
      );
    }

    // Glass intensity 0-100 oralig'ida bo'lishi kerak.
    if (newSettings.glassIntensity < 0 || newSettings.glassIntensity > 100) {
      throw const ValidationFailure(
        "Glass intensity 0-100 oralig'ida bo'lishi kerak",
      );
    }

    // Backup interval kamida 1 kun bo'lishi kerak.
    if (newSettings.backupIntervalDays < 1) {
      throw const ValidationFailure(
        "Backup davri kamida 1 kun bo'lishi kerak",
      );
    }

    // Kamera port va kanal validatsiyasi.
    if (newSettings.hikvisionPort < 1 || newSettings.hikvisionPort > 65535) {
      throw const ValidationFailure('Kamera porti 1-65535 oralig\'ida bo\'lishi kerak');
    }
    if (newSettings.hikvisionChannel < 1 || newSettings.hikvisionChannel > 32) {
      throw const ValidationFailure('Kamera kanali 1-32 oralig\'ida bo\'lishi kerak');
    }
    if (newSettings.hikvisionEnabled &&
        (newSettings.hikvisionIp == null ||
            newSettings.hikvisionIp!.trim().isEmpty)) {
      throw const ValidationFailure('Kamera IP manzili kiritilishi shart');
    }
    if (newSettings.scanIntervalMs < 300) {
      throw const ValidationFailure('Skanlash oralig\'i kamida 300 ms bo\'lishi kerak');
    }

    // Face ID chegara qiymatlari validatsiyasi.
    if (newSettings.matchThreshold < 0.5 || newSettings.matchThreshold > 1.0) {
      throw const ValidationFailure('Moslik chegarasi 0.5-1.0 oralig\'ida bo\'lishi kerak');
    }
    if (newSettings.ambiguousThreshold < 0.3 ||
        newSettings.ambiguousThreshold >= newSettings.matchThreshold) {
      throw const ValidationFailure(
        'Noaniq zona chegarasi moslik chegarasidan past bo\'lishi kerak',
      );
    }

    // Telegram bot token validatsiyasi (agar kiritilgan bo'lsa).
    final token = newSettings.telegramBotToken?.trim() ?? '';
    if (token.isNotEmpty && !token.contains(':')) {
      throw const ValidationFailure(
        "Telegram bot token noto'g'ri — BotFather'dan olingan to'liq tokenni kiriting",
      );
    }

    final saved = await _repository.saveSettings(newSettings);

    await _audit?.record(
      action: AuditAction.settingsChanged,
      targetType: 'settings',
      targetId: 'app',
      details: 'Sozlamalar yangilandi',
    );

    return saved;
  }
}
