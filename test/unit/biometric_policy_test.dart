import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/face_recognition/domain/value_objects/biometric_policy.dart';

/// BiometricPolicy — markazlashtirilgan versiyalangan biometrik siyosat
/// (spec §9, §55). Thresholdlar yagona manbada, validatsiya bilan.
void main() {
  group('BiometricPolicy (spec §9, §55)', () {
    test('default siyosat quriladi va versiyalanadi', () {
      final policy = const BiometricPolicy();
      expect(policy.version, 'BIOMETRIC_POLICY_V1');
      expect(policy.matchThreshold, 0.92);
      expect(policy.ambiguousThreshold, 0.88);
      expect(policy.marginThreshold, 0.05);
      expect(policy.requiredStableFrames, 3);
      expect(policy.recognitionCooldown, const Duration(seconds: 15));
    });

    test('validatsiya: noaniq zona match dan yuqori bo\'lmasligi shart', () {
      expect(
        () => BiometricPolicy.validated(
          const BiometricPolicy(ambiguousThreshold: 0.95, matchThreshold: 0.92),
        ),
        throwsArgumentError,
      );
    });

    test('validatsiya: matchThreshold 1 dan oshmasligi shart', () {
      expect(
        () => BiometricPolicy.validated(
          const BiometricPolicy(matchThreshold: 1.2),
        ),
        throwsArgumentError,
      );
    });

    test('validatsiya: margin musbat bo\'lishi shart', () {
      expect(
        () => BiometricPolicy.validated(
          const BiometricPolicy(marginThreshold: 0),
        ),
        throwsArgumentError,
      );
    });

    test('validatsiya: requiredStableFrames >= 2 (yagona kadr konsensus emas)', () {
      expect(
        () => BiometricPolicy.validated(
          const BiometricPolicy(requiredStableFrames: 1),
        ),
        throwsArgumentError,
      );
    });

    test('validatsiya: vaqt oynalari musbat', () {
      expect(
        () => BiometricPolicy.validated(
          const BiometricPolicy(temporalWindow: Duration.zero),
        ),
        throwsArgumentError,
      );
      expect(
        () => BiometricPolicy.validated(
          const BiometricPolicy(recognitionCooldown: Duration.zero),
        ),
        throwsArgumentError,
      );
    });

    test('validatsiya: enroll kamida 2 namuna talab qiladi (spec §4)', () {
      expect(
        () => BiometricPolicy.validated(
          const BiometricPolicy(enrollmentTargetSamples: 1),
        ),
        throwsArgumentError,
      );
    });

    test('validatsiya: enroll o\'xshashlik (0..1] oralig\'ida', () {
      expect(
        () => BiometricPolicy.validated(
          const BiometricPolicy(enrollmentMinSampleSimilarity: 0),
        ),
        throwsArgumentError,
      );
    });

    test('valid qiyomatlar o\'tadi (hech qanday exception)', () {
      final policy = BiometricPolicy.validated(const BiometricPolicy());
      expect(policy.matchThreshold, 0.92);
      expect(policy.requiredStableFrames, 3);
    });

    test('withMatchThresholds: kalibrlash natijasi qo\'llanadi', () {
      final base = const BiometricPolicy();
      final calibrated = BiometricPolicy.validated(
        base.withMatchThresholds(matchThreshold: 0.90, ambiguousThreshold: 0.85),
      );
      expect(calibrated.matchThreshold, 0.90);
      expect(calibrated.ambiguousThreshold, 0.85);
      // Boshqa qiymatlar saqlanadi.
      expect(calibrated.requiredStableFrames, base.requiredStableFrames);
      expect(calibrated.enrollmentTargetSamples, base.enrollmentTargetSamples);
    });

    test('withMatchThresholds: noto\'g\'ri kalibrlash rad etiladi', () {
      expect(
        () => BiometricPolicy.validated(
          const BiometricPolicy().withMatchThresholds(
            matchThreshold: 0.80,
            ambiguousThreshold: 0.90,
          ),
        ),
        throwsArgumentError,
      );
    });
  });
}
