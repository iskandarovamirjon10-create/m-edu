import 'dart:async';

import 'package:flutter/services.dart';

/// Platform channel for native Windows webcam access via Media Foundation.
///
/// This is used ONLY on Windows where the `camera` plugin is not available.
/// On Android, use the `camera` plugin directly through [AndroidCameraSource].
///
/// MethodChannel protocol (Windows):
///   'com.medu.m_edu/webcam'
///
/// Methods:
///   enumerate  → `List<Map<String, dynamic>>` (cameras)
///   open       → `Map<String, dynamic>` (info: width, height, fps)
///   capture    → `Map<String, dynamic>` (jpegBytes, width, height, rotation)
///   close      → void
///   pause      → void
///   resume     → void
class CameraPlatformChannel {
  static const MethodChannel _channel =
      MethodChannel('com.medu.m_edu/webcam');

  static bool _initialized = false;

  /// Ensure the native side is ready.
  static Future<void> ensureInitialized() async {
    if (_initialized) return;
    _initialized = true;
  }

  /// Enumerate available webcam devices.
  ///
  /// Returns a list of camera info maps:
  /// ```json
  /// [
  ///   {"index": 0, "name": "USB Camera", "width": 1920, "height": 1080},
  ///   {"index": 1, "name": "HD Webcam C920", "width": 1280, "height": 720}
  /// ]
  /// ```
  static Future<List<Map<String, dynamic>>> enumerate() async {
    try {
      final result = await _channel.invokeMethod<List>('enumerate');
      if (result == null) return [];
      return result
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
    } on PlatformException catch (e) {
      throw CameraPlatformException(
        'Failed to enumerate cameras: ${e.message}',
        code: e.code,
      );
    }
  }

  /// Open a camera device by index.
  ///
  /// [deviceIndex] — camera device index (0 = first camera).
  /// [width] — requested width (null = device default).
  /// [height] — requested height (null = device default).
  /// [fps] — requested frame rate (null = device default).
  ///
  /// Returns camera info:
  /// ```json
  /// {"width": 1280, "height": 720, "fps": 30}
  /// ```
  static Future<Map<String, dynamic>> open({
    int deviceIndex = 0,
    int? width,
    int? height,
    int? fps,
  }) async {
    try {
      final result = await _channel.invokeMethod<Map>('open', {
        'deviceIndex': deviceIndex,
        if (width != null) 'width': width,
        if (height != null) 'height': height,
        if (fps != null) 'fps': fps,
      });
      if (result == null) {
        throw const CameraPlatformException(
          'Camera open returned null',
          code: 'NULL_RESPONSE',
        );
      }
      return Map<String, dynamic>.from(result);
    } on PlatformException catch (e) {
      throw CameraPlatformException(
        'Failed to open camera: ${e.message}',
        code: e.code,
      );
    }
  }

  /// Capture a single JPEG frame.
  ///
  /// Returns:
  /// ```json
  /// {
  ///   "jpegBytes": Uint8List,
  ///   "width": 1280,
  ///   "height": 720,
  ///   "rotation": 0
  /// }
  /// ```
  static Future<Map<String, dynamic>> capture() async {
    try {
      final result = await _channel.invokeMethod<Map>('capture');
      if (result == null) {
        throw const CameraPlatformException(
          'Camera capture returned null',
          code: 'NULL_RESPONSE',
        );
      }
      return Map<String, dynamic>.from(result);
    } on PlatformException catch (e) {
      throw CameraPlatformException(
        'Failed to capture frame: ${e.message}',
        code: e.code,
      );
    }
  }

  /// Close the camera and release resources.
  static Future<void> close() async {
    try {
      await _channel.invokeMethod<void>('close');
    } on PlatformException catch (_) {
      // Best-effort close.
    }
  }

  /// Pause the camera stream.
  static Future<void> pause() async {
    try {
      await _channel.invokeMethod<void>('pause');
    } on PlatformException catch (_) {}
  }

  /// Resume the camera stream.
  static Future<void> resume() async {
    try {
      await _channel.invokeMethod<void>('resume');
    } on PlatformException catch (_) {}
  }
}

/// Camera-specific platform exception.
class CameraPlatformException implements Exception {
  final String message;
  final String code;

  const CameraPlatformException(this.message, {required this.code});

  @override
  String toString() => 'CameraPlatformException($code): $message';
}
