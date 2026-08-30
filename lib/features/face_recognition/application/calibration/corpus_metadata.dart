import 'dart:convert';
import 'dart:io';

/// Kalibrlash korpusi metadata — model versiyasi va manba ma'lumotlari
/// (spec §12).
///
/// Metadata `<korpus>/metadata/corpus_metadata.json` da saqlanadi. Model
/// o'zgarsa eski benchmark natijalarini yangi modelga tegishli deb ko'rsatib
/// bo'lmaydi — shuning uchun barcha hisobotlar shu metadata'dagi
/// [modelName]/[modelVersion]/[embeddingDimension]/[preprocessingVersion]
/// bilan etiketlanadi.
///
/// PII qoidalari (spec §5): bu faylda student nomi/telefon/manzil kabi
/// shaxsiy ma'lumotlar SAQLANMAYDI. Faqat texnik metadata.
class CorpusMetadata {
  final String modelName;
  final String modelVersion;
  final int embeddingDimension;
  final String preprocessingVersion;
  final String corpusVersion;

  /// Rozilik holati: 'consented' — datasetdagi barcha shaxslardan
  /// kalibrlash/test uchun foydalanishga rozilik olingan (spec §3).
  /// Boshqa qiymat → `validate-corpus` korpusni rad etadi.
  final String consentStatus;

  /// Ma'lumot manbai: 'hikvision' / 'manual_capture' / 'not_specified'.
  final String source;

  /// Korpus real kamera (masalan Hikvision) sharoitida yig'ilganmi (spec §7).
  final bool cameraSpecific;

  /// Qo'shimcha izohlar (PII'siz).
  final String notes;

  const CorpusMetadata({
    required this.modelName,
    required this.modelVersion,
    required this.embeddingDimension,
    required this.preprocessingVersion,
    required this.corpusVersion,
    required this.consentStatus,
    required this.source,
    required this.cameraSpecific,
    required this.notes,
  });

  /// Rozilik tasdiqlanganmi (spec §3 gate).
  bool get hasConsent => consentStatus.toLowerCase() == 'consented';

  Map<String, dynamic> toJson() => {
        'modelName': modelName,
        'modelVersion': modelVersion,
        'embeddingDimension': embeddingDimension,
        'preprocessingVersion': preprocessingVersion,
        'corpusVersion': corpusVersion,
        'consentStatus': consentStatus,
        'source': source,
        'cameraSpecific': cameraSpecific,
        'notes': notes,
      };

  factory CorpusMetadata.fromJson(Map<String, dynamic> json) =>
      CorpusMetadata(
        modelName: json['modelName'] as String? ?? 'unknown',
        modelVersion: json['modelVersion'] as String? ?? 'unknown',
        embeddingDimension: json['embeddingDimension'] as int? ?? 0,
        preprocessingVersion:
            json['preprocessingVersion'] as String? ?? 'unknown',
        corpusVersion: json['corpusVersion'] as String? ?? '1.0.0',
        consentStatus: json['consentStatus'] as String? ?? 'not_specified',
        source: json['source'] as String? ?? 'not_specified',
        cameraSpecific: json['cameraSpecific'] as bool? ?? false,
        notes: json['notes'] as String? ?? '',
      );

  /// Yangi korpus uchun boshlang'ich template.
  ///
  /// Rozilik ataylab 'not_specified' — operator `validate-corpus` ishga
  /// tushirishdan oldin uni 'consented' qilib tasdiqlashi shart (spec §3).
  /// Model ataylab MobileFaceNet/128/V1 — hozirgi rejalashtirilgan model
  /// (spec bo'yicha). Real ekstraktor farq qilsa o'zgartiriladi.
  factory CorpusMetadata.template() => const CorpusMetadata(
        modelName: 'mobilefacenet',
        modelVersion: 'FACE_MODEL_V1',
        embeddingDimension: 128,
        preprocessingVersion: 'PREP_V1',
        corpusVersion: '1.0.0',
        consentStatus: 'not_specified',
        source: 'not_specified',
        cameraSpecific: false,
        notes: 'Kalibrlash korpusi. PII saqlanmaydi (spec §5). Model '
            'maydonlari (name/version/dimension) real ekstraktor bilan '
            'mosligini operator tasdiqlashi shart (spec §12).',
      );
}

/// Metadata fayl IO.
class CorpusMetadataIO {
  CorpusMetadataIO._();

  /// `<root>/metadata/corpus_metadata.json` nisbiy yo'li.
  static String metadataFilePath(String rootPath) =>
      '$rootPath/metadata/corpus_metadata.json';

  /// Yuklaydi — fayl yo'q yoki buzilgan bo'lsa null (jimgina emas, sabab
  /// [loadResult] orqali ko'rsatiladi).
  static MetadataLoadResult load(String rootPath) {
    final file = File(metadataFilePath(rootPath));
    if (!file.existsSync()) {
      return MetadataLoadResult(
        metadata: null,
        error: 'Metadata fayli topilmadi: ${file.path}',
      );
    }
    try {
      final json = jsonDecode(file.readAsStringSync());
      if (json is! Map<String, dynamic>) {
        return const MetadataLoadResult(
          metadata: null,
          error: 'Metadata JSON ob\'yekt bo\'lishi shart',
        );
      }
      return MetadataLoadResult(
        metadata: CorpusMetadata.fromJson(json),
        error: null,
      );
    } catch (e) {
      return MetadataLoadResult(
        metadata: null,
        error: 'Metadata o\'qib bo\'lmadi: $e',
      );
    }
  }

  /// Saqlaydi (katalogni avtomatik yaratadi).
  static void save(String rootPath, CorpusMetadata metadata) {
    final file = File(metadataFilePath(rootPath))
      ..parent.createSync(recursive: true);
    file.writeAsStringSync(
      const JsonEncoder.withIndent('  ').convert(metadata.toJson()),
    );
  }
}

/// Metadata yuklash natijasi — xato sababi halol ko'rsatiladi.
class MetadataLoadResult {
  final CorpusMetadata? metadata;
  final String? error;

  const MetadataLoadResult({required this.metadata, required this.error});

  bool get isValid => metadata != null && error == null;
}
