import 'dart:math' as math;

/// Embedding modeli meta-ma'lumotlari (spec §10 — embedding versioning).
///
/// Model yoki preprocessing o'zgarsa (masalan FACE_MODEL_V1 → V2) eski
/// embeddinglar yangi model bilan SOLISHTIRILMASLIGI kerak: [versionKey]
/// farqli bo'lsa matcher 0 qaytaradi. Saqlangan har bir embedding shu
/// meta-ma'lumot bilan birga yoziladi (FaceRecord'da modelName,
/// modelVersion, embeddingDimension, preprocessingVersion).
class EmbeddingModelInfo {
  /// Model nomi (masalan 'mobilefacenet', 'arcface-r100', 'facenet').
  final String modelName;

  /// Model versiyasi (masalan 'FACE_MODEL_V1').
  final String modelVersion;

  /// Embedding o'lchami (MobileFaceNet 128, ArcFace R100 512...).
  final int embeddingDimension;

  /// Preprocessing versiyasi (input o'lchami/normalizatsiya o'zgarsa
  /// boshqa versiya).
  final String preprocessingVersion;

  const EmbeddingModelInfo({
    required this.modelName,
    required this.modelVersion,
    required this.embeddingDimension,
    required this.preprocessingVersion,
  });

  /// Versioning/migration kaliti — matcher shu orqali moslikni tekshiradi.
  String get versionKey => '$modelName-$modelVersion-$preprocessingVersion';
}

/// L2-normalizatsiya qilingan yuz embedding vektori (spec §7).
///
/// Model chiqishi raw vector bo'ladi — saqlash va taqqoslashdan oldin
/// L2 normalizatsiya qilinadi (MobileFaceNet/FaceNet/ArcFace uchun
/// standart qadam).
class FaceEmbedding {
  final List<double> vector;
  final EmbeddingModelInfo model;

  const FaceEmbedding({required this.vector, required this.model});

  bool get isEmpty => vector.isEmpty;

  /// Vektor o'lchami model talabiga mosmi.
  bool get isDimensionValid => vector.length == model.embeddingDimension;

  /// Raw vektorni L2-normalizatsiya qiladi (spec §7).
  ///
  /// Nol vektor yoki bo'sh ro'yxat → bo'sh embedding (null ga teng).
  static FaceEmbedding l2Normalized(
    List<double> raw,
    EmbeddingModelInfo model,
  ) {
    if (raw.isEmpty) {
      return FaceEmbedding(vector: const [], model: model);
    }
    var norm = 0.0;
    for (final v in raw) {
      norm += v * v;
    }
    norm = math.sqrt(norm);
    if (norm == 0) {
      return FaceEmbedding(vector: const [], model: model);
    }
    return FaceEmbedding(
      vector: raw.map((v) => v / norm).toList(),
      model: model,
    );
  }

  /// Kosinus o'xshashlik (0..1).
  ///
  /// TURLI model versiyasi (spec §10) yoki o'lcham mos kelmasa → 0:
  /// eski va yangi model embeddinglari hech qachon aralashtirilmaydi.
  double cosineSimilarity(FaceEmbedding other) {
    if (model.versionKey != other.model.versionKey) return 0;
    if (vector.isEmpty ||
        other.vector.isEmpty ||
        vector.length != other.vector.length) {
      return 0;
    }
    var dot = 0.0;
    var normA = 0.0;
    var normB = 0.0;
    for (var i = 0; i < vector.length; i++) {
      dot += vector[i] * other.vector[i];
      normA += vector[i] * vector[i];
      normB += other.vector[i] * other.vector[i];
    }
    if (normA == 0 || normB == 0) return 0;
    return dot / (math.sqrt(normA) * math.sqrt(normB));
  }

  @override
  String toString() =>
      'FaceEmbedding(dim=${vector.length}, model=${model.versionKey})';
}
