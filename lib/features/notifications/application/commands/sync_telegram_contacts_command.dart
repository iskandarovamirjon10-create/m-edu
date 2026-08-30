import '../../../../core/error/failures.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../../../features/settings/domain/repositories/settings_repository.dart';
import '../../../../features/students/domain/repositories/student_repository.dart';
import '../../../../features/students/domain/entities/student.dart';
import '../../../notifications/infrastructure/services/telegram_service.dart';

/// Telefon raqam → Telegram chat ID bog'lash natijasi.
class SyncTelegramContactsResult {
  /// Yangi bog'langan ota-onalar soni.
  final int linked;

  /// Telegram'da topilgan, lekin tizimdagi o'quvchi raqamiga mos kelmaganlar.
  final int unmatched;

  const SyncTelegramContactsResult({this.linked = 0, this.unmatched = 0});
}

/// Ota-onalarni Telegram bilan bog'lash.
///
/// Ota-ona botga o'z **telefon raqamini** xabar sifatida yuboradi
/// (masalan `+998901234567`). Ushbu komanda botning getUpdates
/// tarixini o'qib, raqamni o'quvchi profilidagi ota-ona telefoniga
/// moslashtiradi va chat ID'ni saqlaydi. Shundan so'ng oylik hisobot
/// shu chatga yuboriladi.
class SyncTelegramContactsCommand {
  final SettingsRepository _settingsRepository;
  final StudentRepository _studentRepository;
  final TelegramService _telegramService;

  /// RBAC (AUDIT P2-02): Telegram sozlamalari.
  final UserRole actorRole;

  SyncTelegramContactsCommand({
    required SettingsRepository settingsRepository,
    required StudentRepository studentRepository,
    required TelegramService telegramService,
    this.actorRole = UserRole.unknown,
  })  : _settingsRepository = settingsRepository,
        _studentRepository = studentRepository,
        _telegramService = telegramService;

  Future<SyncTelegramContactsResult> execute() async {
    Permissions.require(actorRole, AppPermission.telegramConfigure);

    final settings = await _settingsRepository.getSettings();
    final token = settings.telegramBotToken?.trim() ?? '';
    if (token.isEmpty) {
      throw const ValidationFailure(
        'Telegram bot token kiritilmagan — Settings → Oylik hisobot',
      );
    }

    final contacts = await _telegramService.fetchUpdates(token);
    final students = await _studentRepository.fetchAll();

    // Ota-ona telefon raqami → o'quvchi.
    final byPhone = <String, List<Student>>{};
    for (final student in students) {
      final phone = _normalizePhone(student.parentPhone);
      if (phone == null) continue;
      byPhone.putIfAbsent(phone, () => []).add(student);
    }

    var linked = 0;
    var unmatched = 0;
    final updatedIdentityIds = <String>{};

    for (final contact in contacts) {
      final contactPhone = _normalizePhone(contact.lastText);
      final matched = contactPhone == null ? null : byPhone[contactPhone];
      if (matched == null || matched.isEmpty) {
        // Kontakt bor, lekin raqam mos kelmadi (yoki raqam yuborilmagan).
        unmatched++;
        continue;
      }

      final student = matched.first;
      if (updatedIdentityIds.add(student.identityId)) {
        await _studentRepository.updateParentInfo(
          student.identityId,
          parentName: student.parentName,
          parentPhone: student.parentPhone,
          parentTelegramId: contact.chatId,
        );
        linked++;
      }
    }

    return SyncTelegramContactsResult(linked: linked, unmatched: unmatched);
  }

  /// Telefon raqamni taqqoslash uchun normallashtiradi:
  /// raqamlar qoldiriladi, oxirgi 9 ta raqam olinadi
  /// (998901234567 va +998 90 123 45 67 → 901234567).
  static String? _normalizePhone(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 9) return null;
    return digits.length > 9 ? digits.substring(digits.length - 9) : digits;
  }
}
