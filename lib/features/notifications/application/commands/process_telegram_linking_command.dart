import '../../../students/domain/repositories/student_repository.dart';
import '../../domain/repositories/telegram_linking_token_repository.dart';

/// Telegram bog'lash natijasi.
class ProcessLinkingResult {
  /// Muvaffaqiyatli bog'landimi.
  final bool success;

  /// Xabar (foydalanuvchiga ko'rsatiladigan).
  final String message;

  /// Talaba ismi (muvaffaqiyatli bo'lsa).
  final String? studentName;

  const ProcessLinkingResult({
    required this.success,
    required this.message,
    this.studentName,
  });
}

/// Telegram botidan `/start <token>` so'rovini qayta ishlaydi.
///
/// Token tekshiriladi, Telegram chat ID bog'lanadi, talaba profiliga
/// parentTelegramId yoziladi.
class ProcessTelegramLinkingCommand {
  final TelegramLinkingTokenRepository _tokenRepository;
  final StudentRepository _studentRepository;

  ProcessTelegramLinkingCommand({
    required TelegramLinkingTokenRepository tokenRepository,
    required StudentRepository studentRepository,
  })  : _tokenRepository = tokenRepository,
        _studentRepository = studentRepository;

  Future<ProcessLinkingResult> execute({
    required String token,
    required String telegramChatId,
    String? telegramUsername,
  }) async {
    // Token formatini tekshirish.
    if (token.isEmpty || token.length < 32) {
      return const ProcessLinkingResult(
        success: false,
        message: 'Noto\'g\'ri format. Botga /start TOKEN shaklida yozing.',
      );
    }

    // Tokenni bazadan qidirish.
    final linkingToken = await _tokenRepository.findByToken(token);
    if (linkingToken == null) {
      return const ProcessLinkingResult(
        success: false,
        message: 'Token topilmadi. Yangi token olish uchun M-EDU ilovasiga qarang.',
      );
    }

    // Token allaqachon ishlatilganmi?
    if (linkingToken.used) {
      return const ProcessLinkingResult(
        success: false,
        message: 'Token allaqachon ishlatilgan. Yangi token olish uchun M-EDU ilovasiga qarang.',
      );
    }

    // Token muddati tugaganmi?
    if (linkingToken.isExpired) {
      return const ProcessLinkingResult(
        success: false,
        message: 'Token muddati tugagan. Yangi token olish uchun M-EDU ilovasiga qarang.',
      );
    }

    // Token ishlatildi deb belgilash.
    await _tokenRepository.markUsed(
      token,
      telegramChatId: telegramChatId,
      telegramUsername: telegramUsername,
    );

    // Talaba profiliga parentTelegramId yozish.
    final student = await _studentRepository.fetchByIdentityId(
      linkingToken.studentIdentityId,
    );

    if (student == null) {
      return const ProcessLinkingResult(
        success: false,
        message: 'Talaba topilmadi. M-EDU administratori bilan bog\'laning.',
      );
    }

    // Ota-ona Telegram chat ID'sini saqlash.
    await _studentRepository.updateParentInfo(
      student.identityId,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      parentTelegramId: telegramChatId,
    );

    final studentName = student.parentName ?? 'Talaba';

    return ProcessLinkingResult(
      success: true,
      message: 'Muvaffaqiyatli bog\'landi! Endi oylik hisobotlar shu yerga yuboriladi.',
      studentName: studentName,
    );
  }
}
