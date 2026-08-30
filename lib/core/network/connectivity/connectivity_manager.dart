import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// M-EDU CONNECTIVITY MANAGER (ULTRA CORE §8-10)
///
/// Yagona tarmoq holati manbai. Ilova INTERNET'ga bog'liq bo'lmasligi
/// kerak — ko'p funksiyalar lokal (WiFi LAN / Ethernet) ishlaydi.
///
/// Connection classes (§8):
///   internet     — internetga ulangan (mobile/vpn/other)
///   wifi         — WiFi tarmog'ida (internet+LAN imkoniyati)
///   ethernet     — Ethernet tarmog'ida (internet+LAN imkoniyati)
///   lan          — lokal tarmoq ulanishi (WiFi/ethernet da mavjud)
///   localDevice  — bluetooth kabi mahalliy qurilma ulanishi
///   offline      — tarmoq yo'q (app to'liq ishlaydi — offline-first §6)
///
/// Qoidalar:
///   • Hech qachon crash qilmaydi (plugin xatosi → offline sifatida).
///   • Hech qachon cheksiz qayta urinish qilmaydi (stream pasiv kuzatuv).
///   • Test uchun [ConnectivityManager] manbasi almashtirilishi mumkin
///     ([source] parametri) — haqiqiy plugin'ga bog'liq emas.
///   • Web/desktop'da plugin qo'llab-quvvatlamasa ham xavfsiz fallback.
///
/// LAN/ethernet tafovuti: connectivity_plus wifi/ethernet farqlaydi;
/// "lan" esa wifi yoki ethernet mavjud bo'lganda mavjud deb hisoblanadi
/// (lokal tarmoq imkoniyati). Kerak bo'lsa [ConnectionStatus.isLanReady]
/// orqali tekshiriladi.
/// ═══════════════════════════════════════════════════════════════════════

/// Tarmoq ulanish sinfi (§8).
enum ConnectionClass {
  internet,
  wifi,
  ethernet,
  lan,
  localDevice,
  offline;

  /// WiFi/ethernet — lokal tarmoq (LAN) imkoniyati mavjud.
  bool get isLanReady => this == ConnectionClass.wifi ||
      this == ConnectionClass.ethernet ||
      this == ConnectionClass.lan;

  /// Internet mavjudmi (offline emas).
  bool get isOnline => this != ConnectionClass.offline;
}

/// Joriy ulanish holati.
@immutable
class ConnectionStatus {
  final ConnectionClass connectionClass;
  final DateTime changedAt;

  /// Tafsilot (diagnostika uchun — masalan 'wifi'/'ethernet').
  final String detail;

  const ConnectionStatus({
    required this.connectionClass,
    required this.changedAt,
    this.detail = '',
  });

  bool get isOnline => connectionClass.isOnline;
  bool get isOffline => connectionClass == ConnectionClass.offline;
  bool get isLanReady => connectionClass.isLanReady;

  /// OFFLINE boshlang'ich holat — tarmoq hali aniqlanmagan.
  static ConnectionStatus unknown() =>
      ConnectionStatus(connectionClass: ConnectionClass.offline, changedAt: DateTime.fromMillisecondsSinceEpoch(0));

  ConnectionStatus copyWith({ConnectionClass? connectionClass, DateTime? changedAt, String? detail}) =>
      ConnectionStatus(
        connectionClass: connectionClass ?? this.connectionClass,
        changedAt: changedAt ?? this.changedAt,
        detail: detail ?? this.detail,
      );

  @override
  bool operator ==(Object other) =>
      other is ConnectionStatus &&
      other.connectionClass == connectionClass &&
      other.changedAt == changedAt;

  @override
  int get hashCode => Object.hash(connectionClass, changedAt);
}

/// Tarmoq holatini kuzatuvchi yagona xizmat.
///
/// [Connectivity().onConnectivityChanged] stream'ini kuzatadi va
/// [ConnectionStatus]'ga o'giradi. `dispose()` da subscription yopiladi
/// (stream safety §41). Xatoliklar yutiladi — hech qachon rethrow.
class ConnectivityManager {
  /// Test uchun almashtiriladigan manba. Default: connectivity_plus.
  final Stream<List<ConnectivityResult>> Function() _source;

  StreamSubscription<List<ConnectivityResult>>? _subscription;

  final _controller = StreamController<ConnectionStatus>.broadcast();

  ConnectionStatus _current = ConnectionStatus.unknown();

  ConnectivityManager({
    Stream<List<ConnectivityResult>> Function()? source,
  }) : _source = source ?? (() => Connectivity().onConnectivityChanged);

  /// Joriy holat.
  ConnectionStatus get current => _current;

  /// Holat oqimi — har o'zgarishda yangi [ConnectionStatus].
  Stream<ConnectionStatus> get status => _controller.stream;

  /// Kuzatishni boshlaydi. Xavfsiz: plugin ishlamasa offline sifatida.
  void start() {
    if (_subscription != null) return;
    try {
      _subscription = _source().listen(
        (results) => _apply(results),
        onError: (_) => _fallbackOffline(),
      );
    } catch (_) {
      _fallbackOffline();
    }
  }

  /// Yangi natijalar ro'yxatini joriy holatga qo'llaydi.
  ///
  /// Eng "yaxshi" ulanish tanlanadi (ethernet > wifi > internet >
  /// local > offline) — bir nechta ulanish mavjud bo'lganda (masalan
  /// WiFi + Ethernet) aynan eng ishonchlisi qaytariladi. LAN imkoniyati
  /// wifi/ethernet da mavjud.
  void _apply(List<ConnectivityResult> results) {
    if (results.isEmpty) {
      _emit(ConnectionClass.offline, detail: 'none');
      return;
    }
    (ConnectionClass, String) best = (ConnectionClass.offline, 'none');
    var bestRank = -1;
    for (final result in results) {
      final mapped = _map(result);
      final rank = _rank(mapped.$1);
      if (rank > bestRank) {
        bestRank = rank;
        best = mapped;
      }
    }
    _emit(best.$1, detail: best.$2);
  }

  /// Ulanish sinfi ustunligi — kattaroq = afzalroq.
  int _rank(ConnectionClass cls) {
    return switch (cls) {
      ConnectionClass.ethernet => 4,
      ConnectionClass.wifi => 3,
      ConnectionClass.internet => 2,
      ConnectionClass.lan => 1,
      ConnectionClass.localDevice => 1,
      ConnectionClass.offline => 0,
    };
  }

  (ConnectionClass, String) _map(ConnectivityResult result) {
    return switch (result) {
      ConnectivityResult.ethernet => (ConnectionClass.ethernet, 'ethernet'),
      ConnectivityResult.wifi => (ConnectionClass.wifi, 'wifi'),
      ConnectivityResult.mobile => (ConnectionClass.internet, 'mobile'),
      ConnectivityResult.vpn => (ConnectionClass.internet, 'vpn'),
      ConnectivityResult.bluetooth => (ConnectionClass.localDevice, 'bluetooth'),
      ConnectivityResult.satellite => (ConnectionClass.internet, 'satellite'),
      ConnectivityResult.other => (ConnectionClass.internet, 'other'),
      ConnectivityResult.none => (ConnectionClass.offline, 'none'),
    };
  }

  void _emit(ConnectionClass cls, {required String detail}) {
    final next = ConnectionStatus(
      connectionClass: cls,
      changedAt: DateTime.now(),
      detail: detail,
    );
    if (next.connectionClass == _current.connectionClass) {
      // Sinf o'zgarmagan — emit qilmaymiz (rebuild storm'ni oldini olish).
      _current = next;
      return;
    }
    _current = next;
    if (!_controller.isClosed) {
      _controller.add(next);
    }
  }

  void _fallbackOffline() {
    _emit(ConnectionClass.offline, detail: 'unknown');
  }

  /// Test uchun: joriy holatni qo'lda o'rnatish.
  @visibleForTesting
  void debugSetStatus(ConnectionClass cls, {String detail = 'test'}) {
    _emit(cls, detail: detail);
  }

  void dispose() {
    _subscription?.cancel();
    _subscription = null;
    _controller.close();
  }
}
