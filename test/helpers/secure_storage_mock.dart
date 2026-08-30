import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// flutter_secure_storage'ni in-memory mock qiladi (AUDIT P2-02).
///
/// LocalAuthStore va SessionManager FlutterSecureStorage'ga tayanadi —
/// testlarda haqiqiy platform channel bo'lmaydi, shuning uchun
/// `setMockMethodCallHandler` bilan in-memory ombor ishlatiladi.
final Map<String, String> secureStorageMock = {};

/// Secure storage channel'ini mock qiladi (har test `setUp`da chaqiriladi).
void mockSecureStorageChannel() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(channel, (call) async {
    switch (call.method) {
      case 'read':
        return secureStorageMock[call.arguments['key'] as String];
      case 'write':
        secureStorageMock[call.arguments['key'] as String] =
            call.arguments['value'] as String;
        return null;
      case 'delete':
        secureStorageMock.remove(call.arguments['key'] as String);
        return null;
      case 'deleteAll':
        secureStorageMock.clear();
        return null;
      case 'containsKey':
        return secureStorageMock.containsKey(call.arguments['key'] as String);
    }
    return null;
  });
}
