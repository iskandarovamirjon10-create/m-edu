import 'dart:async';

import 'camera_source.dart';
import 'camera_stream_service.dart';
import 'hikvision_camera_config.dart';
import 'snapshot_service.dart';

/// Hikvision IP camera source implementation.
///
/// Wraps the existing [CameraStreamService] and [SnapshotService]
/// to provide the unified [CameraSource] interface.
class HikvisionCameraSource implements CameraSource {
  final HikvisionCameraConfig config;
  final CameraStreamService _streamService;
  final SnapshotService _snapshotService;

  final _statusController = StreamController<CameraSourceStatus>.broadcast();
  CameraSourceStatus _currentStatus = CameraSourceStatus.unavailable;
  bool _isOpen = false;

  HikvisionCameraSource({
    required this.config,
    CameraStreamService? streamService,
    SnapshotService? snapshotService,
  })  : _streamService = streamService ?? CameraStreamService(),
        _snapshotService = snapshotService ?? SnapshotService();

  @override
  CameraSourceType get type => CameraSourceType.hikvision;

  @override
  String get displayName => 'Hikvision IP (${config.ip})';

  @override
  bool get isAvailable => config.isValid;

  @override
  bool get isStreaming =>
      _currentStatus == CameraSourceStatus.streaming && _isOpen;

  @override
  Stream<CameraSourceStatus> get statusStream => _statusController.stream;

  @override
  Future<void> open() async {
    if (!config.isValid) {
      _updateStatus(CameraSourceStatus.error);
      throw const CameraException(
        'Camera configuration is invalid',
        code: 'INVALID_CONFIG',
      );
    }

    _updateStatus(CameraSourceStatus.initializing);

    try {
      CameraStreamService.ensureInitialized();
      await _streamService.open(config.rtspUrl);
      _isOpen = true;
      _updateStatus(CameraSourceStatus.streaming);
    } catch (e) {
      _updateStatus(CameraSourceStatus.error);
      throw CameraException(
        'Failed to connect to Hikvision camera',
        code: 'CONNECTION_FAILED',
        originalError: e,
      );
    }
  }

  @override
  Future<CameraFrame?> captureFrame() async {
    if (!_isOpen) return null;

    // Try RTSP frame first
    final jpegBytes = await _streamService.grabFrame();
    if (jpegBytes != null) {
      final (w, h) = CameraFrame.readDimensions(jpegBytes);
      return CameraFrame(
        jpegBytes: jpegBytes,
        width: w,
        height: h,
        sourceId: 'hikvision-${config.ip}',
      );
    }

    // Fallback to ISAPI snapshot
    try {
      final snapshot = await _snapshotService.fetchSnapshot(config);
      if (snapshot != null) {
        final (w, h) = CameraFrame.readDimensions(snapshot);
        return CameraFrame(
          jpegBytes: snapshot,
          width: w,
          height: h,
          sourceId: 'hikvision-isapi-${config.ip}',
        );
      }
    } catch (_) {
      // ISAPI snapshot ham muvaffaqiyatsiz.
    }
    return null;
  }

  @override
  Future<void> pause() async {
    if (_currentStatus == CameraSourceStatus.streaming) {
      _updateStatus(CameraSourceStatus.paused);
      try {
        await _streamService.player.pause();
      } catch (_) {
        // Player allaqachon to'xtagan bo'lishi mumkin.
      }
    }
  }

  @override
  Future<void> resume() async {
    if (_currentStatus == CameraSourceStatus.paused && _isOpen) {
      try {
        await _streamService.player.play();
      } catch (_) {
        // Player ochib bo'lmagan bo'lishi mumkin.
      }
      _updateStatus(CameraSourceStatus.streaming);
    }
  }

  @override
  Future<void> dispose() async {
    _isOpen = false;
    _updateStatus(CameraSourceStatus.unavailable);
    await _streamService.dispose();
    await _statusController.close();
  }

  void _updateStatus(CameraSourceStatus status) {
    _currentStatus = status;
    if (!_statusController.isClosed) {
      _statusController.add(status);
    }
  }
}