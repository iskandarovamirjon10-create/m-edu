import '../domain/value_objects/biometric_policy.dart';
import '../domain/value_objects/face_signature.dart';

/// Yuz moslashuvi natijasi.
class FaceMatch {
  final String identityId;
  final double confidence;
  final bool ambiguous;

  const FaceMatch({
    required this.identityId,
    required this.confidence,
    this.ambiguous = false,
  });
}

/// Ro'yxatga olingan yuz namunasi.
class EnrolledFace {
  final String identityId;
  final FaceSignature signature;

  const EnrolledFace({required this.identityId, required this.signature});
}

/// Yuz imzolarini moslashtiruvchi sof Dart logikasi.
///
/// Bu sinf hech qanday ML kutubxonasiga bog'liq emas — unit test
/// qilish oson.
class FaceMatcher {
  /// Tanib olish chegarasi: undan yuqori o'xshashlik "tanildi" degani.
  final double matchThreshold;

  /// "Noaniq zona": bu chegara bilan [matchThreshold] orasidagi
  /// o'xshashlik — noaniq deb hisoblanadi.
  final double ambiguousThreshold;

  /// Eng yaxshi va ikkinchi eng yaxshi mos o'rtasidagi minimal farq.
  ///
  /// Ikkita o'xshash yuz (masalan egizaklar yoki bir-biriga juda
  /// o'xshash shaxslar) bo'lsa, eng yuqori ball shunchaki qabul
  /// qilinmaydi — false accept xavfi oldi olinadi. Agar ikkinchi eng
  /// yaxshi mos ham noaniq zonada bo'lsa va farq [marginThreshold]'dan
  /// kichik bo'lsa, natija "noaniq" deb belgilanadi.
  final double marginThreshold;

  const FaceMatcher({
    this.matchThreshold = 0.92,
    this.ambiguousThreshold = 0.88,
    this.marginThreshold = 0.05,
  });

  /// Markazlashtirilgan [BiometricPolicy] dan qurilgan matcher (spec §9).
  ///
  /// Thresholdlar yagona policy manbaidan keladi — kod bo'ylab sochilgan
  /// sehrli sonlar yo'q. Eski konstruktor (default qiymatlar) o'zgarishsiz
  /// qoldirilgan — mavjud testlar buzilmaydi.
  factory FaceMatcher.fromPolicy(BiometricPolicy policy) {
    return FaceMatcher(
      matchThreshold: policy.matchThreshold,
      ambiguousThreshold: policy.ambiguousThreshold,
      marginThreshold: policy.marginThreshold,
    );
  }

  /// Eng yaxshi mosni qidiradi. Mos topilmasa — null.
  FaceMatch? findBestMatch(
    FaceSignature probe,
    List<EnrolledFace> enrolled,
  ) {
    if (probe.isEmpty || enrolled.isEmpty) return null;

    EnrolledFace? best;
    EnrolledFace? secondBest;
    var bestScore = double.negativeInfinity;
    var secondScore = double.negativeInfinity;

    for (final face in enrolled) {
      final score = probe.cosineSimilarity(face.signature);
      if (score > bestScore) {
        secondBest = best;
        secondScore = bestScore;
        bestScore = score;
        best = face;
      } else if (score > secondScore) {
        secondScore = score;
        secondBest = face;
      }
    }
    if (best == null) return null;

    if (bestScore < ambiguousThreshold) return null;

    // Margin tekshiruvi: ikkinchi eng yaxshi ham ishonchli zonada bo'lsa
    // va farq juda kichik bo'lsa — chalkashlik xavfi, noaniq deb qaytaramiz.
    final marginViolated = secondBest != null &&
        secondScore >= ambiguousThreshold &&
        (bestScore - secondScore) < marginThreshold;

    return FaceMatch(
      identityId: best.identityId,
      confidence: bestScore.clamp(0.0, 1.0),
      ambiguous: bestScore < matchThreshold || marginViolated,
    );
  }
}
