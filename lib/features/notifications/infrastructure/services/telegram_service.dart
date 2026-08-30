import 'package:dio/dio.dart';

/// Telegram bot bilan suhbatlashgan foydalanuvchi haqida ma'lumot
/// (getUpdates javobidan olinadi).
class TelegramChatContact {
  final String chatId;

  /// Foydalanuvchi ismi (agar botga ruxsat bergan bo'lsa).
  final String? firstName;

  /// Telegram username (agar mavjud bo'lsa).
  final String? username;

  /// Foydalanuvchining botga yuborgan oxirgi xabari matni.
  /// Telefon raqamni ulashda ishlatiladi (ota-ona raqamini yuboradi).
  final String? lastText;

  const TelegramChatContact({
    required this.chatId,
    this.firstName,
    this.username,
    this.lastText,
  });
}

/// Telegram Bot API bilan ishlaydigan xizmat.
///
/// Ota-onalarga oylik davomat hisobotini yuborish uchun ishlatiladi:
/// - [sendMessage] — chat_id ga xabar yuboradi;
/// - [fetchUpdates] — botga yozgan foydalanuvchilar ro'yxatini oladi
///   (telefon raqam → chat_id bog'lash uchun).
class TelegramService {
  TelegramService({Dio? dio})
      : _dio = dio ??
            Dio(
              BaseOptions(
                // Yuborish uzilib qolmasligi uchun HTTP taym-autlar.
                connectTimeout: const Duration(seconds: 10),
                receiveTimeout: const Duration(seconds: 15),
                sendTimeout: const Duration(seconds: 15),
              ),
            );

  final Dio _dio;

  static const String _apiBase = 'https://api.telegram.org';

  /// Bot token to'g'riligini tekshiradi (getMe).
  Future<bool> verifyBotToken(String botToken) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '$_apiBase/bot$botToken/getMe',
      );
      final ok = response.data?['ok'] == true;
      return ok && response.data?['result'] is Map<String, dynamic>;
    } catch (_) {
      return false;
    }
  }

  /// Berilgan chat_id ga matnli xabar yuboradi. Muvaffaqiyat — true.
  Future<bool> sendMessage({
    required String botToken,
    required String chatId,
    required String text,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '$_apiBase/bot$botToken/sendMessage',
        data: {
          'chat_id': chatId,
          'text': text,
          'disable_web_page_preview': true,
        },
      );
      return response.data?['ok'] == true;
    } catch (_) {
      return false;
    }
  }

  /// Botga oxirgi yozgan foydalanuvchilarni qaytaradi.
  /// Faqat `private` chatlar (shaxsiy suhbatlar) olinadi.
  Future<List<TelegramChatContact>> fetchUpdates(String botToken) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '$_apiBase/bot$botToken/getUpdates',
        queryParameters: {'timeout': 2},
      );
      final result = response.data?['result'];
      if (result is! List) return const [];

      final contacts = <TelegramChatContact>[];
      final seen = <String>{};
      for (final item in result) {
        if (item is! Map) continue;
        final message = item['message'];
        if (message is! Map) continue;
        final from = message['from'];
        final chat = message['chat'];
        if (from is! Map || chat is! Map) continue;
        if (chat['type'] != 'private') continue;

        final chatId = chat['id']?.toString();
        if (chatId == null || chatId.isEmpty) continue;
        if (!seen.add(chatId)) continue;

        contacts.add(
          TelegramChatContact(
            chatId: chatId,
            firstName: from['first_name']?.toString(),
            username: from['username']?.toString(),
            lastText: message['text']?.toString(),
          ),
        );
      }
      return contacts;
    } catch (_) {
      return const [];
    }
  }
}
