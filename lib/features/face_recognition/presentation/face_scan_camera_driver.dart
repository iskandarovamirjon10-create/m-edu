// Kamera hayot sikli drayveri (spec §23 — camera failure) — face_scan_page
// dan ajratilgan, in'ektsiya qilingan funksiyalar bilan unit-test qilinadi.
//
// Vazifalari:
//  - oqim ochish (open) → kadr olish (grab/snapshot fallback)
//  - ketma-ket muvaffaqiyatsiz kadrlarni aniqlash
//  - chegaralangan avto-qayta ulanish (exponential backoff, abadiy loop yo'q)
//  - qo'lda qayta urinish / pauza / davom
//
// Bu sinf UI dan mustaqil — faqat funksiya in'ektsiyasi bilan ishlaydi.

import 'dart:async';

import '../infrastructure/services/camera_source.dart';
import '../infrastructure/services/face_vision_engine.dart';
import 'face_frame_mapper.dart';

/// Drayver holati (UI chip uchun).
enum FaceScanCameraDriverStatus {
  connecting,
  streaming,
  reconnecting,
  /// Umumiy xato — maksimal qayta urinish tugagan yoki oqim ochilmadi.
  error,
}

class FaceScanCameraDriver {
  /// RTSP oqimini ochadi (muvaffaqiyatsiz bo'lsa exception tashlaydi).
  final Future<void> Function() openStream;

  /// Jonli oqimdan kadr oladi (null — hali kadr yo'q).
  final Future<CameraFrame?> Function() grabFrame;

  /// ISAPI snapshot fallback.
  final Future<CameraFrame?> Function() fetchSnapshot;

  /// Kadrni yuz dvigateliga beradi.
  final Future<FaceAnalysisOutcome> Function(CameraFrame frame) analyzeFrame;

  /// Har bir tahlil natijasi uchun (display + controller ko'prigi).
  final void Function(MappedFrame frame) onFrame;

  /// Drayver holati o'zgarishi (UI chip).
  final void Function(FaceScanCameraDriverStatus status, {int attempt, int maxAttempts, String? message}) onStatus;

  /// Kadrlar orasidagi kutish (ms) — real vaqtda o'qiladi.
  final int Function() scanIntervalMs;

  /// Kadr ololmaganlar soni shu qiymatdan oshsa snapshot fallback.
  static const int kNullFrameFallbackThreshold = 6;

  /// Ketma-ket muvaffaqiyatsiz kadrlar (kadr umuman kelmayapti).
  static const int kConsecutiveFailureLimit = 15;

  static const int kMaxReconnectAttempts = 5;
  static const Duration kReconnectBaseDelay = Duration(seconds: 1);
  static const Duration kReconnectMaxDelay = Duration(seconds: 16);

  FaceScanCameraDriver({
    required this.openStream,
    required this.grabFrame,
    required this.fetchSnapshot,
    required this.analyzeFrame,
    required this.onFrame,
    required this.onStatus,
    required this.scanIntervalMs,
  });

  bool _running = false;
  bool _loopActive = false;
  bool _snapshotFallback = false;
  int _nullFrames = 0;
  int _consecutiveFailures = 0;
  int _reconnectAttempt = 0;
  Timer? _reconnectTimer;

  bool get isRunning => _running;
  bool get isSnapshotFallback => _snapshotFallback;

  /// Oqimni ochadi va skan loopini boshlaydi.
  ///
  /// Streaming holati faqat birinchi muvaffaqiyatli kadr olingandan keyin
  /// e'lon qilinadi — foydalanuvchi "hali tayyor emas" holatini ko'radi.
  Future<void> start() async {
    _setStatus(FaceScanCameraDriverStatus.connecting);
    try {
      await openStream();
    } catch (_) {
      _snapshotFallback = true;
    }
    if (!_running) {
      _running = true;
      // Streaming holati endi _loop ichida birinchi kadr muvaffaqiyatli
      // olingandan keyin e'lon qilinadi.
      if (!_loopActive) {
        _loopActive = true;
        unawaited(_loop());
      }
    }
  }

  Future<void> _loop() async {
    bool reportedStreaming = false;
    while (_running && _loopActive) {
      CameraFrame? frame;
      if (!_snapshotFallback) {
        frame = await grabFrame();
        // Async chegaradan keyin lifecycle tekshiruvi.
        if (!_running) break;
        if (frame == null) {
          _nullFrames++;
          if (_nullFrames > kNullFrameFallbackThreshold) {
            _snapshotFallback = true;
          }
        }
      }
      if (_snapshotFallback) {
        frame = await fetchSnapshot();
        if (!_running) break;
      }

      if (frame != null) {
        _consecutiveFailures = 0;
        // Birinchi muvaffaqiyatli kadr → streaming holatini e'lon qilamiz.
        if (!reportedStreaming) {
          reportedStreaming = true;
          _setStatus(FaceScanCameraDriverStatus.streaming);
        }
        final outcome = await analyzeFrame(frame);
        // Async chegaradan keyin lifecycle tekshiruvi — tahlil natijasini
        // dispose bo'lgandan keyin yetkazmaslik.
        if (!_running) break;
        onFrame(mapFrameOutcome(outcome));
      } else {
        // RTSP ham, ISAPI ham kadr bermayapti — kamera yetib bo'lmayapti.
        _consecutiveFailures++;
        if (_consecutiveFailures >= kConsecutiveFailureLimit) {
          _running = false;
          _scheduleReconnect();
          break;
        }
      }

      await Future<void>.delayed(Duration(milliseconds: scanIntervalMs()));
      if (!_running) break;
    }
    _loopActive = false;
  }

  /// Exponential backoff bilan chegaralangan avto-qayta ulanish.
  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    if (_reconnectAttempt >= kMaxReconnectAttempts) {
      _setStatus(
        FaceScanCameraDriverStatus.error,
        message: 'Kameraga ulanish mumkin emas — IP/login/parolni tekshiring',
      );
      return;
    }

    final delay = kReconnectBaseDelay * (1 << _reconnectAttempt);
    final capped = delay > kReconnectMaxDelay ? kReconnectMaxDelay : delay;
    _reconnectAttempt++;
    _setStatus(FaceScanCameraDriverStatus.reconnecting,
        attempt: _reconnectAttempt);
    _reconnectTimer = Timer(capped, () {
      if (_reconnectTimer == null) return;
      _reconnectTimer = null;
      unawaited(_retryConnection());
    });
  }

  Future<void> _retryConnection() async {
    try {
      await openStream();
    } catch (_) {
      _snapshotFallback = true;
    }
    // Timer bo'lsa — dispose qilingan (timer bekor qilinadi).
    // Qayta ulanishdan oldin timer tekshiriladi, shuning uchun bu yerda
    // faqat timer yo'qligini tekshiramiz.
    if (_reconnectTimer != null) return;
    _consecutiveFailures = 0;
    _running = true;
    // Streaming holati _loop ichida birinchi kadr muvaffaqiyatli
    // olingandan keyin e'lon qilinadi.
    if (!_loopActive) {
      _loopActive = true;
      unawaited(_loop());
    }
  }

  /// Qo'lda qayta urinish (maksimal avto-urinish tugaganidan so'ng).
  void manualRetry() {
    _reconnectAttempt = 0;
    _consecutiveFailures = 0;
    _scheduleReconnect();
  }

  /// Loopni to'xtatadi (pauza).
  void pause() {
    _running = false;
  }

  /// Loopni davom ettiradi.
  void resume() {
    if (_running) return;
    _running = true;
    if (!_loopActive) {
      _loopActive = true;
      _loop();
    }
  }

  void _setStatus(
    FaceScanCameraDriverStatus status, {
    int attempt = 0,
    int maxAttempts = kMaxReconnectAttempts,
    String? message,
  }) {
    onStatus(status,
        attempt: attempt, maxAttempts: maxAttempts, message: message);
  }

  /// Timer va loopni tozalaydi (sahifa yopilganda).
  void dispose() {
    _running = false;
    _loopActive = false;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
  }
}
