import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/face_recognition/domain/services/recognition_state_machine.dart';
import 'package:m_edu/features/face_recognition/domain/value_objects/biometric_policy.dart';

/// Vaqtinchalik konsensus (spec §16) — yagona kadrdan identifikatsiya qarori
/// qabul qilinmaydi. Bu testlar "bir kadr = bitta odam" xatosini himoyalaydi.
void main() {
  late TemporalConsensusTracker tracker;
  late DateTime now;

  setUp(() {
    now = DateTime(2026, 8, 17, 10, 0, 0);
    tracker = TemporalConsensusTracker(
      policy: BiometricPolicy.validated(const BiometricPolicy()),
      now: () => now,
    );
  });

  ConfirmationUpdate feed(
          {String? id, bool ambiguous = false, double c = 0.95, DateTime? at}) =>
      tracker.feed(
          identityId: id, ambiguous: ambiguous, confidence: c, at: at ?? now);

  group('TemporalConsensusTracker (spec §16)', () {
    test('bir xil nomzod requiredStableFrames marta → confirmed', () {
      expect(feed(id: 'A').status, ConfirmationStatus.confirming);
      expect(feed(id: 'A').status, ConfirmationStatus.confirming);
      final third = feed(id: 'A');
      expect(third.status, ConfirmationStatus.confirmed);
      expect(third.candidateIdentityId, 'A');
      expect(third.confirmedFrames, 3);
      expect(third.requiredFrames, 3);
    });

    test('nomzod almashishi (A→B) zanjirni tozalaydi — chayqalish', () {
      feed(id: 'A');
      feed(id: 'A');
      // Yuz "A" → "B" ga almashdi — yig'ilgan ishonch bekor.
      final switched = feed(id: 'B');
      expect(switched.status, ConfirmationStatus.confirming);
      expect(switched.confirmedFrames, 1);
      expect(switched.candidateIdentityId, 'B');
    });

    test('A,B,A ketma-ketligi hech qachon confirmed bo\'lmaydi (flapping)', () {
      feed(id: 'A');
      feed(id: 'B');
      feed(id: 'A');
      // Har bir almashish zanjirni 1 ga tushiradi — 3 kadrda ham 3 ta
      // ketma-ket bir xil nomzod yo'q.
      expect(tracker.confirmedFrames, 1);
      expect(tracker.candidateIdentityId, 'A');
    });

    test('UNKNOWN (null) zanjirni tozalaydi', () {
      feed(id: 'A');
      feed(id: 'A');
      final unknown = feed(id: null);
      expect(unknown.status, ConfirmationStatus.unknown);
      expect(tracker.confirmedFrames, 0);
    });

    test('AMBIGUOUS zanjirni tozalaydi', () {
      feed(id: 'A');
      feed(id: 'A');
      final ambiguous = feed(id: 'A', ambiguous: true);
      expect(ambiguous.status, ConfirmationStatus.ambiguous);
      expect(tracker.confirmedFrames, 0);
    });

    test('konsensus temporalWindow ichida tugashi shart', () {
      feed(id: 'A', at: now);
      feed(id: 'A', at: now.add(const Duration(seconds: 1)));
      // Oyna tugadi (10s) — zanjir qayta boshlanadi.
      final late = feed(id: 'A', at: now.add(const Duration(seconds: 11)));
      expect(late.status, ConfirmationStatus.confirming);
      expect(late.confirmedFrames, 1);
    });

    test('reset sessiyani tozalaydi', () {
      feed(id: 'A');
      feed(id: 'A');
      tracker.reset();
      expect(tracker.confirmedFrames, 0);
      expect(tracker.candidateIdentityId, isNull);
      expect(feed(id: 'A').status, ConfirmationStatus.confirming);
    });

    test('requiredStableFrames=4 sozlanadigan', () {
      final strict = TemporalConsensusTracker(
        policy: BiometricPolicy.validated(
          const BiometricPolicy(requiredStableFrames: 4),
        ),
        now: () => now,
      );
      strict.feed(identityId: 'A', ambiguous: false, confidence: 0.9, at: now);
      strict.feed(identityId: 'A', ambiguous: false, confidence: 0.9, at: now);
      strict.feed(identityId: 'A', ambiguous: false, confidence: 0.9, at: now);
      expect(strict.feed(identityId: 'A', ambiguous: false, confidence: 0.9, at: now).status,
          ConfirmationStatus.confirmed);
    });

    test('isConfirmed helper', () {
      final r1 = feed(id: 'A');
      expect(r1.isConfirmed, isFalse);
      feed(id: 'A');
      final r3 = feed(id: 'A');
      expect(r3.isConfirmed, isTrue);
    });
  });
}
