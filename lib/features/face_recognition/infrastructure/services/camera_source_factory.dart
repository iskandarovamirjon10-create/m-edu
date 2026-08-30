import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;

import 'camera_source.dart';
import 'hikvision_camera_config.dart';
import 'hikvision_camera_source.dart';
import 'usb_camera_source.dart';
import 'android_camera_source.dart';

/// Factory for creating camera sources based on type and platform.
///
/// This factory determines the appropriate camera source implementation
/// based on the requested type and the current platform capabilities.
class CameraSourceFactory {
  /// Creates a camera source based on the specified type.
  ///
  /// Falls back to the best available camera type if the requested
  /// type is not supported on the current platform.
  static CameraSource create({
    required CameraSourceType type,
    HikvisionCameraConfig? hikvisionConfig,
    UsbCameraConfig? usbConfig,
    AndroidCameraConfig? androidConfig,
  }) {
    // Validate platform support
    if (kIsWeb) {
      return _createUnavailable('Camera not supported on web');
    }

    switch (type) {
      case CameraSourceType.hikvision:
        return _createHikvision(hikvisionConfig);
      case CameraSourceType.usb:
        return _createUsb(usbConfig);
      case CameraSourceType.android:
        return _createAndroid(androidConfig);
      case CameraSourceType.unknown:
        return _createUnavailable('Unknown camera type');
    }
  }

  /// Creates the best available camera source for the current platform.
  static CameraSource createBestAvailable({
    HikvisionCameraConfig? hikvisionConfig,
    UsbCameraConfig? usbConfig,
    AndroidCameraConfig? androidConfig,
  }) {
    if (kIsWeb) {
      return _createUnavailable('Camera not supported on web');
    }

    // Priority order: Hikvision > Android > USB > Unavailable
    if (Platform.isAndroid || Platform.isIOS) {
      // On mobile, prefer Android camera if Hikvision not configured
      if (hikvisionConfig?.isValid == true) {
        return _createHikvision(hikvisionConfig);
      }
      return _createAndroid(androidConfig);
    } else if (Platform.isWindows || Platform.isLinux) {
      // On desktop, prefer Hikvision if configured, then USB
      if (hikvisionConfig?.isValid == true) {
        return _createHikvision(hikvisionConfig);
      }
      if (UsbCameraSource.isSupportedOnPlatform) {
        return _createUsb(usbConfig);
      }
    } else if (Platform.isMacOS) {
      // macOS: Hikvision only (if configured)
      if (hikvisionConfig?.isValid == true) {
        return _createHikvision(hikvisionConfig);
      }
    }

    return _createUnavailable('No camera available for this platform');
  }

  /// Get list of available camera sources for the current platform.
  static List<CameraSourceType> getAvailableTypes() {
    if (kIsWeb) return [];

    final types = <CameraSourceType>[];

    if (Platform.isAndroid || Platform.isIOS) {
      types.add(CameraSourceType.android);
    } else if (Platform.isWindows || Platform.isLinux) {
      if (UsbCameraSource.isSupportedOnPlatform) {
        types.add(CameraSourceType.usb);
      }
    }

    // Hikvision is always available (network-based)
    types.add(CameraSourceType.hikvision);

    return types;
  }

  static CameraSource _createHikvision(HikvisionCameraConfig? config) {
    if (config == null || !config.isValid) {
      return _createUnavailable('Hikvision camera not configured');
    }
    return HikvisionCameraSource(config: config);
  }

  static CameraSource _createUsb(UsbCameraConfig? config) {
    if (!UsbCameraSource.isSupportedOnPlatform) {
      return _createUnavailable('USB camera not supported on this platform');
    }
    return UsbCameraSource(config: config ?? const UsbCameraConfig());
  }

  static CameraSource _createAndroid(AndroidCameraConfig? config) {
    if (!AndroidCameraSource.isSupportedOnPlatform) {
      return _createUnavailable('Android camera not supported on this platform');
    }
    return AndroidCameraSource(config: config ?? const AndroidCameraConfig());
  }

  static CameraSource _createUnavailable(String message) {
    return _UnavailableCameraSource(message);
  }
}

/// Camera source that represents an unavailable camera.
class _UnavailableCameraSource implements CameraSource {
  final String reason;
  final _statusController = StreamController<CameraSourceStatus>.broadcast();

  _UnavailableCameraSource(this.reason) {
    _statusController.add(CameraSourceStatus.unavailable);
  }

  @override
  CameraSourceType get type => CameraSourceType.unknown;

  @override
  String get displayName => reason;

  @override
  bool get isAvailable => false;

  @override
  bool get isStreaming => false;

  @override
  Stream<CameraSourceStatus> get statusStream => _statusController.stream;

  @override
  Future<void> open() async {
    throw CameraException(reason, code: 'UNAVAILABLE');
  }

  @override
  Future<CameraFrame?> captureFrame() async => null;

  @override
  Future<void> pause() async {}

  @override
  Future<void> resume() async {}

  @override
  Future<void> dispose() async {
    if (!_statusController.isClosed) {
      await _statusController.close();
    }
  }
}