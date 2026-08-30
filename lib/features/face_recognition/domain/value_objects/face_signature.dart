import 'dart:math' as math;

/// Yuzning geometrik "imzosi" — normalizatsiya qilingan vektor.
///
/// Yuz xususiyatlari (ko'z, burun, og'iz, iyak, yonoqlar) ko'zlar
/// orasidagi masofaga nisbatan o'lchab olinadi, shuning uchun kamera
/// masofasi/o'lchamidan bog'liq emas. Ikki yuzni solishtirish
/// [cosineSimilarity] orqali amalga oshiriladi.
class FaceSignature {
  /// Imzo vektori (bir xil o'lchamda bo'lishi shart).
  final List<double> vector;

  /// Yuz imzosi qaysi mexanizmdan olinganligi (masalan "mlkit-contour").
  final String source;

  const FaceSignature({required this.vector, this.source = 'mlkit-contour'});

  bool get isEmpty => vector.isEmpty;

  /// Ikki imzo orasidagi kosinus o'xshashlik (0..1).
  double cosineSimilarity(FaceSignature other) {
    return cosineSimilarityBetween(vector, other.vector);
  }

  /// O'rtacha (o'rtachalashtirilgan) imzo — enroll davomida
  /// bir nechta namuna o'rtachasini hisoblash uchun.
  static FaceSignature mean(List<FaceSignature> samples) {
    if (samples.isEmpty) {
      return const FaceSignature(vector: [], source: 'mean');
    }
    final dim = samples.first.vector.length;
    final acc = List<double>.filled(dim, 0);
    for (final sample in samples) {
      if (sample.vector.length != dim) continue;
      for (var i = 0; i < dim; i++) {
        acc[i] += sample.vector[i];
      }
    }
    final n = samples.length.toDouble();
    return FaceSignature(
      vector: acc.map((v) => v / n).toList(),
      source: 'mean(${samples.map((s) => s.source).toSet().join(',')})',
    );
  }

  static double cosineSimilarityBetween(List<double> a, List<double> b) {
    if (a.isEmpty || b.isEmpty || a.length != b.length) return 0;
    var dot = 0.0;
    var normA = 0.0;
    var normB = 0.0;
    for (var i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    // NaN/Infinity safety: malformed landmarks can produce non-finite
    // values. Return 0 (no match) rather than propagating NaN through
    // the matcher threshold logic.
    if (normA == 0 || normB == 0) return 0;
    final result = dot / (math.sqrt(normA) * math.sqrt(normB));
    if (!result.isFinite) return 0;
    return result;
  }

  @override
  String toString() =>
      'FaceSignature(dim=${vector.length}, source=$source)';
}
