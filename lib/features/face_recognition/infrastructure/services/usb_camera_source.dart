import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart' show kIsWeb;

import 'camera_platform_channel.dart';
import 'camera_source.dart';
import '../../../../core/services/app_logger.dart';

/// USB/Webcam camera source implementation for Windows.
///
/// Uses native Media Foundation API via a MethodChannel bridge
/// (CameraPlatformChannel) for real webcam capture on Windows.
///
/// Architecture:
///   Dart [UsbCameraSource]
///     → [CameraPlatformChannel]
///       → MethodChannel 'com.medu.m_edu/webcam'
///         → Windows C++ Media Foundation
///           → DirectShow/MediaFoundation capture
///             → JPEG frame → Dart
///
/// Lifecycle:
///   1. [open] — enumerates cameras → opens device → starts capture
///   2. [captureFrame] — returns most recent frame
///   3. [pause]/[resume] — pauses/resumes native capture
///   4. [dispose] — releases all native resources
class UsbCameraSource implements CameraSource {
  final UsbCameraConfig config;
  final _statusController = StreamController<CameraSourceStatus>.broadcast();
  CameraSourceStatus _currentStatus = CameraSourceStatus.unavailable;
  bool _isOpen = false;

  /// Most recently captured frame.
  CameraFrame? _latestFrame;

  UsbCameraSource({this.config = const UsbCameraConfig()});

  @override
  CameraSourceType get type => CameraSourceType.usb;

  @override
  String get displayName {
    if (!isSupportedOnPlatform) return 'USB Camera (Not Supported)';
    return 'USB Camera #${config.deviceIndex + 1}';
  }

  @override
  bool get isAvailable => isSupportedOnPlatform && _isOpen;

  @override
  bool get isStreaming =>
      _currentStatus == CameraSourceStatus.streaming && _isOpen;

  @override
  Stream<CameraSourceStatus> get statusStream => _statusController.stream;

  /// Check if USB camera is supported on this platform.
  static bool get isSupportedOnPlatform {
    if (kIsWeb) return false;
    return Platform.isWindows || Platform.isLinux;
  }

  @override
  Future<void> open() async {
    if (!isSupportedOnPlatform) {
      _updateStatus(CameraSourceStatus.unavailable);
      throw const CameraException(
        'USB camera is not supported on this platform',
        code: 'PLATFORM_NOT_SUPPORTED',
      );
    }

    _updateStatus(CameraSourceStatus.initializing);

    try {
      await CameraPlatformChannel.ensureInitialized();

      // Open the camera device
      await CameraPlatformChannel.open(
        deviceIndex: config.deviceIndex,
        width: config.width,
        height: config.height,
        fps: config.frameRate,
      );

      _isOpen = true;

      // Start a capture loop to keep frames fresh
      _startCaptureLoop();

      _updateStatus(CameraSourceStatus.streaming);
    } on CameraPlatformException catch (e) {
      _updateStatus(CameraSourceStatus.error);
      throw CameraException(
        'Failed to open USB camera: ${e.message}',
        code: e.code,
        originalError: e,
      );
    } catch (e) {
      if (e is CameraException) rethrow;
      _updateStatus(CameraSourceStatus.error);
      throw CameraException(
        'Failed to open USB camera',
        code: 'OPEN_FAILED',
        originalError: e,
      );
    }
  }

  Timer? _captureTimer;
  bool _capturing = false;

  /// Periodic capture loop to keep _latestFrame fresh.
  void _startCaptureLoop() {
    _captureTimer?.cancel();
    _captureTimer = Timer.periodic(
      Duration(milliseconds: 100), // ~10 fps for frame freshness
      (_) => _captureOneFrame(),
    );
  }

  Future<void> _captureOneFrame() async {
    if (!_isOpen || _capturing) return;
    _capturing = true;
    try {
      final result = await CameraPlatformChannel.capture();
      final jpegBytes = result['jpegBytes'];
      if (jpegBytes != null && jpegBytes is List<int> && jpegBytes.isNotEmpty) {
        final (w, h) = CameraFrame.readDimensions(
          jpegBytes as dynamic, // Uint8List from platform
        );
        _latestFrame = CameraFrame(
          jpegBytes: jpegBytes as dynamic,
          width: w > 0 ? w : (result['width'] as int? ?? 640),
          height: h > 0 ? h : (result['height'] as int? ?? 480),
          rotationDegrees: result['rotation'] as int? ?? 0,
          mirrored: false,
          sourceId: 'usb-device-${config.deviceIndex}',
        );
      }
    } catch (e) {
      AppLogger.warning('UsbCameraSource: capture failed (${e.runtimeType})');
    } finally {
      _capturing = false;
    }
  }

  @override
  Future<CameraFrame?> captureFrame() async {
    if (!_isOpen) return null;

    // Try direct capture if no cached frame
    if (_latestFrame == null) {
      await _captureOneFrame();
    }
    return _latestFrame;
  }

  @override
  Future<void> pause() async {
    if (_currentStatus == CameraSourceStatus.streaming && _isOpen) {
      _captureTimer?.cancel();
      _captureTimer = null;
      try {
        await CameraPlatformChannel.pause();
      } catch (_) {}
      _updateStatus(CameraSourceStatus.paused);
    }
  }

  @override
  Future<void> resume() async {
    if (_currentStatus == CameraSourceStatus.paused && _isOpen) {
      try {
        await CameraPlatformChannel.resume();
        _startCaptureLoop();
      } catch (_) {}
      _updateStatus(CameraSourceStatus.streaming);
    }
  }

  @override
  Future<void> dispose() async {
    _isOpen = false;
    _captureTimer?.cancel();
    _captureTimer = null;
    try {
      await CameraPlatformChannel.close();
    } catch (_) {}
    _latestFrame = null;
    _updateStatus(CameraSourceStatus.unavailable);
    await _statusController.close();
  }

  void _updateStatus(CameraSourceStatus status) {
    _currentStatus = status;
    if (!_statusController.isClosed) {
      _statusController.add(status);
    }
  }

  /// List available USB camera devices.
  ///
  /// Returns a list of device names and indices.
  static Future<List<CameraDeviceInfo>> listDevices() async {
    if (!isSupportedOnPlatform) return [];
    try {
      await CameraPlatformChannel.ensureInitialized();
      final devices = await CameraPlatformChannel.enumerate();
      return devices
          .map((d) => CameraDeviceInfo(
                index: d['index'] as int? ?? 0,
                name: d['name'] as String? ?? 'Unknown Camera',
                manufacturer: d['manufacturer'] as String?,
                model: d['model'] as String?,
              ))
          .toList();
    } catch (e) {
      AppLogger.warning('UsbCameraSource: enumerate failed (${e.runtimeType})');
      return [];
    }
  }
}

/// Information about an available camera device.
class CameraDeviceInfo {
  final int index;
  final String name;
  final String? manufacturer;
  final String? model;

  const CameraDeviceInfo({
    required this.index,
    required this.name,
    this.manufacturer,
    this.model,
  });

  @override
  String toString() => 'CameraDeviceInfo($index: $name)';
}
