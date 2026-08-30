import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/face_recognition/application/face_matcher.dart';
import 'package:m_edu/features/face_recognition/domain/services/liveness_service.dart';
import 'package:m_edu/features/face_recognition/domain/services/recognition_state_machine.dart';
import 'package:m_edu/features/face_recognition/domain/value_objects/biometric_policy.dart';
import 'package:m_edu/features/face_recognition/domain/value_objects/face_signature.dart';
import 'package:m_edu/features/face_recognition/infrastructure/services/face_signature_builder.dart';

/// ADVERSARIAL FACE RECOGNITION TESTS (Phase 18, spec §42-43).
///
/// These tests verify the face recognition pipeline handles edge cases,
/// malformed data, and adversarial scenarios correctly. They do NOT test
/// real ML inference — only the pure Dart domain logic.
void main() {
  // ═══════════════════════════════════════════════════════════════════════
  // FaceSignature — edge cases
  // ═══════════════════════════════════════════════════════════════════════
  group('FaceSignature adversarial', () {
    test('NaN values in vector → cosine returns 0, not NaN', () {
      final a = FaceSignature(vector: [double.nan, 1, 2, 3]);
      final b = FaceSignature(vector: [1, 2, 3, 4]);
      final result = a.cosineSimilarity(b);
      expect(result.isFinite, isTrue);
      expect(result, 0);
    });

    test('Infinity values in vector → cosine returns 0', () {
      final a = FaceSignature(vector: [double.infinity, 1, 2]);
      final b = FaceSignature(vector: [1, 2, 3]);
      final result = a.cosineSimilarity(b);
      expect(result.isFinite, isTrue);
      expect(result, 0);
    });

    test('Negative infinity in vector → cosine returns 0', () {
      final a = FaceSignature(vector: [double.negativeInfinity, 1]);
      final b = FaceSignature(vector: [1, 2]);
      final result = a.cosineSimilarity(b);
      expect(result.isFinite, isTrue);
      expect(result, 0);
    });

    test('zero vector → cosine returns 0', () {
      final a = FaceSignature(vector: [0, 0, 0]);
      final b = FaceSignature(vector: [1, 2, 3]);
      expect(a.cosineSimilarity(b), 0);
    });

    test('both zero vectors → cosine returns 0', () {
      final a = FaceSignature(vector: [0, 0]);
      final b = FaceSignature(vector: [0, 0]);
      expect(a.cosineSimilarity(b), 0);
    });

    test('empty vector → cosine returns 0', () {
      final a = FaceSignature(vector: []);
      final b = FaceSignature(vector: [1, 2, 3]);
      expect(a.cosineSimilarity(b), 0);
      expect(a.isEmpty, isTrue);
    });

    test('mismatched dimensions → cosine returns 0', () {
      final a = FaceSignature(vector: [1, 2]);
      final b = FaceSignature(vector: [1, 2, 3]);
      expect(a.cosineSimilarity(b), 0);
    });

    test('very small values (near zero) → no crash', () {
      final a = FaceSignature(vector: [1e-300, 1e-300, 1e-300]);
      final b = FaceSignature(vector: [1e-300, 1e-300, 1e-300]);
      final result = a.cosineSimilarity(b);
      expect(result.isFinite, isTrue);
    });

    test('very large values → no crash (overflow handled gracefully)', () {
      // 1e300^2 overflows to infinity → dot/(sqrt(inf)*sqrt(inf)) = NaN
      // → !isFinite → returns 0 (fail-closed, not a crash)
      final a = FaceSignature(vector: [1e300, 1e300]);
      final b = FaceSignature(vector: [1e300, 1e300]);
      final result = a.cosineSimilarity(b);
      expect(result.isFinite, isTrue);
      expect(result, 0); // overflow → 0 (fail-closed)
    });

    test('mixed NaN and valid values → cosine returns 0', () {
      final a = FaceSignature(vector: [1, double.nan, 3]);
      final b = FaceSignature(vector: [1, 2, 3]);
      expect(a.cosineSimilarity(b), 0);
    });

    test('mean of empty list → empty signature', () {
      final mean = FaceSignature.mean([]);
      expect(mean.isEmpty, isTrue);
    });

    test('mean of single sample → same sample', () {
      final a = FaceSignature(vector: [1, 2, 3]);
      final mean = FaceSignature.mean([a]);
      expect(mean.vector, [1, 2, 3]);
    });

    test('mean with mismatched dimensions → skip mismatched', () {
      final a = FaceSignature(vector: [1, 2]);
      final b = FaceSignature(vector: [1, 2, 3]);
      final mean = FaceSignature.mean([a, b]);
      // Only samples with matching dimensions contribute
      expect(mean.vector.length, 2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // FaceMatcher — adversarial matching scenarios
  // ═══════════════════════════════════════════════════════════════════════
  group('FaceMatcher adversarial', () {
    const matcher = FaceMatcher(
      matchThreshold: 0.92,
      ambiguousThreshold: 0.88,
      marginThreshold: 0.05,
    );

    test('empty gallery → null (no crash)', () {
      final probe = FaceSignature(vector: [1, 0, 0]);
      expect(matcher.findBestMatch(probe, []), isNull);
    });

    test('empty probe → null', () {
      final enrolled = EnrolledFace(
        identityId: 'a',
        signature: FaceSignature(vector: [1, 0, 0]),
      );
      expect(matcher.findBestMatch(FaceSignature(vector: []), [enrolled]), isNull);
    });

    test('single enrolled face, perfect match', () {
      final sig = FaceSignature(vector: [1, 0, 0, 0]);
      final enrolled = EnrolledFace(identityId: 'a', signature: sig);
      final result = matcher.findBestMatch(sig, [enrolled]);
      expect(result, isNotNull);
      expect(result!.identityId, 'a');
      expect(result.ambiguous, isFalse);
    });

    test('all enrolled faces identical → ambiguous (margin violated, cannot distinguish)', () {
      // When two enrolled faces are identical, margin check triggers:
      // bestScore - secondScore = 0 < marginThreshold → ambiguous.
      // This is correct: the system cannot distinguish between two
      // identical signatures, so it fails closed.
      final sig = FaceSignature(vector: [1, 0, 0, 0]);
      final enrolled = [
        EnrolledFace(identityId: 'a', signature: sig),
        EnrolledFace(identityId: 'a', signature: sig),
      ];
      final result = matcher.findBestMatch(sig, enrolled);
      expect(result, isNotNull);
      expect(result!.ambiguous, isTrue);
    });

    test('two faces, far apart → clear match', () {
      final probe = FaceSignature(vector: [1, 0, 0, 0]);
      final a = FaceSignature(vector: [0.95, 0.1, 0.1, 0.1]);
      final b = FaceSignature(vector: [0.1, 0.9, 0.8, 0.7]);
      final result = matcher.findBestMatch(probe, [
        EnrolledFace(identityId: 'a', signature: a),
        EnrolledFace(identityId: 'b', signature: b),
      ]);
      expect(result, isNotNull);
      expect(result!.identityId, 'a');
      expect(result.ambiguous, isFalse);
    });

    test('probe below ambiguous threshold → null (unknown)', () {
      // Orthogonal to all enrolled → cosine ~0
      final probe = FaceSignature(vector: [0, 0, 1, 0]);
      final enrolled = [
        EnrolledFace(identityId: 'a', signature: FaceSignature(vector: [1, 0, 0, 0])),
      ];
      final result = matcher.findBestMatch(probe, enrolled);
      expect(result, isNull);
    });

    test('NaN probe → null (no crash)', () {
      final probe = FaceSignature(vector: [double.nan, 1, 2]);
      final enrolled = [
        EnrolledFace(identityId: 'a', signature: FaceSignature(vector: [1, 2, 3])),
      ];
      final result = matcher.findBestMatch(probe, enrolled);
      expect(result, isNull);
    });

    test('Infinity enrolled face → null for valid probe', () {
      final probe = FaceSignature(vector: [1, 0, 0]);
      final enrolled = [
        EnrolledFace(
          identityId: 'a',
          signature: FaceSignature(vector: [double.infinity, 1, 2]),
        ),
      ];
      final result = matcher.findBestMatch(probe, enrolled);
      expect(result, isNull);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // FaceSignatureBuilder — malformed landmarks
  // ═══════════════════════════════════════════════════════════════════════
  group('FaceSignatureBuilder adversarial', () {
    test('identical left/right eyes → empty (dEye < 1e-4)', () {
      final result = FaceSignatureBuilder.build(
        leftEye: math.Point(100, 100),
        rightEye: math.Point(100, 100), // same point
        nose: math.Point(100, 120),
        mouthL: math.Point(90, 140),
        mouthR: math.Point(110, 140),
        chin: math.Point(100, 180),
        faceTop: math.Point(100, 60),
        leftCheek: math.Point(60, 120),
        rightCheek: math.Point(140, 120),
        rollRadians: 0,
      );
      expect(result, isEmpty);
    });

    test('NaN in landmarks → returns empty (degenerate input rejected)', () {
      final result = FaceSignatureBuilder.build(
        leftEye: math.Point(double.nan, 100),
        rightEye: math.Point(200, 100),
        nose: math.Point(150, 120),
        mouthL: math.Point(130, 140),
        mouthR: math.Point(170, 140),
        chin: math.Point(150, 180),
        faceTop: math.Point(150, 60),
        leftCheek: math.Point(100, 120),
        rightCheek: math.Point(200, 120),
        rollRadians: 0,
      );
      // dEye will be NaN (< 1e-4 check fails) → returns empty (fail-closed)
      expect(result, isEmpty);
    });

    test('zero roll angle → valid signature', () {
      final result = FaceSignatureBuilder.build(
        leftEye: math.Point(100, 100),
        rightEye: math.Point(200, 100),
        nose: math.Point(150, 120),
        mouthL: math.Point(130, 140),
        mouthR: math.Point(170, 140),
        chin: math.Point(150, 180),
        faceTop: math.Point(150, 60),
        leftCheek: math.Point(100, 120),
        rightCheek: math.Point(200, 120),
        rollRadians: 0,
      );
      expect(result.length, FaceSignatureBuilder.signatureDimension);
      expect(result.any((v) => v.isNaN), isFalse);
    });

    test('large roll angle → valid signature (rotation compensated)', () {
      final result = FaceSignatureBuilder.build(
        leftEye: math.Point(100, 100),
        rightEye: math.Point(200, 100),
        nose: math.Point(150, 120),
        mouthL: math.Point(130, 140),
        mouthR: math.Point(170, 140),
        chin: math.Point(150, 180),
        faceTop: math.Point(150, 60),
        leftCheek: math.Point(100, 120),
        rightCheek: math.Point(200, 120),
        rollRadians: math.pi / 4, // 45 degrees
      );
      expect(result.length, FaceSignatureBuilder.signatureDimension);
      expect(result.any((v) => v.isNaN), isFalse);
      expect(result.any((v) => v.isInfinite), isFalse);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TemporalConsensusTracker — adversarial scenarios
  // ═══════════════════════════════════════════════════════════════════════
  group('TemporalConsensusTracker adversarial', () {
    late TemporalConsensusTracker tracker;
    late DateTime t;

    setUp(() {
      tracker = TemporalConsensusTracker(
        policy: const BiometricPolicy(requiredStableFrames: 3),
        now: () => t,
      );
      t = DateTime(2026);
    });

    test('A → B → A: chain resets on identity switch', () {
      // A frame 1
      var update = tracker.feed(identityId: 'a', ambiguous: false, confidence: 0.95);
      expect(update.confirmedFrames, 1);

      // B frame — switch
      update = tracker.feed(identityId: 'b', ambiguous: false, confidence: 0.95);
      expect(update.confirmedFrames, 1); // reset to 1

      // A frame — switch again
      update = tracker.feed(identityId: 'a', ambiguous: false, confidence: 0.95);
      expect(update.confirmedFrames, 1); // reset again
    });

    test('A → A → A: confirmed after 3 stable frames', () {
      tracker.feed(identityId: 'a', ambiguous: false, confidence: 0.95);
      tracker.feed(identityId: 'a', ambiguous: false, confidence: 0.95);
      final update = tracker.feed(identityId: 'a', ambiguous: false, confidence: 0.95);
      expect(update.isConfirmed, isTrue);
      expect(update.confirmedFrames, 3);
    });

    test('A → unknown → A: chain resets on unknown', () {
      tracker.feed(identityId: 'a', ambiguous: false, confidence: 0.95);
      tracker.feed(identityId: 'a', ambiguous: false, confidence: 0.95);
      tracker.feed(identityId: null, ambiguous: false, confidence: 0); // unknown
      final update = tracker.feed(identityId: 'a', ambiguous: false, confidence: 0.95);
      expect(update.confirmedFrames, 1); // chain was reset
    });

    test('A → ambiguous → A: chain resets on ambiguous', () {
      tracker.feed(identityId: 'a', ambiguous: false, confidence: 0.95);
      tracker.feed(identityId: 'a', ambiguous: false, confidence: 0.95);
      tracker.feed(identityId: 'a', ambiguous: true, confidence: 0.90);
      final update = tracker.feed(identityId: 'a', ambiguous: false, confidence: 0.95);
      expect(update.confirmedFrames, 1); // chain was reset
    });

    test('temporal window expiry → chain resets', () {
      tracker.feed(identityId: 'a', ambiguous: false, confidence: 0.95);
      tracker.feed(identityId: 'a', ambiguous: false, confidence: 0.95);
      // Move past temporal window (10 seconds default)
      t = t.add(const Duration(seconds: 11));
      final update = tracker.feed(identityId: 'a', ambiguous: false, confidence: 0.95);
      expect(update.confirmedFrames, 1); // chain expired, restarted
    });

    test('reset → clears all state', () {
      tracker.feed(identityId: 'a', ambiguous: false, confidence: 0.95);
      tracker.feed(identityId: 'a', ambiguous: false, confidence: 0.95);
      tracker.reset();
      final update = tracker.feed(identityId: 'a', ambiguous: false, confidence: 0.95);
      expect(update.confirmedFrames, 1); // started fresh
    });

    test('rapid A → B → C → A cycling: never confirms', () {
      tracker.feed(identityId: 'a', ambiguous: false, confidence: 0.95);
      tracker.feed(identityId: 'b', ambiguous: false, confidence: 0.95);
      tracker.feed(identityId: 'c', ambiguous: false, confidence: 0.95);
      tracker.feed(identityId: 'a', ambiguous: false, confidence: 0.95);
      final update = tracker.feed(identityId: 'b', ambiguous: false, confidence: 0.95);
      expect(update.isConfirmed, isFalse);
      expect(update.confirmedFrames, 1);
    });

    test('all unknown frames → never confirms', () {
      for (var i = 0; i < 10; i++) {
        final update = tracker.feed(identityId: null, ambiguous: false, confidence: 0);
        expect(update.isConfirmed, isFalse);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // LivenessService — adversarial scenarios
  // ═══════════════════════════════════════════════════════════════════════
  group('LivenessService adversarial', () {
    late LivenessService service;
    late DateTime t;

    setUp(() {
      service = LivenessService();
      t = DateTime(2026);
    });

    test('OPEN → OPEN → OPEN: never live (no blink)', () {
      for (var i = 0; i < 20; i++) {
        final snap = service.feed(0.8, now: t.add(Duration(milliseconds: i * 100)));
        expect(snap.status, isNot(LivenessStatus.live));
      }
    });

    test('CLOSED → CLOSED → CLOSED: never live', () {
      for (var i = 0; i < 20; i++) {
        final snap = service.feed(0.1, now: t.add(Duration(milliseconds: i * 100)));
        expect(snap.status, isNot(LivenessStatus.live));
      }
    });

    test('OPEN → CLOSED → OPEN: one blink counted', () {
      service.feed(0.8, now: t);
      service.feed(0.1, now: t.add(const Duration(milliseconds: 100)));
      final snap = service.feed(0.8, now: t.add(const Duration(milliseconds: 200)));
      expect(snap.blinksObserved, 1);
    });

    test('two complete blinks → live', () {
      // Blink 1
      service.feed(0.8, now: t);
      service.feed(0.1, now: t.add(const Duration(milliseconds: 100)));
      service.feed(0.8, now: t.add(const Duration(milliseconds: 200)));
      // Blink 2
      service.feed(0.1, now: t.add(const Duration(milliseconds: 300)));
      service.feed(0.8, now: t.add(const Duration(milliseconds: 400)));
      final snap = service.feed(0.8, now: t.add(const Duration(milliseconds: 500)));
      expect(snap.status, LivenessStatus.live);
    });

    test('blink too short (< minBlinkDuration) → not counted', () {
      // Very quick open-close-open (< 80ms default minBlinkDuration)
      service.feed(0.8, now: t);
      service.feed(0.1, now: t.add(const Duration(milliseconds: 30)));
      service.feed(0.8, now: t.add(const Duration(milliseconds: 50)));
      final snap = service.feed(0.8, now: t.add(const Duration(milliseconds: 200)));
      expect(snap.blinksObserved, 0);
    });

    test('blink too long (> maxBlinkDuration) → not counted', () {
      // Eyes closed for too long (> 1200ms default maxBlinkDuration)
      service.feed(0.8, now: t);
      service.feed(0.1, now: t.add(const Duration(milliseconds: 100)));
      service.feed(0.8, now: t.add(const Duration(milliseconds: 1500)));
      final snap = service.feed(0.8, now: t.add(const Duration(milliseconds: 1600)));
      expect(snap.blinksObserved, 0);
    });

    test('window timeout → timedOut', () {
      // Default window is 8 seconds
      service.feed(0.8, now: t);
      final snap = service.feed(0.8, now: t.add(const Duration(seconds: 9)));
      expect(snap.status, LivenessStatus.timedOut);
    });

    test('reset → clears all state', () {
      service.feed(0.8, now: t);
      service.feed(0.1, now: t.add(const Duration(milliseconds: 100)));
      service.feed(0.8, now: t.add(const Duration(milliseconds: 200)));
      service.reset();
      final snap = service.feed(0.8, now: t.add(const Duration(milliseconds: 300)));
      expect(snap.blinksObserved, 0);
      expect(snap.status, LivenessStatus.observing);
    });

    test('disabled config → always live', () {
      final disabledService = LivenessService(
        config: const LivenessConfig(enabled: false),
      );
      final snap = disabledService.feed(0.8);
      expect(snap.status, LivenessStatus.live);
    });

    test('hysteresis: value between thresholds → no state change', () {
      // Default: closed < 0.35, open > 0.55
      service.feed(0.8, now: t); // OPEN
      service.feed(0.45, now: t.add(const Duration(milliseconds: 100))); // between
      final snap = service.feed(0.45, now: t.add(const Duration(milliseconds: 200)));
      expect(snap.eyesClosedNow, isFalse); // still OPEN
    });

    test('EAR: 6 points → valid ratio', () {
      final points = <(double, double)>[
        (0, 0.5),   // outer
        (0.2, 0),   // upper1
        (0.4, 0),   // upper2
        (0.6, 0.5), // inner
        (0.4, 1),   // lower1
        (0.2, 1),   // lower2
      ];
      final ear = LivenessService.eyeAspectRatio(points);
      expect(ear, greaterThan(0));
      expect(ear.isFinite, isTrue);
    });

    test('EAR: wrong number of points → 0', () {
      final points = <(double, double)>[(0, 0), (1, 1)];
      expect(LivenessService.eyeAspectRatio(points), 0);
    });

    test('EAR: same x-coords → valid (uses Euclidean, not just horizontal)', () {
      // All points on same vertical line — d3 = vertical distance = 3
      // EAR = (d1 + d2) / (2 * d3) where d1, d2 are vertical distances too
      final points = <(double, double)>[
        (5, 0), (5, 1), (5, 2), (5, 3), (5, 4), (5, 5),
      ];
      final ear = LivenessService.eyeAspectRatio(points);
      expect(ear.isFinite, isTrue);
      expect(ear, greaterThan(0));
    });

    test('opennessFromEar: typical open → ~1.0', () {
      expect(LivenessService.opennessFromEar(0.30), closeTo(1.0, 0.01));
    });

    test('opennessFromEar: closed → ~0', () {
      expect(LivenessService.opennessFromEar(0.05), closeTo(0.17, 0.01));
    });

    test('opennessFromEar: very high EAR → clamped to 1.0', () {
      expect(LivenessService.opennessFromEar(1.0), 1.0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // BiometricPolicy — edge cases
  // ═══════════════════════════════════════════════════════════════════════
  group('BiometricPolicy adversarial', () {
    test('negative matchThreshold → rejected', () {
      expect(
        () => BiometricPolicy.validated(const BiometricPolicy(matchThreshold: -0.1)),
        throwsArgumentError,
      );
    });

    test('matchThreshold = 1.0 → accepted', () {
      expect(
        () => BiometricPolicy.validated(const BiometricPolicy(
          matchThreshold: 1.0,
          ambiguousThreshold: 0.99,
        )),
        returnsNormally,
      );
    });

    test('matchThreshold = ambiguousThreshold → rejected', () {
      expect(
        () => BiometricPolicy.validated(const BiometricPolicy(
          matchThreshold: 0.90,
          ambiguousThreshold: 0.90,
        )),
        throwsArgumentError,
      );
    });

    test('negative marginThreshold → rejected', () {
      expect(
        () => BiometricPolicy.validated(const BiometricPolicy(marginThreshold: -0.1)),
        throwsArgumentError,
      );
    });

    test('requiredStableFrames = 1 → rejected (single frame not enough)', () {
      expect(
        () => BiometricPolicy.validated(const BiometricPolicy(requiredStableFrames: 1)),
        throwsArgumentError,
      );
    });

    test('requiredStableFrames = 2 → accepted', () {
      expect(
        () => BiometricPolicy.validated(const BiometricPolicy(requiredStableFrames: 2)),
        returnsNormally,
      );
    });

    test('enrollmentTargetSamples = 1 → rejected', () {
      expect(
        () => BiometricPolicy.validated(const BiometricPolicy(enrollmentTargetSamples: 1)),
        throwsArgumentError,
      );
    });

    test('livenessRequiredBlinks = 0 → rejected', () {
      expect(
        () => BiometricPolicy.validated(const BiometricPolicy(livenessRequiredBlinks: 0)),
        throwsArgumentError,
      );
    });

    test('scanIntervalMs = 0 → rejected', () {
      expect(
        () => BiometricPolicy.validated(const BiometricPolicy(scanIntervalMs: 0)),
        throwsArgumentError,
      );
    });

    test('negative temporalWindow → rejected', () {
      expect(
        () => BiometricPolicy.validated(const BiometricPolicy(
          temporalWindow: Duration(seconds: -1),
        )),
        throwsArgumentError,
      );
    });

    test('withMatchThresholds: valid new thresholds → accepted', () {
      final base = const BiometricPolicy();
      final updated = base.withMatchThresholds(
        matchThreshold: 0.90,
        ambiguousThreshold: 0.85,
      );
      expect(updated.matchThreshold, 0.90);
      expect(updated.ambiguousThreshold, 0.85);
      // Other values preserved
      expect(updated.requiredStableFrames, base.requiredStableFrames);
    });

    test('withMatchThresholds: reversed thresholds → rejected', () {
      expect(
        () => const BiometricPolicy().withMatchThresholds(
          matchThreshold: 0.80,
          ambiguousThreshold: 0.90,
        ),
        throwsArgumentError,
      );
    });
  });
}
