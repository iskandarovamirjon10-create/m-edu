import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:image/image.dart' as img;

import '../../infrastructure/calibration/calibration_corpus_loader.dart';
import 'calibration_corpus.dart';
import 'corpus_metadata.dart';

/// Validatsiya jiddiyligi.
enum ValidationSeverity { error, warning }

/// Bitta validatsiya xulosasi (sababli, halol).
class CorpusValidationIssue {
  final ValidationSeverity severity;
  final String code;

  /// O'zbekcha sabab (hisobot uchun).
  final String message;

  /// Korpus ichidagi nisbiy yo'l.
  final String path;

  const CorpusValidationIssue({
    required this.severity,
    required this.code,
    required this.message,
    required this.path,
  });

  bool get isError => severity == ValidationSeverity.error;
}

/// Korpus validatsiyasi natijasi — to'liq, yashirmasdan.
class CorpusValidationResult {
  /// Struktura to'g'ri bo'lsa yuklangan korpus (aks holda null).
  final CalibrationCorpus? corpus;

  final List<CorpusValidationIssue> issues;

  /// Barcha topilgan rasm fayllari soni.
  final int imageCount;

  /// Validatsiyadan o'tgan (yaroqli, dublikat bo'lmagan) rasmlar.
  final int acceptedImages;

  /// Rad etilgan rasmlar.
  final int rejectedImages;

  /// Rad etish sabablari: code → soni.
  final Map<String, int> rejectionReasons;

  /// Pozitiv juftliklar (same-person) — harness shuncha genuine ball beradi.
  final int positivePairCount;

  /// Negativ juftliklar (different-person) — harness shuncha impostor ball
  /// beradi: har bir subyekt template'i har bir impostor rasmga solishtiriladi.
  final int negativePairCount;

  /// Subyektlar soni.
  final int subjectCount;

  bool get hasErrors => issues.any((i) => i.isError);

  const CorpusValidationResult({
    required this.corpus,
    required this.issues,
    required this.imageCount,
    required this.acceptedImages,
    required this.rejectedImages,
    required this.rejectionReasons,
    required this.positivePairCount,
    required this.negativePairCount,
    required this.subjectCount,
  });
}

/// Korpus validatori (spec §5, §8, §9).
///
/// Statik tekshiruvlar (sof Dart — `dart run` CLI'da ishlaydi):
///   • tuzilma (mavjud [CalibrationCorpusLoader] orqali)
///   • rasm yaroqliligi (o'qiladi + dekodlanadi — `package:image`)
///   • minimal o'lcham (resolution, spec §8)
///   • dublikatlar (SHA-256 kontent xeshi)
///   • subyekt ID siyosati (pseudonymous `subject_XXX`, spec §5)
///   • rozilik (metadata consentStatus == 'consented', spec §3)
///   • balans (pozitiv vs negativ juftliklar, spec §9)
///
/// Yuzga bog'liq tekshiruvlar (exactly-one-face, blur, brightness, pose,
/// face size) bu CLI'da bajarilmaydi — ular real FaceVisionEngine orqali
/// live kalibrlash paytida per-image natija sifatida chiqadi (harness
/// `failures` hisoboti). Bu cheklov halol yoziladi.
class CorpusValidator {
  CorpusValidator._();

  /// Pseudonymous ID siyosati: `subject_001` uslubida (spec §5).
  static final RegExp subjectIdPattern = RegExp(r'^subject_\d{3,}$');

  /// Minimal rasm tomoni (piksel) — juda kichik yuz crop'lari foydasiz.
  static const int minImageSidePx = 64;

  /// Balans me'yori: pozitiv/negativ nisbat shu chegaralar ichida bo'lishi
  /// maqsadga muvofiq (spec §9 — imbalance threshold'ni buzishi mumkin).
  static const double minBalanceRatio = 0.5;
  static const double maxBalanceRatio = 2.0;

  /// Korpusni tekshiradi. `strict` — ogohlantirishlar ham xato sanaladi.
  static CorpusValidationResult validate(
    String rootPath, {
    bool strict = false,
  }) {
    final issues = <CorpusValidationIssue>[];
    final rejectionReasons = <String, int>{};

    // 1) Tuzilma — mavjud loader orqali (qayta yozilmaydi).
    final load = CalibrationCorpusLoader.load(rootPath);
    final corpus = load.corpus;
    for (final e in load.errors) {
      issues.add(CorpusValidationIssue(
        severity: ValidationSeverity.error,
        code: 'STRUCTURE',
        message: e,
        path: rootPath,
      ));
    }

    var accepted = 0;
    var imageCount = 0;

    if (corpus != null) {
      // 2) Har bir rasm: o'qiladimi? dekodlanadimi? o'lcham? dublikat?
      final seenHashes = <String, String>{};
      for (final imgFile in _allImages(corpus)) {
        imageCount++;
        final code = _checkImage(imgFile, seenHashes);
        if (code != null) {
          rejectionReasons[code] = (rejectionReasons[code] ?? 0) + 1;
          issues.add(CorpusValidationIssue(
            severity: ValidationSeverity.error,
            code: code,
            message: _reasonFor(code),
            path: _rel(rootPath, imgFile.path),
          ));
        } else {
          accepted++;
        }
      }

      // 3) ID siyosati (spec §5): faqat pseudonymous ID. Eski korpuslar
      //    ishlashda davom etsin — shuning uchun ogohlantirish (strict
      //    rejimda xato).
      for (final s in corpus.subjects) {
        if (!subjectIdPattern.hasMatch(s.id)) {
          issues.add(CorpusValidationIssue(
            severity: strict
                ? ValidationSeverity.error
                : ValidationSeverity.warning,
            code: 'SUBJECT_ID_POLICY',
            message: '"${s.id}" pseudonymous emas (spec §5: subject_001 '
                'uslubi). Ism/telefon kabi PII katalog nomida bo\'lmasligi '
                'shart.',
            path: 'subjects/${s.id}',
          ));
        }
      }
    }

    // 4) Balans (spec §9): harness ishlab chiqaradigan juftliklar soni.
    final positivePairs = corpus == null
        ? 0
        : corpus.subjects.fold<int>(
            0, (sum, s) => sum + s.genuineImages.length);
    final negativePairs =
        corpus == null ? 0 : corpus.subjects.length * corpus.impostorImages.length;
    if (positivePairs > 0 && negativePairs > 0) {
      final ratio = positivePairs / negativePairs;
      if (ratio < minBalanceRatio || ratio > maxBalanceRatio) {
        issues.add(CorpusValidationIssue(
          severity: ValidationSeverity.warning,
          code: 'BALANCE_IMBALANCE',            message: 'Pozitiv/negativ nisbat ${ratio.toStringAsFixed(2)} — '
                'me\'yor [$minBalanceRatio, $maxBalanceRatio] dan '
                'tashqarida. Imbalance threshold\'ni buzishi mumkin (spec §9).',
          path: 'corpus',
        ));
      }
    }

    // 5) Rozilik gate (spec §3).
    final meta = CorpusMetadataIO.load(rootPath);
    if (meta.error != null) {
      issues.add(CorpusValidationIssue(
        severity: ValidationSeverity.warning,
        code: 'MISSING_METADATA',
        message: '${meta.error} — `scaffold` komandasi yoki qo\'lda yarating '
            '(spec §12).',
        path: 'metadata/corpus_metadata.json',
      ));
    } else if (!meta.metadata!.hasConsent) {
      issues.add(CorpusValidationIssue(
        severity: ValidationSeverity.error,
        code: 'CONSENT_REQUIRED',
        message: 'Rozilik tasdiqlanmagan (consentStatus != "consented"). '
            'Dataset faqat tegishli roziligi bo\'lgan shaxslardan tashkil '
            'qilinishi shart (spec §3).',
        path: 'metadata/corpus_metadata.json',
      ));
    }

    return CorpusValidationResult(
      corpus: corpus,
      issues: issues,
      imageCount: imageCount,
      acceptedImages: accepted,
      rejectedImages: imageCount - accepted,
      rejectionReasons: rejectionReasons,
      positivePairCount: positivePairs,
      negativePairCount: negativePairs,
      subjectCount: corpus?.subjects.length ?? 0,
    );
  }

  /// Bitta rasmni tekshiradi — dublikat yoki yaroqsizlik kodi qaytaradi.
  static String? _checkImage(File file, Map<String, String> seenHashes) {
    final List<int> bytes;
    try {
      bytes = file.readAsBytesSync();
    } catch (_) {
      return 'UNREADABLE_IMAGE';
    }
    if (bytes.isEmpty) return 'EMPTY_IMAGE';

    // Dekod: yaroqli/readable rasmmi (spec §8). Ba'zi deko derlar
    // (masalan PSD) buzilgan input'da exception tashlaydi — ham null,
    // ham exception INVALID_IMAGE sifatida rad etiladi.
    final img.Image? decoded;
    try {
      decoded = img.decodeImage(Uint8List.fromList(bytes));
    } catch (_) {
      return 'INVALID_IMAGE';
    }
    if (decoded == null) return 'INVALID_IMAGE';
    if (decoded.width < minImageSidePx || decoded.height < minImageSidePx) {
      return 'IMAGE_TOO_SMALL';
    }

    // Dublikat: SHA-256 kontent xeshi (spec §20).
    final hash = sha256.convert(bytes).toString();
    final first = seenHashes[hash];
    if (first != null) return 'DUPLICATE_IMAGE';
    seenHashes[hash] = file.path;
    return null;
  }

  static String _reasonFor(String code) => switch (code) {
        'UNREADABLE_IMAGE' => 'Fayl o\'qib bo\'lmadi (readable emas)',
        'EMPTY_IMAGE' => 'Bo\'sh fayl',
        'INVALID_IMAGE' => 'Yaroqli rasm emas (dekod bo\'lmadi)',
        'IMAGE_TOO_SMALL' =>
          'O\'lcham juda kichik ($minImageSidePx px minimal)',
        'DUPLICATE_IMAGE' => 'Dublikat rasm (bir xil kontent — '
            'trivial juftliklar taqiqlanadi, spec §10)',
        _ => code,
      };

  /// Korpusdagi barcha rasm fayllari (enroll + genuine + impostorlar).
  static List<File> _allImages(CalibrationCorpus corpus) => [
        for (final s in corpus.subjects) ...[
          ...s.enrollImages,
          ...s.genuineImages,
        ],
        ...corpus.impostorImages,
      ];

  /// Nisbiy yo'l — hisobot ixcham bo'ladi.
  static String _rel(String rootPath, String path) {
    final rel = path.replaceFirst(rootPath, '');
    return rel.startsWith(Platform.pathSeparator)
        ? rel.substring(1)
        : rel;
  }
}
