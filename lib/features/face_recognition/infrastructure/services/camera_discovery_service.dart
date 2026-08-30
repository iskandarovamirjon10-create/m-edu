import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

/// LAN'dagi IP kameralarni avtomatik qidiruvchi xizmat.
///
/// Nega kerak? Oddiy foydalanuvchi kamerasining IP manzilini bilmaydi —
/// bu Face ID sozlashdagi eng katta to'siq. Bu xizmat telefon birikkan
/// Wi-Fi tarmog'ini skanlab, kameralarni o'zi topib beradi.
///
/// Qidiruv ikki bosqichda amalga oshiriladi:
/// 1. **ONVIF WS-Discovery** (UDP multicast 239.255.255.250:3702) — deyarli
///    barcha zamonaviy IP kameralar (Hikvision, Dahua, TP-Link, Reolink va
///    boshqalar) qo'llab-quvvatlaydigan standart protokol. Kamera o'z IP
///    manzilini o'zi e'lon qiladi.
/// 2. **TCP port skanlash** — ONVIF javob bermagan (masalan, ONVIF o'chirilgan
///    yoki eski) kameralar uchun tarmoqdagi har bir IP'da keng tarqalgan
///    kamera portlari (RTSP 554/8554, Hikvision 8000, ONVIF 80/8899 va h.k.)
///    ochiqligi tekshiriladi.
class CameraDiscoveryService {
  /// TCP orqali tekshiriladigan kamera portlari.
  ///
  /// 554 — RTSP (standart), 8554 — RTSP alt (TP-Link/Reolink),
  /// 8000 — Hikvision SDK, 80 — HTTP/ONVIF, 8899 — ONVIF (Hikvision),
  /// 8080 — HTTP alt, 34567 — Dahua HTTP, 37777 — Dahua SDK,
  /// 443 — HTTPS/ONVIF, 9000 — RTSP alt (ba'zi brendlar).
  static const List<int> _probePorts = [
    554, 8554, 8000, 80, 8899, 8080, 34567, 37777, 443, 9000,
  ];

  /// Bitta IP uchun maksimal kutish vaqti (har bir port uchun).
  static const Duration _perProbeTimeout = Duration(milliseconds: 300);

  /// Bir vaqtda nechta IP tekshiriladi.
  static const int _concurrency = 40;

  /// ONVIF WS-Discovery multicast manzili va porti.
  static const String _onvifMulticastAddress = '239.255.255.250';
  static const int _onvifPort = 3702;

  /// ONVIF javoblarini kutish vaqti.
  static const Duration _onvifWait = Duration(seconds: 3);

  /// Tarmoqdagi kameralarni qidiradi.
  ///
  /// [onProgress] — skanlash jarayoni uchun callback: (tekshirilgan,
  /// jami). Topilgan kamera IP manzillari ro'yxati qaytariladi.
  Future<List<String>> discover({
    void Function(int checked, int total)? onProgress,
  }) async {
    // 1) ONVIF WS-Discovery — kameralar o'zlarini e'lon qiladi (tez va aniq).
    final onvifIps = await _discoverOnvif();

    // 2) TCP port skanlash — qolgan (ONVIF'siz) kameralar uchun.
    final candidates = await _subnetCandidates();
    final found = <String>{...onvifIps};

    if (candidates.isNotEmpty) {
      final total = candidates.length;
      for (var i = 0; i < total; i += _concurrency) {
        final end = (i + _concurrency < total) ? i + _concurrency : total;
        final batch = candidates.sublist(i, end);
        final results =
            await Future.wait(batch.map((ip) => _isCamera(ip)).toList());
        for (var j = 0; j < batch.length; j++) {
          if (results[j]) found.add(batch[j]);
        }
        onProgress?.call(end, total);
      }
    }

    return found.toList();
  }

  /// ONVIF WS-Discovery orqali kameralarni topadi.
  ///
  /// UDP multicast'ga Probe so'rovi yuboriladi; ONVIF qo'llab-quvvatlovchi
  /// kameralar o'z XAddrs (IP manzil) ma'lumotlari bilan javob beradi.
  /// Bu usul TCP skanlashga qaraganda tezroq va aniqroq — kamera modeli
  /// va portidan qat'i nazar topadi.
  Future<List<String>> _discoverOnvif() async {
    final results = <String>{};
    RawDatagramSocket? socket;
    try {
      socket = await RawDatagramSocket.bind(InternetAddress.anyIPv4, 0);
      socket.multicastHops = 1;
      socket.broadcastEnabled = true;

      final messageId = _randomUuid();
      final probe = '''
<?xml version="1.0" encoding="UTF-8"?>
<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope"
  xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"
  xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"
  xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
  <e:Header>
    <w:MessageID>uuid:$messageId</w:MessageID>
    <w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>
    <w:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>
  </e:Header>
  <e:Body>
    <d:Probe>
      <d:Types>dn:NetworkVideoTransmitter</d:Types>
    </d:Probe>
  </e:Body>
</e:Envelope>''';

      final multicastAddress = InternetAddress(_onvifMulticastAddress);
      socket.send(utf8.encode(probe), multicastAddress, _onvifPort);
      // Broadcast ham yuboramiz — ba'zi router'lar multicast'ni bloklaydi.
      socket.send(utf8.encode(probe), InternetAddress('255.255.255.255'),
          _onvifPort);

      // Javoblar kelishini kutamiz: listener orqali paketlarni yig'amiz.
      // RawDatagramSocket stream'i hech qachon yopilmaydi — shuning uchun
      // `await for` ishlatmaymiz, balki [Future.any] bilan kutamiz.
      final socketRef = socket;
      final completer = Completer<void>();
      final subscription = socketRef.listen((event) {
        if (event != RawSocketEvent.read) return;
        final datagram = socketRef.receive();
        if (datagram == null) return;
        final body = utf8.decode(datagram.data, allowMalformed: true);
        if (!body.contains('ProbeMatches')) return;
        results.addAll(_extractXAddrsIps(body));
        if (results.length >= 20 && !completer.isCompleted) {
          completer.complete();
        }
      });
      await Future.any<void>([
        completer.future,
        Future<void>.delayed(_onvifWait),
      ]);
      await subscription.cancel();
    } catch (_) {
      // Multicast qo'llab-quvvatlanmasa yoki tarmoq bloklasa — TCP
      // skanlash bilan davom etamiz, xato tashlamaymiz.
    } finally {
      socket?.close();
    }
    return results.toList();
  }

  /// ONVIF javobidagi XAddrs'lardan IP manzillarni ajratib oladi.
  ///
  /// Misol: `<d:XAddrs>http://192.168.1.64/onvif/device_service</d:XAddrs>`
  /// yoki `https://192.168.1.64:8443/onvif/device_service`.
  List<String> _extractXAddrsIps(String body) {
    final ips = <String>{};
    final pattern = RegExp(
      r'<[^>]*XAddrs[^>]*>([^<]*)</[^>]*>',
      caseSensitive: false,
    );
    for (final m in pattern.allMatches(body)) {
      final urls = (m.group(1) ?? '').trim();
      // XAddrs ichida bir nechta URL bo'lishi mumkin (probel bilan ajratilgan).
      for (final url in urls.split(RegExp(r'\s+'))) {
        if (url.isEmpty) continue;
        final uri = Uri.tryParse(url);
        if (uri == null || uri.host.isEmpty) continue;
        // Link-local manzillarni tashlaymiz.
        if (uri.host.startsWith('169.254.')) continue;
        ips.add(uri.host);
      }
    }
    return ips.toList();
  }

  String _randomUuid() {
    final random = Random();
    final hex = List.generate(16, (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
        '${hex.substring(20)}';
  }

  /// RTSP yoki kamera'ga xos SDK portlari — ochiq bo'lsa kamera degani.
  static bool _isCameraSpecificPort(int port) =>
      port == 554 || // RTSP
      port == 8554 || // RTSP alt
      port == 9000 || // RTSP alt (ba'zi brendlar)
      port == 8000 || // Hikvision SDK
      port == 34567 || // Dahua HTTP
      port == 37777 || // Dahua SDK
      port == 8899; // ONVIF (Hikvision va boshqalar)

  /// Berilgan IP kamera ekanligini tekshiradi.
  ///
  /// RTSP/kamera'ga xos portlar ochiq bo'lsa — darhol kamera deb hisoblaymiz.
  /// Faqat umumiy HTTP portlari (80/443/8080) ochiq bo'lsa, bu router yoki
  /// kompyuter bo'lishi mumkin — ONVIF so'rovi bilan tasdiqlaymiz (noto'g'ri
  /// pozitivlarni oldini olish uchun).
  Future<bool> _isCamera(String ip) async {
    var hasHttpLike = false;
    for (final port in _probePorts) {
      if (_isCameraSpecificPort(port)) {
        try {
          final socket = await Socket.connect(ip, port,
              timeout: _perProbeTimeout);
          socket.destroy();
          return true;
        } catch (_) {
          // keyingi portni sinab ko'ramiz
        }
      } else {
        try {
          final socket = await Socket.connect(ip, port,
              timeout: _perProbeTimeout);
          socket.destroy();
          hasHttpLike = true;
        } catch (_) {}
      }
    }
    // Faqat HTTP portlari ochiq — ONVIF javobi bilan tasdiqlash kerak
    // (aks holda router/kompyuter ham "kamera" bo'lib chiqadi).
    if (hasHttpLike) {
      return _isOnvifDevice(ip);
    }
    return false;
  }

  /// HTTP orqali ONVIF ekanligini tekshiradi.
  ///
  /// Kameralar odatda `/onvif/device_service` manzilida ONVIF xizmatini
  /// ko'rsatadi — javobda "onvif" belgisi bo'lsa, qurilma kamera.
  Future<bool> _isOnvifDevice(String ip) async {
    final client = HttpClient()..connectionTimeout = _perProbeTimeout;
    try {
      for (final port in [80, 8080, 443]) {
        final scheme = port == 443 ? 'https' : 'http';
        try {
          final request = await client
              .getUrl(Uri.parse('$scheme://$ip:$port/onvif/device_service'))
              .timeout(_perProbeTimeout);
          final response = await request.close().timeout(_perProbeTimeout);
          final body = await response
              .transform(utf8.decoder)
              .join()
              .timeout(_perProbeTimeout);
          if (body.toLowerCase().contains('onvif')) return true;
        } catch (_) {
          // keyingi portni sinab ko'ramiz
        }
      }
    } finally {
      client.close(force: true);
    }
    return false;
  }

  /// Telefon birikkan LAN tarmog'idagi barcha IP-larni hisoblaydi.
  ///
  /// Faqat xususiy tarmoq (192.168.x / 10.x / 172.16-31.x) manzillari
  /// ishlatiladi — 4G/5G orqali turilsa tarmoq topilmaydi va bo'sh
  /// ro'yxat qaytariladi (foydalanuvchiga Wi-Fi kerakligi ko'rsatiladi).
  Future<List<String>> _subnetCandidates() async {
    try {
      final interfaces = await NetworkInterface.list(
        includeLinkLocal: false,
        includeLoopback: false,
        type: InternetAddressType.IPv4,
      );
      final candidateSets = <Set<String>>{};
      for (final iface in interfaces) {
        for (final addr in iface.addresses) {
          final ip = addr.address;
          if (!_isPrivateLan(ip)) continue;
          final parts = ip.split('.');
          final base = '${parts[0]}.${parts[1]}.${parts[2]}.';
          final candidates = <String>{};
          for (var i = 1; i <= 254; i++) {
            final candidate = '$base$i';
            if (candidate != ip) candidates.add(candidate);
          }
          candidateSets.add(candidates);
        }
      }
      // Barcha tarmoqlardagi nomzodlarni birlashtiramiz (duplikatsiz).
      final merged = <String>{};
      for (final set in candidateSets) {
        merged.addAll(set);
      }
      return merged.toList();
    } catch (_) {
      // tarmoq ma'lumotlari olinmadi — skanlash mumkin emas
    }
    return [];
  }

  bool _isPrivateLan(String ip) {
    final parts = ip.split('.');
    if (parts.length != 4) return false;
    final first = int.tryParse(parts[0]) ?? -1;
    final second = int.tryParse(parts[1]) ?? -1;
    if (first == 10) return true;
    if (first == 192 && second == 168) return true;
    if (first == 172 && second >= 16 && second <= 31) return true;
    return false;
  }
}
