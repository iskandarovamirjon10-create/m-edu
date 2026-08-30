/// Hikvision IP kamera ulanish sozlamalari.
///
/// Oddiy Hikvision kamera: `rtsp://admin:parol@IP:554/Streaming/Channels/101`
/// (101 = 1-kanal asosiy oqim, 102 = sub oqim).
///
/// Hikvision bo'lmagan kameralar (Dahua, TP-Link, Reolink va h.k.) uchun
/// [rtspPath] orqali maxsus RTSP yo'li ko'rsatiladi:
/// - Dahua: `/cam/realmonitor?channel=1&subtype=0`
/// - TP-Link Tapo: `/stream1` yoki `/h264`
/// - Reolink: `/h264Preview_01_main`
/// - ONVIF: `/onvif1`
class HikvisionCameraConfig {
  final String ip;
  final int port;
  final String username;
  final String password;

  /// Kanal raqami (1 dan boshlanadi) — Hikvision standart yo'li uchun.
  final int channel;

  /// Maxsus RTSP yo'li (bo'sh bo'lsa Hikvision standarti ishlatiladi).
  final String? rtspPath;

  const HikvisionCameraConfig({
    required this.ip,
    this.port = 554,
    this.username = 'admin',
    this.password = '',
    this.channel = 1,
    this.rtspPath,
  });

  bool get isValid =>
      ip.isNotEmpty && username.isNotEmpty && channel >= 1;

  /// Kanal uchun "10x" raqam: kanal 1 → 101 (asosiy oqim).
  int get channelCode => (channel * 100) + 1;

  /// Hikvision standart RTSP yo'li (maxsus yo'l ko'rsatilmaganda).
  String get _defaultPath => '/Streaming/Channels/$channelCode';

  /// Ishlatiladigan RTSP yo'li.
  String get effectivePath {
    final custom = rtspPath?.trim() ?? '';
    if (custom.isEmpty) return _defaultPath;
    // Foydalanuvchi yo'l boshiga "/" qo'ymagan bo'lishi mumkin.
    return custom.startsWith('/') ? custom : '/$custom';
  }

  /// RTSP oqim URL'i (media_kit orqali ko'rsatish uchun).
  String get rtspUrl =>
      'rtsp://$username:$password@$ip:$port$effectivePath';

  /// ISAPI HTTP snapshot URL'i (digest auth bilan kadr olish uchun).
  /// Hikvision standart yo'li ishlatiladi (ISAPI Hikvision'ga xos).
  String get snapshotUrl =>
      'http://$ip:$port/ISAPI/Streaming/channels/$channelCode/picture';
}
