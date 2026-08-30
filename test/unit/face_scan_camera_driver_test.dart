import 'dart:typed_data';

import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/face_recognition/infrastructure/services/camera_source.dart';
import 'package:m_edu/features/face_recognition/infrastructure/services/face_vision_engine.dart';
import 'package:m_edu/features/face_recognition/presentation/face_frame_mapper.dart';
import 'package:m_edu/features/face_recognition/presentation/face_scan_camera_driver.dart';

/// FaceScanCameraDriver — kamera hayot sikli (spec §23): oqim ochish, kadr
/// olish, snapshot fallback, chegaralangan qayta ulanish, pauza/davom.
/// Vaqt fake_async bilan boshqariladi — real kutishlar yo'q.
void main() {
  const interval = Duration(milliseconds: 100);

  CameraFrame frame() => CameraFrame(
        jpegBytes: Uint8List.fromList(List.filled(10, 1)),
        width: 320,
        height: 240,
        sourceId: 'test',
      );

  FaceScanCameraDriver build({
    required Future<void> Function() openStream,
    required Future<CameraFrame?> Function() grabFrame,
    required Future<CameraFrame?> Function() fetchSnapshot,
    required void Function(FaceScanCameraDriverStatus, {int attempt, int maxAttempts, String? message}) onStatus,
    void Function(MappedFrame)? onFrame,
  }) {
    return FaceScanCameraDriver(
      openStream: openStream,
      grabFrame: grabFrame,
      fetchSnapshot: fetchSnapshot,
      analyzeFrame: (cameraFrame) async => const NoFaceOutcome(),
      onFrame: onFrame ?? (_) {},
      onStatus: onStatus,
      scanIntervalMs: () => interval.inMilliseconds,
    );
  }

  test('oddiy oqim: kadrlar tahlil qilinadi, holat streaming', () {
    fakeAsync((async) {
      final statuses = <FaceScanCameraDriverStatus>[];
      final frames = <MappedFrame>[];
      final driver = build(
        openStream: () async {},
        grabFrame: () async => frame(),
        fetchSnapshot: () async => frame(),
        onFrame: frames.add,
        onStatus: (s, {attempt = 0, maxAttempts = 5, message}) =>
            statuses.add(s),
      );

      driver.start();
      async.flushMicrotasks();
      async.elapse(interval);
      async.elapse(interval);

      expect(statuses.first, FaceScanCameraDriverStatus.connecting);
      expect(statuses, contains(FaceScanCameraDriverStatus.streaming));
      expect(frames.length, greaterThanOrEqualTo(2));
      expect(driver.isRunning, isTrue);
      driver.dispose();
    });
  });

  test('kadr yo\'q → snapshot fallback (6 null dan so\'ng)', () {
    fakeAsync((async) {
      final driver = build(
        openStream: () async {},
        grabFrame: () async => null,
        fetchSnapshot: () async => frame(),
        onFrame: (_) {},
        onStatus: (s, {attempt = 0, maxAttempts = 5, message}) {},
      );

      driver.start();
      async.flushMicrotasks();
      async.elapse(interval);
      async.elapse(interval);
      async.elapse(interval);
      async.elapse(interval);
      async.elapse(interval);
      async.elapse(interval);

      expect(driver.isSnapshotFallback, isTrue);
      driver.dispose();
    });
  });

  test('kamera uzilishi → qayta ulanish → tiklanish', () {
    fakeAsync((async) {
      var framesAvailable = false;
      final statuses = <FaceScanCameraDriverStatus>[];
      var openCalls = 0;

      final driver = build(
        openStream: () async {
          openCalls++;
        },
        grabFrame: () async => framesAvailable ? frame() : null,
        fetchSnapshot: () async => framesAvailable ? frame() : null,
        onStatus: (s, {attempt = 0, maxAttempts = 5, message}) =>
            statuses.add(s),
      );

      driver.start();
      async.flushMicrotasks();
      // 15 ta muvaffaqiyatsiz kadr → reconnect.
      for (var i = 0; i < 16; i++) {
        async.elapse(interval);
      }
      expect(statuses, contains(FaceScanCameraDriverStatus.reconnecting));

      // Kamera tiklandi — qayta ulanish urinishi muvaffaqiyatli.
      framesAvailable = true;
      async.elapse(const Duration(seconds: 1)); // 1s backoff
      async.flushMicrotasks();
      async.elapse(interval);

      expect(statuses.last, FaceScanCameraDriverStatus.streaming);
      expect(openCalls, greaterThanOrEqualTo(2));
      driver.dispose();
    });
  });

  test('maksimal qayta urinishdan keyin error — abadiy loop yo\'q', () {
    fakeAsync((async) {
      final statuses = <FaceScanCameraDriverStatus>[];
      final driver = build(
        openStream: () async => throw StateError('camera down'),
        grabFrame: () async => null,
        fetchSnapshot: () async => null,
        onStatus: (s, {attempt = 0, maxAttempts = 5, message}) =>
            statuses.add(s),
      );

      driver.start();
      async.flushMicrotasks();
      // 5 ta qayta urinish (backoff 1+2+4+8+16) + 6-chi urinishda error.
      for (var i = 0; i < 6; i++) {
        for (var j = 0; j < 16; j++) {
          async.elapse(interval);
        }
        async.elapse(Duration(seconds: 1 << i));
        async.flushMicrotasks();
      }

      expect(statuses.last, FaceScanCameraDriverStatus.error);
      expect(driver.isRunning, isFalse);
      driver.dispose();
    });
  });

  test('qo\'lda qayta urinish (max avto-urinishdan so\'ng)', () {
    fakeAsync((async) {
      var framesAvailable = false;
      final statuses = <FaceScanCameraDriverStatus>[];
      final driver = build(
        openStream: () async {},
        grabFrame: () async => framesAvailable ? frame() : null,
        fetchSnapshot: () async => framesAvailable ? frame() : null,
        onStatus: (s, {attempt = 0, maxAttempts = 5, message}) =>
            statuses.add(s),
      );

      driver.start();
      async.flushMicrotasks();
      for (var i = 0; i < 6; i++) {
        for (var j = 0; j < 16; j++) {
          async.elapse(interval);
        }
        async.elapse(Duration(seconds: 1 << i));
        async.flushMicrotasks();
      }
      expect(statuses.last, FaceScanCameraDriverStatus.error);

      // Kamera tiklandi — qo'lda qayta urinish.
      framesAvailable = true;
      driver.manualRetry();
      async.elapse(const Duration(seconds: 1));
      async.flushMicrotasks();
      async.elapse(interval);

      expect(statuses.last, FaceScanCameraDriverStatus.streaming);
      driver.dispose();
    });
  });

  test('pauza loopni to\'xtatadi, davom qayta boshlaydi', () {
    fakeAsync((async) {
      var frameCount = 0;
      final driver = build(
        openStream: () async {},
        grabFrame: () async {
          frameCount++;
          return frame();
        },
        fetchSnapshot: () async => frame(),
        onFrame: (_) {},
        onStatus: (s, {attempt = 0, maxAttempts = 5, message}) {},
      );

      driver.start();
      async.flushMicrotasks();
      async.elapse(interval);
      final before = frameCount;

      driver.pause();
      async.elapse(interval * 3);
      expect(frameCount, before, reason: 'pauzada kadr olinmaydi');

      driver.resume();
      async.flushMicrotasks();
      async.elapse(interval);
      expect(frameCount, greaterThan(before));
      driver.dispose();
    });
  });
}
