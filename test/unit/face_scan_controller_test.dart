import 'dart:async';

import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/face_recognition/application/face_matcher.dart';
import 'package:m_edu/features/face_recognition/application/face_scan_controller.dart';
import 'package:m_edu/features/face_recognition/application/face_scan_state.dart';
import 'package:m_edu/features/face_recognition/domain/errors/face_recognition_error.dart';
import 'package:m_edu/features/face_recognition/domain/services/liveness_service.dart';
import 'package:m_edu/features/face_recognition/domain/value_objects/biometric_policy.dart';
import 'package:m_edu/features/face_recognition/domain/value_objects/face_recognition_result.dart';
import 'package:m_edu/features/face_recognition/domain/value_objects/face_signature.dart';

/// FaceScanController — yuz skan qaror dvigateli (spec §3, §16, §42, §43).
///
/// Test qamrovi:
///  - bitta kadrdan davomat YO'Q (vaqtinchalik konsensus talab qilinadi);
///  - N barqaror kadr → Identified;
///  - chayqalish (A,B,A) hech qachon identifikatsiya qilmaydi;
///  - UNKNOWN / AMBIGUOUS alohida holatlar;
///  - liveness o'tmaguncha moslik qilinmaydi;
///  - cooldown — dublikat davomat yozilmaydi;
///  - eski (stale) kadr natijasi bekor qilinadi (§42);
///  - galereya xatosi → GalleryUnavailableError.
void main() {
  late _Harness h;

  setUp(() {
    h = _Harness();
  });

  Future<void> flush() => pumpEventQueue();

  group('Vaqtinchalik konsensus (spec §16)', () {
    test('bitta kadr Identified qilmaydi — Confirming dan oshmaydi', () async {
      h.enroll('A');
      h.controller.handleFrame(h.detected('A'));
      await flush();

      final state = h.controller.state;
      expect(state, isA<FaceScanConfirming>());
      expect((state as FaceScanConfirming).confirmedFrames, 1);
      expect(h.attendanceWrites, 0);
    });

    test('N ketma-ket barqaror kadr → Identified + bitta attendance yozuvi',
        () async {
      h.enroll('A');
      for (var i = 0; i < 3; i++) {
        h.controller.handleFrame(h.detected('A'));
        await flush();
      }

      final state = h.controller.state;
      expect(state, isA<FaceScanIdentified>());
      expect((state as FaceScanIdentified).identityId, 'A');
      expect(h.attendanceWrites, 1);
    });

    test('nomzod chayqalishi (A,B,A) hech qachon Identified bo\'lmaydi',
        () async {
      h.enroll('A');
      h.enroll('B');
      for (var i = 0; i < 6; i++) {
        h.controller.handleFrame(h.detected(i.isEven ? 'A' : 'B'));
        await flush();
      }
      expect(h.controller.state, isNot(isA<FaceScanIdentified>()));
      expect(h.attendanceWrites, 0);
    });

    test('NoFace kadri zanjirni tozalaydi — qayta 3 kadr kerak', () async {
      h.enroll('A');
      h.controller.handleFrame(h.detected('A'));
      await flush();
      h.controller.handleFrame(h.detected('A'));
      await flush();
      // Yuz chiqib ketdi.
      h.controller.handleFrame(const NoFaceFrameEvent());
      await flush();
      expect(h.controller.state, isA<FaceScanWatching>());

      // Yana 2 kadr — 3 talik zanjir qayta yig'ilishi shart.
      h.controller.handleFrame(h.detected('A'));
      await flush();
      h.controller.handleFrame(h.detected('A'));
      await flush();
      expect(h.controller.state, isA<FaceScanConfirming>());
      expect(h.attendanceWrites, 0);

      h.controller.handleFrame(h.detected('A'));
      await flush();
      expect(h.controller.state, isA<FaceScanIdentified>());
    });
  });

  group('UNKNOWN / AMBIGUOUS (spec §46)', () {
    test('hech qanday nomzod thresholddan o\'tmasa → Unknown', () async {
      h.enroll('A');
      h.controller.handleFrame(h.detected('X')); // galereyada yo'q
      await flush();
      expect(h.controller.state, isA<FaceScanUnknown>());
    });

    test('ikkita yaqin nomzod → Ambiguous (margin buzilgan)', () async {
      h.enrollNear('C1', [1, 0, 0, 0, 0, 0, 0, 0]);
      h.enrollNear('C2', [1, 0.01, 0, 0, 0, 0, 0, 0]);
      h.controller.handleFrame(h.detectedVector('probe', [1, 0, 0, 0, 0, 0, 0, 0]));
      await flush();
      expect(h.controller.state, isA<FaceScanAmbiguous>());
      expect(h.attendanceWrites, 0);
    });

    test('noaniq natijada kuzatuv yozuvi chiqariladi (observability)', () async {
      h.enroll('A');
      h.controller.handleFrame(h.detected('X'));
      await flush();
      expect(h.results.map((r) => r.outcome), contains(FaceRecognitionOutcome.unknown));
    });
  });

  group('Liveness gate (spec §11)', () {
    test('jonlilik o\'tmaguncha moslik qilinmaydi', () async {
      h.useRealLiveness(requiredBlinks: 1);
      h.enroll('A');

      // Ko'z ochiq — hali blink yo'q.
      h.controller.handleFrame(h.detected('A', eyeOpenness: 0.9));
      await flush();
      expect(h.controller.state, isA<FaceScanFaceDetected>());
      expect(h.attendanceWrites, 0);

      // Blink: ochiq → yopiq → ochiq.
      h.controller.handleFrame(h.detected('A', eyeOpenness: 0.1));
      await flush();
      await Future<void>.delayed(const Duration(milliseconds: 80));
      h.controller.handleFrame(h.detected('A', eyeOpenness: 0.9));
      await flush();
      // Endi live — 3 kadr konsensusdan so'ng Identified.
      h.controller.handleFrame(h.detected('A', eyeOpenness: 0.9));
      await flush();
      h.controller.handleFrame(h.detected('A', eyeOpenness: 0.9));
      await flush();
      expect(h.controller.state, isA<FaceScanIdentified>());
      expect(h.attendanceWrites, 1);
    });

    test('liveness timeout — foto/ekran replay rad etiladi, sessiya tozalanadi',
        () async {
      h.useRealLiveness(requiredBlinks: 1, window: const Duration(milliseconds: 400));
      h.enroll('A');

      h.controller.handleFrame(h.detected('A', eyeOpenness: 0.9));
      await flush();
      await Future<void>.delayed(const Duration(milliseconds: 450));
      h.controller.handleFrame(h.detected('A', eyeOpenness: 0.9));
      await flush();

      final state = h.controller.state;
      expect(state, isA<FaceScanFaceDetected>());
      expect((state as FaceScanFaceDetected).liveness.status,
          LivenessStatus.timedOut);
      expect(h.attendanceWrites, 0);
      // Timeout natija yozuvi chiqdi.
      expect(h.results.map((r) => r.outcome),
          contains(FaceRecognitionOutcome.livenessFailed));
    });
  });

  group('Cooldown (spec §19)', () {
    test('o\'sha identity cooldown ichida qayta yozilmaydi', () async {
      h.enroll('A');
      for (var i = 0; i < 3; i++) {
        h.controller.handleFrame(h.detected('A'));
        await flush();
      }
      expect(h.attendanceWrites, 1);

      // Cooldown ichida (1s o'tdi, 15s kerak).
      h.advance(Duration(seconds: 1));
      for (var i = 0; i < 3; i++) {
        h.controller.handleFrame(h.detected('A'));
        await flush();
      }
      final state = h.controller.state;
      expect(state, isA<FaceScanIdentified>());
      expect((state as FaceScanIdentified).cooldownActive, isTrue);
      expect(h.attendanceWrites, 1, reason: 'cooldown ichida qayta yozuv yo\'q');
    });

    test('cooldown tugagach qayta tasdiqlash mumkin', () async {
      h.enroll('A');
      for (var i = 0; i < 3; i++) {
        h.controller.handleFrame(h.detected('A'));
        await flush();
      }
      expect(h.attendanceWrites, 1);

      h.advance(const Duration(seconds: 16));
      for (var i = 0; i < 3; i++) {
        h.controller.handleFrame(h.detected('A'));
        await flush();
      }
      expect(h.attendanceWrites, 2);
      final state = h.controller.state;
      expect((state as FaceScanIdentified).cooldownActive, isFalse);
    });
  });

  group('Eski natija himoyasi (spec §42)', () {
    test('kechikkan kadr natijasi joriy bo\'lmasa bekor qilinadi', () async {
      h.enroll('A');
      // Birinchi kadrning galereya yuklanishi osilib qoladi.
      final completer = Completer<List<EnrolledFace>>();
      h.slowGallery = () => completer.future;

      h.controller.handleFrame(h.detected('A'));
      await flush();

      // Yangi kadr keladi (yuz yo'q) — ketma-ketlik oshdi.
      h.controller.handleFrame(const NoFaceFrameEvent());
      await flush();

      // Eski kadrning galereyasi endi tugadi — natija bekor qilinishi kerak.
      completer.complete(h.enrolledFaces);
      await flush();

      // State Watching bo'lib qoladi — Confirming/Identified ga o'tmaydi.
      expect(h.controller.state, isA<FaceScanWatching>());
      expect(h.attendanceWrites, 0);
    });
  });

  group('Galereya xatosi (spec §34)', () {
    test('galereya yuklanmasa → GalleryUnavailableError, retryable', () async {
      h.enroll('A');
      h.galleryThrows = true;
      h.controller.handleFrame(h.detected('A'));
      await flush();

      final state = h.controller.state;
      expect(state, isA<FaceScanFailed>());
      final failed = state as FaceScanFailed;
      expect(failed.error, isA<GalleryUnavailableError>());
      expect(failed.retryable, isTrue);
    });
  });

  group('Attendance natijasi (spec §18)', () {
    test('writer natijasi UI holatga qaytadi', () async {
      h.enroll('A');
      h.attendanceOutcome = const FaceAttendanceOutcome(
        recorded: true,
      );
      for (var i = 0; i < 3; i++) {
        h.controller.handleFrame(h.detected('A'));
        await flush();
      }

      final state = h.controller.state as FaceScanIdentified;
      expect(state.attendance?.recorded, isTrue);
    });

    test('dublikat natija (AlreadyRecorded) ko\'rsatiladi', () async {
      h.enroll('A');
      h.attendanceOutcome = const FaceAttendanceOutcome(duplicate: true);
      for (var i = 0; i < 3; i++) {
        h.controller.handleFrame(h.detected('A'));
        await flush();
      }
      final state = h.controller.state as FaceScanIdentified;
      expect(state.attendance?.duplicate, isTrue);
      expect(state.attendance?.recorded, isFalse);
    });
  });

  group('2+ yuz va sifat rad etilishi', () {
    test('MultipleFaces → holat, moslik qilinmaydi', () async {
      h.enroll('A');
      h.controller.handleFrame(const MultipleFacesFrameEvent());
      await flush();
      expect(h.controller.state, isA<FaceScanMultipleFaces>());
      expect(h.attendanceWrites, 0);
    });

    test('FaceRejected → holat, konsensus tozalanadi', () async {
      h.enroll('A');
      h.controller.handleFrame(h.detected('A'));
      await flush();
      h.controller.handleFrame(const FaceRejectedFrameEvent());
      await flush();
      expect(h.controller.state, isA<FaceScanQualityRejected>());

      // Yana bitta kadr — zanjir qayta yig'ilishi kerak (2 kerak).
      h.controller.handleFrame(h.detected('A'));
      await flush();
      expect(h.controller.state, isA<FaceScanConfirming>());
      expect(h.attendanceWrites, 0);
    });
  });

  group('Adversarial sequences (spec §58 — security)', () {
    test('A A A → accept A (benign sequence)', () async {
      h.enroll('A');
      for (var i = 0; i < 3; i++) {
        h.controller.handleFrame(h.detected('A'));
        await flush();
      }
      expect(h.controller.state, isA<FaceScanIdentified>());
      expect((h.controller.state as FaceScanIdentified).identityId, 'A');
      expect(h.attendanceWrites, 1);
    });

    test('A A B A B → MUST NOT incorrectly accept A', () async {
      h.enroll('A');
      h.enroll('B');
      final frames = ['A', 'A', 'B', 'A', 'B'];
      for (final id in frames) {
        h.controller.handleFrame(h.detected(id));
        await flush();
      }
      // Chayqalish tufayli hech qachon confirmed bo'lmaydi.
      expect(h.controller.state, isNot(isA<FaceScanIdentified>()));
      expect(h.attendanceWrites, 0);
    });

    test('A B A B A → deterministic, attendance yozilmaydi', () async {
      h.enroll('A');
      h.enroll('B');
      final frames = ['A', 'B', 'A', 'B', 'A'];
      for (final id in frames) {
        h.controller.handleFrame(h.detected(id));
        await flush();
      }
      // Har bir almashish zanjirni 1 ga tushiradi — 3 ketrma-ket bir xil yo'q.
      expect(h.controller.state, isNot(isA<FaceScanIdentified>()));
      expect(h.attendanceWrites, 0);
    });

    test('A A B B A A B → A va B uchun ham aniq xulosa chiqmaydi', () async {
      h.enroll('A');
      h.enroll('B');
      final frames = ['A', 'A', 'B', 'B', 'A', 'A', 'B'];
      for (final id in frames) {
        h.controller.handleFrame(h.detected(id));
        await flush();
      }
      // 2 tadan keyin almashish — 3 ketrma-ket yig'ilmaydi.
      expect(h.controller.state, isNot(isA<FaceScanIdentified>()));
      expect(h.attendanceWrites, 0);
    });

    test('empty vector → matcher returns null → Unknown', () async {
      h.enroll('A');
      h.controller.handleFrame(h.detectedVector('probe', []));
      await flush();
      expect(h.controller.state, isA<FaceScanUnknown>());
      expect(h.attendanceWrites, 0);
    });

    test('cooldown reset after identity switch', () async {
      h.enroll('A');
      h.enroll('B');

      // Identify A.
      for (var i = 0; i < 3; i++) {
        h.controller.handleFrame(h.detected('A'));
        await flush();
      }
      expect(h.attendanceWrites, 1);

      // Cooldown ichida (1s).
      h.advance(const Duration(seconds: 1));

      // Switch to B — 3 kadr B.
      for (var i = 0; i < 3; i++) {
        h.controller.handleFrame(h.detected('B'));
        await flush();
      }
      // B yangi identity — cooldown A uchun, B uchun yo'q.
      expect(h.attendanceWrites, 2);
      expect((h.controller.state as FaceScanIdentified).identityId, 'B');
    });
  });
}

/// Test skafold — real matcher, fake galereya va soat.
class _Harness {
  final List<EnrolledFace> enrolledFaces = [];
  final List<FaceRecognitionResult> results = [];
  final BiometricPolicy policy =
      BiometricPolicy.validated(const BiometricPolicy());

  DateTime now = DateTime(2026, 8, 17, 10);
  int attendanceWrites = 0;
  FaceAttendanceOutcome attendanceOutcome =
      const FaceAttendanceOutcome(recorded: true);
  bool galleryThrows = false;
  Future<List<EnrolledFace>> Function()? slowGallery;
  bool useRealLivenessService = false;
  LivenessConfig realLivenessConfig = const LivenessConfig();

  late final FaceScanController controller;

  _Harness() {
    final matcher = FaceMatcher.fromPolicy(policy);
    controller = FaceScanController(
      policy: policy,
      matcher: matcher,
      loadGallery: _loadGallery,
      createLiveness: () => useRealLivenessService
          ? LivenessService(config: realLivenessConfig)
          : LivenessService(config: const LivenessConfig(enabled: false)),
      attendanceWriter: (identified) async {
        attendanceWrites++;
        return attendanceOutcome;
      },
      onResult: results.add,
      cameraSource: 'test',
      clock: () => now,
    );
  }

  Future<List<EnrolledFace>> _loadGallery() async {
    if (galleryThrows) throw StateError('isar down');
    if (slowGallery != null) return slowGallery!();
    return enrolledFaces;
  }

  void advance(Duration d) => now = now.add(d);

  void useRealLiveness({int requiredBlinks = 2, Duration? window}) {
    useRealLivenessService = true;
    realLivenessConfig = LivenessConfig(
      requiredBlinks: requiredBlinks,
      window: window ?? const Duration(seconds: 8),
      minBlinkDuration: const Duration(milliseconds: 50),
    );
  }

  /// Deterministik imzo: 'A' → [1,0,0,0,0,0,0,0], 'B' → [0,1,0,...].
  static List<double> _vectorFor(String id) {
    final idx = id.codeUnitAt(0) % 8;
    return List<double>.generate(8, (i) => i == idx ? 1.0 : 0.0);
  }

  void enroll(String id) {
    enrolledFaces.add(EnrolledFace(
      identityId: id,
      signature: FaceSignature(vector: _vectorFor(id), source: 'test'),
    ));
  }

  void enrollNear(String id, List<double> vector) {
    enrolledFaces.add(EnrolledFace(
      identityId: id,
      signature: FaceSignature(vector: vector, source: 'test'),
    ));
  }

  FaceDetectedFrameEvent detected(String id, {double eyeOpenness = 0.9}) =>
      detectedVector(id, _vectorFor(id), eyeOpenness: eyeOpenness);

  FaceDetectedFrameEvent detectedVector(String id, List<double> vector,
          {double eyeOpenness = 0.9}) =>
      FaceDetectedFrameEvent(
        signature: FaceSignature(vector: vector, source: 'test'),
        confidence: 0.95,
        eyeOpenness: eyeOpenness,
      );
}
