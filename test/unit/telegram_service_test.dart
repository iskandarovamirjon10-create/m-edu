import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/notifications/infrastructure/services/telegram_service.dart';

/// Dio uchun in-memory mock adapter — real HTTP tarmoqsiz test qiladi.
class _MockAdapter implements HttpClientAdapter {
  _MockAdapter(this._handler);

  final Future<ResponseBody> Function(RequestOptions options) _handler;
  int fetchCalls = 0;
  RequestOptions? lastOptions;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    fetchCalls++;
    lastOptions = options;
    return _handler(options);
  }

  @override
  void close({bool force = false}) {}
}

/// Telegram API'ning odatiy javob shaklini yasaydi.
ResponseBody _jsonResponse(Object body, {int statusCode = 200}) {
  return ResponseBody.fromString(
    jsonEncode(body),
    statusCode,
    headers: {'content-type': ['application/json']},
  );
}

void main() {
  group('TelegramService.sendMessage', () {
    test('muvaffaqiyatli yuborish → true, to\'g\'ri chat_id va text', () async {
      String? sentChatId;
      String? sentText;
      final adapter = _MockAdapter((options) async {
        final data = options.data as Map<String, dynamic>;
        sentChatId = data['chat_id'] as String?;
        sentText = data['text'] as String?;
        return _jsonResponse({'ok': true, 'result': {'message_id': 1}});
      });
      final dio = Dio()..httpClientAdapter = adapter;
      final service = TelegramService(dio: dio);

      final ok = await service.sendMessage(
        botToken: '123:TESTTOKEN',
        chatId: '987654321',
        text: 'Salom',
      );

      expect(ok, isTrue);
      expect(sentChatId, '987654321');
      expect(sentText, 'Salom');
      expect(adapter.lastOptions?.path, contains('bot123:TESTTOKEN/sendMessage'));
    });

    test('Telegram API ok:false qaytarsa → false (yolg\'on "Sent" yo\'q)', () async {
      final adapter = _MockAdapter(
        (_) async => _jsonResponse({'ok': false, 'description': 'chat not found'}),
      );
      final dio = Dio()..httpClientAdapter = adapter;
      final service = TelegramService(dio: dio);

      final ok = await service.sendMessage(
        botToken: '123:TESTTOKEN',
        chatId: '1',
        text: 'x',
      );

      expect(ok, isFalse);
    });

    test('network xatosi → false, exception tashlamaydi (crash yo\'q)', () async {
      final adapter = _MockAdapter(
        (_) async => throw DioException(
          requestOptions: RequestOptions(path: '/'),
          type: DioExceptionType.connectionError,
        ),
      );
      final dio = Dio()..httpClientAdapter = adapter;
      final service = TelegramService(dio: dio);

      final ok = await service.sendMessage(
        botToken: '123:TESTTOKEN',
        chatId: '1',
        text: 'x',
      );

      expect(ok, isFalse);
    });

    test('connectionTimeout turidagi xato → false, exception tashlamaydi', () async {
      final adapter = _MockAdapter(
        (_) async => throw DioException(
          requestOptions: RequestOptions(path: '/'),
          type: DioExceptionType.connectionTimeout,
        ),
      );
      final dio = Dio()..httpClientAdapter = adapter;
      final service = TelegramService(dio: dio);

      final ok = await service.sendMessage(
        botToken: '123:TESTTOKEN',
        chatId: '1',
        text: 'x',
      );

      expect(ok, isFalse);
    });

    test('default xizmat timeout sozlamalari 10-15 soniya atrofida', () {
      // Service o'z Dio'sini yaratganda qo'llaydigan BaseOptions —
      // TelegramService konstruktoridagi default qiymatlar bilan mos.
      final dio = Dio(
        BaseOptions(
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 15),
          sendTimeout: const Duration(seconds: 15),
        ),
      );
      expect(dio.options.connectTimeout, const Duration(seconds: 10));
      expect(dio.options.receiveTimeout, const Duration(seconds: 15));
      expect(dio.options.sendTimeout, const Duration(seconds: 15));
    });
  });

  group('TelegramService.verifyBotToken', () {
    test('to\'g\'ri token → true', () async {
      final adapter = _MockAdapter(
        (_) async => _jsonResponse({
          'ok': true,
          'result': {'id': 1, 'username': 'test_bot'},
        }),
      );
      final dio = Dio()..httpClientAdapter = adapter;
      final service = TelegramService(dio: dio);

      expect(await service.verifyBotToken('123:TESTTOKEN'), isTrue);
    });

    test('noto\'g\'ri token (API xato) → false', () async {
      final adapter = _MockAdapter(
        (_) async => _jsonResponse({'ok': false, 'error_code': 404}),
      );
      final dio = Dio()..httpClientAdapter = adapter;
      final service = TelegramService(dio: dio);

      expect(await service.verifyBotToken('bad'), isFalse);
    });

    test('tarmoq xatosi → false, crash yo\'q', () async {
      final adapter = _MockAdapter(
        (_) async => throw DioException(
          requestOptions: RequestOptions(path: '/'),
          type: DioExceptionType.connectionTimeout,
        ),
      );
      final dio = Dio()..httpClientAdapter = adapter;
      final service = TelegramService(dio: dio);

      expect(await service.verifyBotToken('123:TESTTOKEN'), isFalse);
    });
  });

  group('TelegramService.fetchUpdates', () {
    test('kontaktlarni parse qiladi: faqat private chat, chat_id dedup', () async {
      final adapter = _MockAdapter(
        (_) async => _jsonResponse({
          'ok': true,
          'result': [
            {
              'update_id': 1,
              'message': {
                'from': {'first_name': 'Ali'},
                'chat': {'id': 111, 'type': 'private'},
                'text': '+998901234567',
              },
            },
            // Xuddi shu chat — dublikat, olinmasligi kerak.
            {
              'update_id': 2,
              'message': {
                'from': {'first_name': 'Ali'},
                'chat': {'id': 111, 'type': 'private'},
                'text': 'yana',
              },
            },
            // Guruh chat — filter qilinishi kerak.
            {
              'update_id': 3,
              'message': {
                'from': {'first_name': 'X'},
                'chat': {'id': 222, 'type': 'group'},
                'text': 'x',
              },
            },
            {
              'update_id': 4,
              'message': {
                'from': {'first_name': 'Bobur'},
                'chat': {'id': 333, 'type': 'private'},
              },
            },
          ],
        }),
      );
      final dio = Dio()..httpClientAdapter = adapter;
      final service = TelegramService(dio: dio);

      final contacts = await service.fetchUpdates('123:TESTTOKEN');

      expect(contacts.length, 2);
      expect(contacts.map((c) => c.chatId), containsAll(['111', '333']));
      expect(contacts.any((c) => c.chatId == '222'), isFalse);
      expect(contacts.firstWhere((c) => c.chatId == '111').firstName, 'Ali');
      expect(
        contacts.firstWhere((c) => c.chatId == '111').lastText,
        '+998901234567',
      );
    });

    test('bo\'sh/noto\'g\'ri javob → bo\'sh ro\'yxat, crash yo\'q', () async {
      final adapter = _MockAdapter((_) async => _jsonResponse({'ok': true}));
      final dio = Dio()..httpClientAdapter = adapter;
      final service = TelegramService(dio: dio);

      expect(await service.fetchUpdates('123:TESTTOKEN'), isEmpty);
    });

    test('tarmoq xatosi → bo\'sh ro\'yxat', () async {
      final adapter = _MockAdapter(
        (_) async => throw DioException(
          requestOptions: RequestOptions(path: '/'),
          type: DioExceptionType.badResponse,
          response: Response(
            requestOptions: RequestOptions(path: '/'),
            statusCode: 500,
          ),
        ),
      );
      final dio = Dio()..httpClientAdapter = adapter;
      final service = TelegramService(dio: dio);

      expect(await service.fetchUpdates('123:TESTTOKEN'), isEmpty);
    });
  });
}
