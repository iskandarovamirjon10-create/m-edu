import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/face_recognition/infrastructure/services/hikvision_camera_config.dart';
import 'package:m_edu/features/face_recognition/presentation/providers/face_recognition_providers.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';
import 'package:m_edu/features/settings/presentation/providers/settings_providers.dart';

/// P0 (FACE-01): bo'sh username `''` bilan `?? 'admin'` fallback ishlamay
/// qolardi (`??` faqat null uchun) — RTSP URL `rtsp://:@IP/...` bo'lib,
/// kamera autentifikatsiya qilolmasdi. Fix: bo'sh string → 'admin'.
void main() {
  /// Provider'lar async bo'lgani uchun `hikvisionConfigProvider`'ni
  /// o'qishdan OLDIN settings future'ini kutamiz — aks holda
  /// `valueOrNull` hali null bo'lib, config ham null qaytadi.
  Future<ProviderContainer> containerWith(AppSettings settings) async {
    final container = ProviderContainer(
      overrides: [
        appSettingsProvider.overrideWith((ref) async => settings),
      ],
    );
    addTearDown(container.dispose);
    await container.read(appSettingsProvider.future);
    return container;
  }

  group('hikvisionConfigProvider (FACE-01)', () {
    test('username null → admin fallback ishlaydi', () async {
      final container = await containerWith(
        const AppSettings(
          hikvisionEnabled: true,
          hikvisionIp: '192.168.1.64',
          hikvisionUsername: null,
        ),
      );
      final config = container.read(hikvisionConfigProvider);
      expect(config, isNotNull);
      expect(config!.username, 'admin');
      expect(config.isValid, isTrue);
    });

    test('username bo\'sh string → admin fallback ishlaydi (P0 fix)', () async {
      final container = await containerWith(
        const AppSettings(
          hikvisionEnabled: true,
          hikvisionIp: '192.168.1.64',
          hikvisionUsername: '', // Real qurilmada aynan shu holat bor edi.
        ),
      );
      final config = container.read(hikvisionConfigProvider);
      expect(config, isNotNull);
      expect(config!.username, 'admin');
      expect(config.isValid, isTrue);
      expect(config.rtspUrl, startsWith('rtsp://admin:'));
    });

    test('username bo\'shliqlar bilan → trim + admin', () async {
      final container = await containerWith(
        const AppSettings(
          hikvisionEnabled: true,
          hikvisionIp: '192.168.1.64',
          hikvisionUsername: '   ',
        ),
      );
      final config = container.read(hikvisionConfigProvider);
      expect(config!.username, 'admin');
    });

    test('haqiqiy username saqlanadi', () async {
      final container = await containerWith(
        const AppSettings(
          hikvisionEnabled: true,
          hikvisionIp: '192.168.1.64',
          hikvisionUsername: 'admin',
        ),
      );
      final config = container.read(hikvisionConfigProvider);
      expect(config!.username, 'admin');
      expect(config.isValid, isTrue);
    });

    test('IP bo\'sh bo\'lsa config null (kamera yo\'q)', () async {
      final container = await containerWith(
        const AppSettings(hikvisionEnabled: true, hikvisionIp: ''),
      );
      expect(container.read(hikvisionConfigProvider), isNull);
    });

    test('hikvisionEnabled=false bo\'lsa config null', () async {
      final container = await containerWith(
        const AppSettings(
          hikvisionEnabled: false,
          hikvisionIp: '192.168.1.64',
        ),
      );
      expect(container.read(hikvisionConfigProvider), isNull);
    });
  });

  group('HikvisionCameraConfig', () {
    test('isValid — bo\'sh username bilan false', () {
      const config = HikvisionCameraConfig(
        ip: '192.168.1.64',
        username: '',
      );
      expect(config.isValid, isFalse);
    });

    test('isValid — to\'liq konfiguratsiya true', () {
      const config = HikvisionCameraConfig(
        ip: '192.168.1.64',
        username: 'admin',
      );
      expect(config.isValid, isTrue);
    });

    test('rtspUrl to\'g\'ri quriladi (default path)', () {
      const config = HikvisionCameraConfig(
        ip: '192.168.1.64',
        username: 'admin',
        password: 'secret',
      );
      expect(
        config.rtspUrl,
        'rtsp://admin:secret@192.168.1.64:554/Streaming/Channels/101',
      );
    });

    test('custom rtspPath ishlatiladi', () {
      const config = HikvisionCameraConfig(
        ip: '192.168.1.64',
        username: 'admin',
        rtspPath: '/stream1',
      );
      expect(config.rtspUrl, 'rtsp://admin:@192.168.1.64:554/stream1');
    });
  });
}
