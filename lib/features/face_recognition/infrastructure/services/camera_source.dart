import 'dart:async';
import 'dart:typed_data';

/// Platform-neutral camera frame contract.
///
/// Contains the frame image data plus metadata required for correct
/// coordinate mapping, rotation, and mirroring in the overlay.
///
/// Every CameraSource implementation returns this type from
/// [captureFrame]. The recognition pipeline consumes it without
/// knowing which platform produced it.
class CameraFrame {
  /// Raw JPEG bytes of the captured frame.
  final Uint8List jpegBytes;

  /// Frame width in pixels.
  final int width;

  /// Frame height in pixels.
  final int height;

  /// Clockwise rotation needed to display the frame correctly (degrees).
  /// Android: sensor rotation relative to display.
  /// Windows/RTSP: typically 0.
  final int rotationDegrees;

  /// Whether the frame is horizontally mirrored.
  /// Android front camera: true. Back camera / RTSP / USB: false.
  final bool mirrored;

  /// When the frame was captured.
  final DateTime timestamp;

  /// Camera source identifier (for logging/audit).
  final String sourceId;

  CameraFrame({
    required this.jpegBytes,
    required this.width,
    required this.height,
    this.rotationDegrees = 0,
    this.mirrored = false,
    DateTime? timestamp,
    this.sourceId = 'unknown',
  }) : timestamp = timestamp ?? DateTime.fromMillisecondsSinceEpoch(0);

  /// JPEG header'dan kenglik/balandlikni o'qiydi (to'liq dekod qilmaydi).
  ///
  /// Muvaffaqiyatsiz bo'lsa (0, 0) qaytaradi.
  static (int, int) readDimensions(Uint8List jpegBytes) {
    try {
      // JPEG SOI marker (0xFF 0xD8) — agar yo'q bo'lsa noto'g'ri format.
      if (jpegBytes.length < 4 || jpegBytes[0] != 0xFF || jpegBytes[1] != 0xD8) {
        return (0, 0);
      }
      // JPEG header'dan frame o'lchamlarini topamiz (SOF0/SOF2 marker).
      var i = 2;
      while (i < jpegBytes.length - 9) {
        if (jpegBytes[i] != 0xFF) { i++; continue; }
        final marker = jpegBytes[i + 1];
        // SOF0 (0xC0) yoki SOF2 (0xC2) — frame dimensions mavjud.
        if (marker == 0xC0 || marker == 0xC2) {
          final height = (jpegBytes[i + 5] << 8) | jpegBytes[i + 6];
          final width = (jpegBytes[i + 7] << 8) | jpegBytes[i + 8];
          return (width, height);
        }
        // Keyingi markerga o'tish.
        final segmentLength = (jpegBytes[i + 2] << 8) | jpegBytes[i + 3];
        i += 2 + segmentLength;
      }
    } catch (_) {
      // Parse xatosi — o'lchamsiz qaytamiz.
    }
    return (0, 0);
  }
}

/// Camera source types supported by M-EDU.
enum CameraSourceType {
  /// Hikvision IP camera via RTSP stream.
  hikvision,

  /// USB/Webcam connected to Windows desktop.
  usb,

  /// Android device built-in camera.
  android,

  /// Unknown or not configured.
  unknown,
}

/// Abstract interface for camera sources.
///
/// Provides a unified API for different camera types:
/// - Hikvision IP cameras (RTSP)
/// - USB/Webcam (Windows)
/// - Android device cameras
///
/// Each implementation handles platform-specific camera access,
/// lifecycle management, and frame capture.
abstract class CameraSource {
  /// The type of camera source.
  CameraSourceType get type;

  /// Human-readable name for the camera source.
  String get displayName;

  /// Whether the camera source is currently available.
  bool get isAvailable;

  /// Whether the camera is currently streaming.
  bool get isStreaming;

  /// Opens the camera source and begins streaming.
  ///
  /// Throws [CameraException] if initialization fails.
  Future<void> open();

  /// Captures a single frame with metadata.
  ///
  /// Returns null if no frame is available.
  Future<CameraFrame?> captureFrame();

  /// Pauses the camera stream without releasing resources.
  Future<void> pause();

  /// Resumes a paused camera stream.
  Future<void> resume();

  /// Disposes the camera source and releases all resources.
  ///
  /// After disposal, the camera source cannot be reused.
  Future<void> dispose();

  /// Stream of camera status changes.
  Stream<CameraSourceStatus> get statusStream;
}

/// Camera source status.
enum CameraSourceStatus {
  /// Camera is initializing.
  initializing,

  /// Camera is ready and streaming.
  streaming,

  /// Camera is paused.
  paused,

  /// Camera encountered an error.
  error,

  /// Camera is unavailable (not connected or permission denied).
  unavailable,

  /// Camera is disconnected.
  disconnected,
}

/// Camera-specific exception.
class CameraException implements Exception {
  final String message;
  final String? code;
  final dynamic originalError;

  const CameraException(this.message, {this.code, this.originalError});

  @override
  String toString() => 'CameraException($code): $message';
}

/// Configuration for USB/Webcam camera source.
class UsbCameraConfig {
  /// Device index (0 = first camera, 1 = second, etc.).
  final int deviceIndex;

  /// Requested width (null = platform default).
  final int? width;

  /// Requested height (null = platform default).
  final int? height;

  /// Requested frame rate (null = platform default).
  final int? frameRate;

  const UsbCameraConfig({
    this.deviceIndex = 0,
    this.width,
    this.height,
    this.frameRate,
  });
}

/// Configuration for Android device camera source.
class AndroidCameraConfig {
  /// Camera lens direction (front or back).
  final AndroidCameraLensDirection lensDirection;

  /// Requested width (null = platform default).
  final int? width;

  /// Requested height (null = platform default).
  final int? height;

  /// Requested frame rate (null = platform default).
  final int? frameRate;

  /// Whether to enable auto-focus.
  final bool enableAutoFocus;

  const AndroidCameraConfig({
    this.lensDirection = AndroidCameraLensDirection.front,
    this.width,
    this.height,
    this.frameRate,
    this.enableAutoFocus = true,
  });
}

/// Android camera lens direction.
enum AndroidCameraLensDirection {
  front,
  back,
  external,
}