import 'dart:typed_data';

import 'package:http_auth/http_auth.dart';

import 'hikvision_camera_config.dart';

/// Hikvision ISAPI HTTP snapshot orqali kadr olish (fallback).
///
/// RTSP oqim ochilmagan yoki `player.screenshot()` ishlamagan
/// hollarda kamera snapshot'idan JPEG olinadi. Digest auth ishlatiladi.
class SnapshotService {
  /// Kamera snapshot'ini qaytaradi (JPEG baytlari).
  /// Muvaffaqiyatsiz bo'lsa — null.
  Future<Uint8List?> fetchSnapshot(HikvisionCameraConfig config) async {
    if (!config.isValid) return null;
    try {
      final client = DigestAuthClient(config.username, config.password);
      final uri = Uri.parse(config.snapshotUrl);
      final response = await client.get(uri);
      if (response.statusCode == 200) {
        return response.bodyBytes;
      }
      return null;
    } catch (_) {
      return null;
    }
  }
}
