import 'dart:async';
import 'dart:io';

import 'package:camera/camera.dart' as cam;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:permission_handler/permission_handler.dart';

import 'camera_source.dart';
import '../../../../core/services/app_logger.dart';

/// Android device camera source implementation.
///
/// Uses the `camera` plugin (Camera2 API under the hood) for real
/// camera access on Android devices. Supports both front and back
/// cameras with auto-focus and configurable resolution.
///
/// Frame lifecycle:
///   1. [open] — requests permission + initializes CameraController
///   2. [captureFrame] — returns most recent frame from image stream
///   3. [dispose] — releases camera resources
class AndroidCameraSource implements CameraSource {
  final AndroidCameraConfig config;
  final _statusController = StreamController<CameraSourceStatus>.broadcast();
  CameraSourceStatus _currentStatus = CameraSourceStatus.unavailable;
  bool _isOpen = false;
  bool _hasPermission = false;
  cam.CameraController? _controller;

  /// Most recently captured frame (from image stream).
  CameraFrame? _latestFrame;

  /// Stream subscription for image frames.
  StreamSubscription<cam.CameraImage>? _imageSubscription;

  AndroidCameraSource({this.config = const AndroidCameraConfig()});

  @override
  CameraSourceType get type => CameraSourceType.android;

  @override
  String get displayName {
    if (!isSupportedOnPlatform) return 'Android Camera (Not Supported)';
    final direction = config.lensDirection == AndroidCameraLensDirection.front
        ? 'Front'
        : 'Back';
    return '$direction Camera';
  }

  @override
  bool get isAvailable => isSupportedOnPlatform && _hasPermission;

  @override
  bool get isStreaming =>
      _currentStatus == CameraSourceStatus.streaming && _isOpen;

  @override
  Stream<CameraSourceStatus> get statusStream => _statusController.stream;

  /// Check if Android camera is supported on this platform.
  static bool get isSupportedOnPlatform {
    if (kIsWeb) return false;
    return Platform.isAndroid;
  }

  @override
  Future<void> open() async {
    if (!isSupportedOnPlatform) {
      _updateStatus(CameraSourceStatus.unavailable);
      throw const CameraException(
        'Android camera is not supported on this platform',
        code: 'PLATFORM_NOT_SUPPORTED',
      );
    }

    _updateStatus(CameraSourceStatus.initializing);

    try {
      // 1) Request camera permission
      final status = await Permission.camera.status;
      if (status.isDenied || status.isPermanentlyDenied) {
        final result = await Permission.camera.request();
        if (result.isDenied || result.isPermanentlyDenied) {
          _hasPermission = false;
          _updateStatus(CameraSourceStatus.unavailable);
          throw const CameraException(
            'Camera permission denied',
            code: 'PERMISSION_DENIED',
          );
        }
      }
      _hasPermission = true;

      // 2) Discover available cameras
      final cameras = await cam.availableCameras();
      if (cameras.isEmpty) {
        _updateStatus(CameraSourceStatus.unavailable);
        throw const CameraException(
          'No cameras found on device',
          code: 'NO_CAMERAS',
        );
      }

      // 3) Select the appropriate camera
      final lensDirection = config.lensDirection == AndroidCameraLensDirection.front
          ? cam.CameraLensDirection.front
          : cam.CameraLensDirection.back;
      cam.CameraDescription selectedCamera;
      try {
        selectedCamera = cameras.firstWhere(
          (c) => c.lensDirection == lensDirection,
        );
      } catch (_) {
        // Fallback to first available camera
        selectedCamera = cameras.first;
        AppLogger.warning(
          'AndroidCameraSource: Requested $lensDirection camera not found, '
          'using ${selectedCamera.name}',
        );
      }

      // 4) Determine resolution
      final resolutionPreset = _resolutionFromConfig();

      // 5) Initialize CameraController
      _controller = cam.CameraController(
        selectedCamera,
        resolutionPreset,
        enableAudio: false,
        imageFormatGroup: cam.ImageFormatGroup.jpeg,
      );

      await _controller!.initialize();

      // 6) Start image stream for continuous frame capture
      await _controller!.startImageStream(_onImageAvailable); // ignore: invalid_use_of_protected_member

      _isOpen = true;
      _updateStatus(CameraSourceStatus.streaming);
    } on cam.CameraException catch (e) {
      _updateStatus(CameraSourceStatus.error);
      throw CameraException(
        'Failed to open Android camera: ${e.description}',
        code: e.code,
        originalError: e,
      );
    } catch (e) {
      if (e is CameraException) rethrow;
      _updateStatus(CameraSourceStatus.error);
      throw CameraException(
        'Failed to open Android camera',
        code: 'OPEN_FAILED',
        originalError: e,
      );
    }
  }

  @override
  Future<CameraFrame?> captureFrame() async {
    if (!_isOpen || _controller == null || !_controller!.value.isInitialized) {
      return null;
    }
    return _latestFrame;
  }

  /// Callback for image stream — stores latest frame as JPEG.
  void _onImageAvailable(cam.CameraImage image) {
    if (!_isOpen) return;
    try {
      // The camera plugin with ImageFormatGroup.jpeg gives us JPEG bytes
      // directly in image.planes[0].bytes.
      if (image.planes.isEmpty) return;

      final bytes = image.planes[0].bytes;
      if (bytes.isEmpty) return;

      // Read actual frame dimensions from JPEG header
      final (w, h) = CameraFrame.readDimensions(bytes);

      // Compute rotation: Android sensor rotation relative to display
      final sensorOrientation = _controller?.description.sensorOrientation ?? 0;
      final isFrontCamera =
          _controller?.description.lensDirection == cam.CameraLensDirection.front;
      final mirrored = isFrontCamera;

      _latestFrame = CameraFrame(
        jpegBytes: bytes,
        width: w > 0 ? w : image.width,
        height: h > 0 ? h : image.height,
        rotationDegrees: sensorOrientation,
        mirrored: mirrored,
        sourceId: 'android-${_controller?.description.name ?? "unknown"}',
      );
    } catch (e) {
      AppLogger.warning('AndroidCameraSource: frame conversion failed (${e.runtimeType})');
    }
  }

  cam.ResolutionPreset _resolutionFromConfig() {
    // Map requested dimensions to nearest ResolutionPreset
    final maxDim = config.width ?? config.height ?? 1280;
    if (maxDim <= 480) return cam.ResolutionPreset.low;
    if (maxDim <= 720) return cam.ResolutionPreset.medium;
    if (maxDim <= 1080) return cam.ResolutionPreset.high;
    return cam.ResolutionPreset.veryHigh;
  }

  @override
  Future<void> pause() async {
    if (_currentStatus == CameraSourceStatus.streaming && _isOpen) {
      try {
        await _controller?.pausePreview();
      } catch (_) {}
      _updateStatus(CameraSourceStatus.paused);
    }
  }

  @override
  Future<void> resume() async {
    if (_currentStatus == CameraSourceStatus.paused && _isOpen) {
      try {
        await _controller?.resumePreview();
      } catch (_) {}
      _updateStatus(CameraSourceStatus.streaming);
    }
  }

  @override
  Future<void> dispose() async {
    _isOpen = false;
    await _imageSubscription?.cancel();
    _imageSubscription = null;
    try {
      await _controller?.dispose();
    } catch (_) {}
    _controller = null;
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
}
