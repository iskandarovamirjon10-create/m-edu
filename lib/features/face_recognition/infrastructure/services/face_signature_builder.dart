import 'dart:math' as math;

/// Yuz geometriyasidan normalizatsiya qilingan imzo vektori quruvchi.
///
/// ML Kit (Android) va TFLite/FaceMesh (Windows/Linux) dvigatellari
/// bir xil strukturani ishlatadi — ikkala platformada olingan imzolar
/// mos keladi.
///
/// ⚠️ CHEKLOV: Bu 21 o'lchamli GEOMETRIK imzo — neyron tarmoq
/// embeddingi EMAS. Yuz nuqtalari (ko'z, burun, og'iz, iyak, yonoqlar)
/// ko'zlar orasidagi masofaga nisbatan o'lchab olinadi.
///
/// Neyron embedding (MobileFaceNet, ArcFace, FaceNet) bilan solishtirganda:
/// - Kamroq ajratuvchi qobiliyat (discriminative power);
/// - O'xshash ko'rinishdagi odamlar (masalan, aka-uka) chalkashishi mumkin;
/// - Thresholdlar real korpus bilan kalibrlanishi shart.
///
/// [FaceEmbeddingService] interfeysi kelajak uchun tayyorlangan;
/// hozircha ishlatilmaydi.
class FaceSignatureBuilder {
  FaceSignatureBuilder._();

  /// Bir xil o'lchamdagi imzo vektori.
  static const int signatureDimension = 21;

  /// Imzo vektorini hisoblaydi (kosinus o'xshashlik uchun).
  ///
  /// Barcha nuqtalar ko'zlar orasidagi masofaga nisbatan, ko'zlar
  /// o'rtasida markazlashtirilgan holda normalizatsiya qilinadi;
  /// [rollRadians] — boshning o'ng-chapga egilishini kompensatsiya qiladi.
  static List<double> build({
    required math.Point<double> leftEye,
    required math.Point<double> rightEye,
    required math.Point<double> nose,
    required math.Point<double> mouthL,
    required math.Point<double> mouthR,
    required math.Point<double> chin,
    required math.Point<double> faceTop,
    required math.Point<double> leftCheek,
    required math.Point<double> rightCheek,
    required double rollRadians,
  }) {
    final eyeMid = _midpoint(leftEye, rightEye);
    final dEye = _distance(leftEye, rightEye);
    // NaN/Infinity safety: malformed landmarks can produce non-finite
    // inter-eye distance. Reject rather than propagating NaN through
    // the normalized signature.
    if (!dEye.isFinite || dEye < 1e-4) return const [];

    final cos = math.cos(-rollRadians);
    final sin = math.sin(-rollRadians);

    math.Point<double> norm(math.Point<double> p) {
      final dx = p.x - eyeMid.x;
      final dy = p.y - eyeMid.y;
      return math.Point<double>(
        (dx * cos - dy * sin) / dEye,
        (dx * sin + dy * cos) / dEye,
      );
    }

    final mouthMid = _midpoint(mouthL, mouthR);
    final points = [
      norm(nose),
      norm(mouthL),
      norm(mouthR),
      norm(mouthMid),
      norm(chin),
      norm(faceTop),
      norm(leftCheek),
      norm(rightCheek),
    ];

    final vector = <double>[];
    for (final p in points) {
      vector.add(p.x);
      vector.add(p.y);
    }

    final nChin = norm(chin);
    final nTop = norm(faceTop);
    final nLeftCheek = norm(leftCheek);
    final nRightCheek = norm(rightCheek);
    final faceW = _distance(nLeftCheek, nRightCheek);
    final faceH = _distance(nTop, nChin);
    vector.add(faceH <= 1e-4 ? 0 : faceW / faceH);
    vector.add(_distance(norm(nose), norm(mouthMid)));
    vector.add(_distance(norm(mouthL), norm(mouthR)));
    vector.add(_distance(norm(leftEye), norm(nose)));
    vector.add(_distance(norm(leftEye), nChin));

    if (vector.length != signatureDimension) {
      // RELEASE build'da assert ishlamaydi — bu runtime check muhim:
      // noto'g'ri o'lchamdagi imzo matcher'ni chalkashtiradi.
      return const <double>[];
    }
    // NaN/Infinity safety: reject any signature containing non-finite
    // values. These can arise from degenerate landmarks even when
    // dEye passes the initial check.
    if (vector.any((v) => !v.isFinite)) return const <double>[];
    return vector;
  }

  static math.Point<double> midpoint(math.Point<double> a, math.Point<double> b) =>
      math.Point<double>((a.x + b.x) / 2, (a.y + b.y) / 2);

  static double distance(math.Point<double> a, math.Point<double> b) {
    final dx = a.x - b.x;
    final dy = a.y - b.y;
    return math.sqrt(dx * dx + dy * dy);
  }

  static math.Point<double> _midpoint(
          math.Point<double> a, math.Point<double> b) =>
      midpoint(a, b);

  static double _distance(math.Point<double> a, math.Point<double> b) =>
      distance(a, b);
}
