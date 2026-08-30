import 'dart:typed_data';

import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';

import '../../../../core/services/app_logger.dart';

/// Hikvision RTSP oqimini ko'rsatish va kadr olish xizmati (media_kit).
///
/// [grabFrame] — joriy kadrni JPEG shaklida qaytaradi (ML Kit uchun).
class CameraStreamService {
  late final Player _player;
  late final VideoController _controller;

  CameraStreamService() {
    _player = Player();
    _controller = VideoController(_player);
  }

  Player get player => _player;

  VideoController get videoController => _controller;

  bool _opened = false;

  static bool _ensureInitializedOnce = false;

  /// media_kit natif kutubxonasini bir marta ishga tushiradi.
  static void ensureInitialized() {
    if (!_ensureInitializedOnce) {
      MediaKit.ensureInitialized();
      _ensureInitializedOnce = true;
    }
  }

  /// RTSP oqimini ochadi.
  ///
  /// 10 soniyalik timeout — noto'g'ri IP yoki o'chirilgan kamera bilan
  /// `open()` abadiy kutib qolib, UI "ulanmoqda" holatida qotib qolmasin.
  Future<void> open(String rtspUrl) async {
    if (_opened) return;
    await _player.open(Media(rtspUrl), play: true)
        .timeout(const Duration(seconds: 10));
    _opened = true;
  }

  /// Joriy kadrni JPEG baytlarida qaytaradi (null — hali kadr yo'q).
  ///
  /// Xatolik yuz berganda xatolik turini log qiladi (rasm yoki biometrik
  /// ma'lumot emas — faqat xatolik turi).
  Future<Uint8List?> grabFrame() async {
    if (!_opened) return null;
    try {
      return await _player.screenshot(format: 'image/jpeg');
    } catch (e) {
      AppLogger.warning('CameraStreamService: grabFrame failed (${e.runtimeType})');
      return null;
    }
  }

  Future<void> dispose() async {
    try {
      await _player.dispose();
    } catch (_) {
      // oqim allaqachon yopilgan bo'lishi mumkin
    }
  }
}
