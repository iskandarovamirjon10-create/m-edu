// Face ID threshold kalibrlash CLI (spec §29, §21).
//
// Sof Dart — Flutter'ga bog'liq emas, `dart run` bilan ishlaydi:
//
//   dart run tool/calibrate_face_thresholds.dart plan
//     — korpus tuzilmasi va talablarni ko'rsatadi.
//
//   dart run tool/calibrate_face_thresholds.dart scaffold [--dir <path>]
//     — yangi korpus skeletini yaratadi (README + metadata template;
//       rasmlar kiritilmaydi — ularni operator yig'adi).
//
//   dart run tool/calibrate_face_thresholds.dart validate-corpus
//       [--dir <path>] [--strict]
//     — korpusni tekshiradi: tuzilma, rasm yaroqliligi, dublikatlar,
//       pseudonymous ID, rozilik, balans (spec §5/§8/§9).
//
//   dart run tool/calibrate_face_thresholds.dart generate-pairs
//       [--dir <path>] [--seed <n>] [--holdout <0..1>]
//     — kalibrlash/holdout bo'limlariga ajratadi (leakage yo'q, spec §11),
//       juftlik manifestlarini va balans hisobotini yozadi.
//
//   dart run tool/calibrate_face_thresholds.dart scores --file <scores.json>
//     — genuine/impostor ballar faylini tahlil qiladi (EER, tavsiya).
//       Fayl formati: {"modelKey":"...","genuine":[...],"impostor":[...]}
//
//   dart run tool/calibrate_face_thresholds.dart evaluate
//       --scores <holdout_scores.json> --threshold <t>
//     — kalibrlangan threshold'ni HOLDOUT ballariga qo'llaydi (TAR/FAR/FRR).
//
//   dart run tool/calibrate_face_thresholds.dart report
//       [--dir <build/calibration>] [--corpus <test_data/calibration>]
//     — scores_*.json'lar asosida threshold_report_<model>.json chiqaradi.
//
// Ballar qayerdan olinadi?
//   - Live ekstraksiya: `flutter test test/integration/face_calibration_live_test.dart`
//     (real FaceVisionEngine orqali; korpus bo'lmasa NOT BENCHMARKED skip).
//     `M_EDU_CALIBRATION_DIR=...` korpusni, `M_EDU_SCORES_SUFFIX=holdout`
//     holdout natija faylini belgilaydi.
//
// Hech qachon fake ball / taxminiy threshold yaratmaydi — faqat haqiqiy
// ballar bilan ishlaydi, korpus yetarli bo'lmasa tavsiya bermaydi.

import 'dart:convert';
import 'dart:io';

import 'package:m_edu/features/face_recognition/application/calibration/calibration_corpus.dart';
import 'package:m_edu/features/face_recognition/application/calibration/calibration_report.dart';
import 'package:m_edu/features/face_recognition/application/calibration/corpus_metadata.dart';
import 'package:m_edu/features/face_recognition/application/calibration/corpus_splitter.dart';
import 'package:m_edu/features/face_recognition/application/calibration/corpus_validator.dart';
import 'package:m_edu/features/face_recognition/application/calibration/face_calibration_harness.dart';
import 'package:m_edu/features/face_recognition/application/calibration/face_threshold_analyzer.dart';
import 'package:m_edu/features/face_recognition/application/calibration/holdout_evaluator.dart';

const _defaultCorpusDir = 'test_data/calibration';
const _defaultOutDir = 'build/calibration';

Future<void> main(List<String> args) async {
  if (args.isEmpty) {
    _usage();
    exitCode = 64;
    return;
  }

  switch (args.first) {
    case 'plan':
      _printPlan();
    case 'scaffold':
      _scaffold(args);
    case 'validate-corpus':
      await _validateCorpus(args);
    case 'generate-pairs':
      _generatePairs(args);
    case 'scores':
      await _analyzeScoresFile(args);
    case 'evaluate':
      _evaluate(args);
    case 'report':
      _report(args);
    default:
      _usage();
      exitCode = 64;
  }
}

void _usage() {
  stdout.writeln('''
Face threshold kalibrlash CLI (spec §29, §21)

Ishlatish:
  dart run tool/calibrate_face_thresholds.dart plan
  dart run tool/calibrate_face_thresholds.dart scaffold [--dir <path>]
  dart run tool/calibrate_face_thresholds.dart validate-corpus [--dir <path>] [--strict]
  dart run tool/calibrate_face_thresholds.dart generate-pairs [--dir <path>] [--seed <n>] [--holdout <0..1>]
  dart run tool/calibrate_face_thresholds.dart scores --file <scores.json>
  dart run tool/calibrate_face_thresholds.dart evaluate --scores <holdout_scores.json> --threshold <t>
  dart run tool/calibrate_face_thresholds.dart report [--dir <build/calibration>] [--corpus <test_data/calibration>]

Live ekstraksiya (real dvigatel):
  M_EDU_CALIBRATION_DIR=test_data/calibration flutter test test/integration/face_calibration_live_test.dart
  M_EDU_CALIBRATION_DIR=.../splits/holdout M_EDU_SCORES_SUFFIX=holdout flutter test test/integration/face_calibration_live_test.dart
''');
}

void _printPlan() {
  stdout.writeln('''
══════════════════════════════════════════════════════
 CALIBRATION CORPUS PLAN (spec §29)
══════════════════════════════════════════════════════

Korpus katalogi:  test_data/calibration/
                 (gitignore'da — real biometrik ma'lumot git'ga tushmaydi)

Tuzilma:
  test_data/calibration/
  ├── subjects/
  │   ├── subject_001/
  │   │   ├── enroll/    2+ rasm   (ro'yxatga olish namunalari)
  │   │   └── genuine/   2+ rasm   (bir xil shaxs, turli holatlar)
  │   ├── subject_002/
  │   └── ...
  ├── impostors/
  │   ├── <boshqa_shaxs>.jpg
  │   └── ...
  └── metadata/
      └── corpus_metadata.json   (model versiyasi + rozilik, spec §12)

Talablar (eng kam):
  • 2+ subyekt (har biri enroll >= 1, genuine >= 1)
  • 2+ impostor rasm (boshqa shaxslar)
  • rasm kengaytmalari: .jpg / .jpeg / .png
  • EER uchun jami 20+ genuine va 20+ impostor ball kerak
  • Rozilik tasdiqlangan bo'lishi shart (consentStatus=consented, spec §3)
  • Subyekt ID'lari pseudonymous (subject_001, spec §5) — PII yo'q

Oqim:
  scaffold → (real rasmlar yig'iladi) → validate-corpus
    → generate-pairs (kalibrlash/holdout split, §11)
    → live ekstraksiya (kalibrlash + holdout)
    → report (threshold_report_<model>.json)

Shart: HECh qanday fake ball yo'q; korpus bo'lmasa natija
       NOT BENCHMARKED bo'ladi (tavsiya chiqmaydi).
══════════════════════════════════════════════════════
''');
}

// ── scaffold ────────────────────────────────────────────────────────────────

void _scaffold(List<String> args) {
  final dir = _arg(args, '--dir') ?? _defaultCorpusDir;
  Directory(dir).createSync(recursive: true);

  Directory('$dir/subjects').createSync(recursive: true);
  Directory('$dir/impostors').createSync(recursive: true);

  // Rozilik + PII siyosati hujjati.
  _writeIfAbsent('$dir/README.md', _rootReadme);
  _writeIfAbsent('$dir/subjects/README.md', _subjectsReadme);
  _writeIfAbsent('$dir/impostors/README.md', _impostorsReadme);

  // Metadata template — mavjud bo'lsa ustiga yozilmaydi (operator xatosi).
  final metaFile = File(CorpusMetadataIO.metadataFilePath(dir));
  if (!metaFile.existsSync()) {
    CorpusMetadataIO.save(dir, CorpusMetadata.template());
    stdout.writeln('Yaratildi: ${metaFile.path} (consentStatus hali '
        'not_specified — validate-corpus buni talab qiladi, §3)');
  } else {
    stdout.writeln('Metadata allaqachon mavjud: ${metaFile.path} '
        '(ustiga yozilmadi)');
  }

  stdout.writeln('Korpus skeleti yaratildi: $dir');
  stdout.writeln('Keyingi qadam: subjects/subject_001/{enroll,genuine}/ va '
      'impostors/ ichiga REAL, ROZILIGI BO\'LGAN rasmlar joylang, so\'ng '
      'validate-corpus ishga tushiring.');
}

const _rootReadme = '''
# Kalibrlash korpusi (test_data/calibration)

DIQQAT — REAL BIOMETRIK MA'LUMOTLAR!

## Privacy (spec §2)
- Bu katalog git'ga TUSHMAYDI (.gitignore: test_data/).
- Rasmlar GitHub/GitLab'ga push qilinmaydi, Flutter assets'ga kirmaydi,
  production database/loglarga chiqmaydi.
- Subyekt ID'lari faqat pseudonymous: subject_001, subject_002, ...
  Ism/telefon/manzil kabi PII saqlanmaydi (spec §5).

## Rozilik (spec §3)
- Dataset faqat tegishli rozilik bergan, kalibrlash/test uchun ruxsat
  berilgan shaxslarning suratlaridan iborat bo'lishi shart.
- metadata/corpus_metadata.json da consentStatus = "consented" qilib
  tasdiqlang — aks holda validate-corpus korpusni rad etadi.

## Tuzilma
  subjects/subject_XXX/
    enroll/    — ro'yxatga olish namunalari (2+ rasm)
    genuine/   — bir xil shaxs, turli holatlar (2+ rasm)
  impostors/   — boshqa shaxslar (2+ rasm)
  metadata/    — corpus_metadata.json (model versiyasi)

## Sifat (spec §6)
Frontal + engil o'ng/cha p, normal/past yorug'lik, turli masofa, tabiiy
ko'zoynak/ifoda o'zgarishlari. Korpus real M-EDU kamera sharoitini
aks ettirishi kerak — sun'iy manipulyatsiya qilinmaydi.
''';

const _subjectsReadme = '''
# subjects/

Har bir shaxs uchun bitta katalog: subject_001, subject_002, ...

  subject_001/
    enroll/    — 2+ rasm (ro'yxatga olish namunalari)
    genuine/   — 2+ rasm (bir xil shaxs, turli holatlar)

QOIDALAR:
- ID pseudonymous bo'lishi shart (spec §5): ism, telefon, M-EDU ID
  katalog nomiga YOZILMAYDI.
- Rasm kengaytmalari: .jpg / .jpeg / .png.
- enroll va genuine rasmlar har xil bo'lishi shart (trivial juftliklar
  benchmarkdan chiqariladi, spec §10).
- Dublikat rasmlar validate-corpus tomonidan rad etiladi (SHA-256).
- Roziligisiz odamlar suratlari qo'shilishi TAQIQLANADI (spec §3).
''';

const _impostorsReadme = '''
# impostors/

Boshqa (korpus subyektlariga kirmaydigan) shaxslarning suratlari —
kalibrlashda negativ juftliklar uchun.

- Kamida 2 rasm kerak (impostor ballar soni subyektlar × impostorlar).
- Suratlar ham rozilik bilan olingan bo'lishi shart (spec §3).
- Surat nomlari PII saqlamasligi shart (spec §5).
''';

// ── validate-corpus ─────────────────────────────────────────────────────────

Future<void> _validateCorpus(List<String> args) async {
  final dir = _arg(args, '--dir') ?? _defaultCorpusDir;
  final strict = args.contains('--strict');

  stdout.writeln('Korpus tekshirilmoqda: $dir\n');
  final result = CorpusValidator.validate(dir, strict: strict);

  stdout.writeln(
      'Rasmlar: ${result.imageCount}  |  Qabul: ${result.acceptedImages}  |  '
      'Rad: ${result.rejectedImages}');
  if (result.rejectionReasons.isNotEmpty) {
    stdout.writeln('Rad sabablari:');
    result.rejectionReasons.forEach((code, n) {
      stdout.writeln('  $code: $n');
    });
  }
  stdout.writeln('Subyektlar: ${result.subjectCount}');
  stdout.writeln('Pozitiv juftliklar: ${result.positivePairCount}  '
      '(bir xil shaxs)');
  stdout.writeln('Negativ juftliklar: ${result.negativePairCount}  '
      '(har xil shaxs)');
  stdout.writeln();

  if (result.issues.isEmpty) {
    stdout.writeln('✓ KORPUS VALID (${strict ? 'strict' : 'standart'} rejim)');
    exitCode = 0;
    return;
  }

  for (final issue in result.issues) {
    final mark = issue.isError ? '✗' : '⚠';
    stdout.writeln('$mark [${issue.code}] ${issue.message} (${issue.path})');
  }
  stdout.writeln();
  if (result.hasErrors) {
    stdout.writeln('✗ KORPUS RAD ETILDI: ${result.issues.where((i) => i.isError).length} ta xato.');
    exitCode = 1;
  } else {
    stdout.writeln('⚠ Xatolar yo\'q, ogohlantirishlar bor — korpus '
        'ishlatilishi mumkin (strict rejimda rad etiladi).');
    exitCode = 0;
  }
}

// ── generate-pairs ──────────────────────────────────────────────────────────

void _generatePairs(List<String> args) {
  final dir = _arg(args, '--dir') ?? _defaultCorpusDir;
  final seed = int.tryParse(_arg(args, '--seed') ?? '') ??
      CorpusSplitter.defaultSeed;
  final holdoutFrac = double.tryParse(_arg(args, '--holdout') ?? '') ??
      CorpusSplitter.defaultHoldoutFraction;
  final outDir = _arg(args, '--out') ?? _defaultOutDir;

  final result = CorpusValidator.validate(dir);
  // Rozilik/struktura xatolari — juftlik generatsiyasi bloklanadi (spec §3).
  if (result.hasErrors) {
    stderr.writeln('✗ Korpus valid emas — juftliklar yaratilmadi:');
    for (final i in result.issues.where((i) => i.isError)) {
      stderr.writeln('  ✗ [${i.code}] ${i.message}');
    }
    exitCode = 1;
    return;
  }
  final corpus = result.corpus!;

  // Leakage prevention (spec §11): deterministik split.
  final split = CorpusSplitter.split(
    corpus,
    seed: seed,
    holdoutFraction: holdoutFrac,
  );

  final splitsRoot = '$dir/splits';
  CorpusSplitter.writeToDisk(split, splitsRoot);
  stdout.writeln('Bo\'limlar yozildi: $splitsRoot/{calibration,holdout}');
  stdout.writeln('Split izohlari:');
  for (final n in split.notes) {
    stdout.writeln('  • $n');
  }

  // Juftlik manifestlari + balans (build/ — gitignore'da, PII yo'q).
  Directory(outDir).createSync(recursive: true);
  final calPairs = _writePairsManifest(
      split.calibration, '$outDir/pairs_calibration.json', 'calibration', corpus);
  final holdPairs = _writePairsManifest(
      split.holdout, '$outDir/pairs_holdout.json', 'holdout', corpus);

  final meta = CorpusMetadataIO.load(dir);
  final splitMeta = {
    'generatedAt': DateTime.now().toIso8601String(),
    'seed': seed,
    'holdoutFraction': holdoutFrac,
    'corpusDir': dir,
    'model': meta.metadata?.toJson(),
    'notes': split.notes,
    'calibration': {
      'subjects': split.calibration.subjects.length,
      'images': _imageCount(split.calibration),
      'positivePairs': calPairs.positivePairs,
      'negativePairs': calPairs.negativePairs,
    },
    'holdout': {
      'subjects': split.holdout.subjects.length,
      'images': _imageCount(split.holdout),
      'positivePairs': holdPairs.positivePairs,
      'negativePairs': holdPairs.negativePairs,
    },
  };
  File('$outDir/split_meta.json')
      .writeAsStringSync(const JsonEncoder.withIndent('  ').convert(splitMeta));

  stdout.writeln('Balans (kalibrlash): pozitiv=${calPairs.positivePairs}, '
      'negativ=${calPairs.negativePairs}, '
      'nisbat=${calPairs.balanceRatio.toStringAsFixed(2)}');
  stdout.writeln('Balans (holdout): pozitiv=${holdPairs.positivePairs}, '
      'negativ=${holdPairs.negativePairs}, '
      'nisbat=${holdPairs.balanceRatio.toStringAsFixed(2)}');
  stdout.writeln('Manifestlar: $outDir/pairs_{calibration,holdout}.json, '
      'split_meta.json');

  if (calPairs.positivePairs == 0 || calPairs.negativePairs == 0) {
    stderr.writeln('⚠ Bo\'limlardan birida juftliklar 0 — bo\'lim kichik '
        'bo\'lishi mumkin, generate-pairs natijasi ishonchsiz.');
    exitCode = 0;
  }
}

class _PairsManifest {
  final int positivePairs;
  final int negativePairs;
  final double balanceRatio;

  const _PairsManifest(this.positivePairs, this.negativePairs, this.balanceRatio);
}

_PairsManifest _writePairsManifest(
  CalibrationCorpus corpus,
  String outPath,
  String splitName,
  CalibrationCorpus original,
) {
  // Pozitiv juftliklar: har subyekt enroll ↔ genuine (template asosida).
  final positive = [
    for (final s in corpus.subjects)
      {
        'subjectId': s.id,
        'enroll': [for (final f in s.enrollImages) _rel(f.path, original.root.path)],
        'genuine': [for (final f in s.genuineImages) _rel(f.path, original.root.path)],
      },
  ];
  // Negativ juftliklar: har subyekt template ↔ har impostor.
  final negative = [
    for (final s in corpus.subjects)
      {
        'subjectId': s.id,
        'impostors': [
          for (final f in corpus.impostorImages) _rel(f.path, original.root.path),
        ],
      },
  ];

  final positiveCount = positive.fold<int>(
      0, (sum, p) => sum + (p['genuine'] as List).length);
  final negativeCount = negative.fold<int>(
      0, (sum, p) => sum + (p['impostors'] as List).length);
  final balance = positiveCount == 0 || negativeCount == 0
      ? 0.0
      : positiveCount / negativeCount;

  File(outPath).writeAsStringSync(const JsonEncoder.withIndent('  ').convert({
    'split': splitName,
    'trivialPairsExcluded': true, // enroll ≠ genuine ≠ impostors, dublikatlar rad etilgan
    'positivePairs': positiveCount,
    'negativePairs': negativeCount,
    'balanceRatio': balance,
    'positive': positive,
    'negative': negative,
  }));
  return _PairsManifest(positiveCount, negativeCount, balance);
}

int _imageCount(CalibrationCorpus c) => [
      for (final s in c.subjects) ...s.enrollImages,
      for (final s in c.subjects) ...s.genuineImages,
      ...c.impostorImages,
    ].length;

String _rel(String path, String rootPath) =>
    path.replaceFirst(rootPath, '').replaceFirst(Platform.pathSeparator, '');

// ── scores ──────────────────────────────────────────────────────────────────

Future<void> _analyzeScoresFile(List<String> args) async {
  final fileIndex = args.indexOf('--file');
  if (fileIndex < 0 || fileIndex + 1 >= args.length) {
    stderr.writeln('Xato: --file <scores.json> kerak');
    exitCode = 64;
    return;
  }
  final path = args[fileIndex + 1];
  final file = File(path);
  if (!file.existsSync()) {
    stderr.writeln('Xato: fayl topilmadi: $path');
    exitCode = 66;
    return;
  }

  final Map<String, dynamic> json;
  try {
    json = jsonDecode(await file.readAsString()) as Map<String, dynamic>;
  } catch (e) {
    stderr.writeln('Xato: JSON o\'qib bo\'lmadi: $e');
    exitCode = 65;
    return;
  }

  final genuine = _asDoubleList(json['genuine']);
  final impostor = _asDoubleList(json['impostor']);
  if (genuine == null || impostor == null) {
    stderr.writeln('Xato: "genuine" va "impostor" raqamlar ro\'yxati '
        'bo\'lishi shart');
    exitCode = 65;
    return;
  }

  final analyzer = const FaceThresholdAnalyzer();
  final analysis = analyzer.analyze(
    genuineScores: genuine,
    impostorScores: impostor,
  );

  final run = CalibrationRunResult(
    modelKey: json['modelKey'] as String? ?? 'unknown',
    subjectResults: const [],
    genuineScores: genuine,
    impostorScores: impostor,
    failures: _asStringList(json['failures']) ?? const [],
    extractionLatencyMs: _asDoubleList(json['latencyMs']) ?? const [],
    analysis: analysis,
  );

  stdout.writeln(formatCalibrationReport(run));
}

// ── evaluate ────────────────────────────────────────────────────────────────

void _evaluate(List<String> args) {
  final scoresPath = _arg(args, '--scores');
  final threshold = double.tryParse(_arg(args, '--threshold') ?? '');
  if (scoresPath == null || threshold == null) {
    stderr.writeln('Xato: --scores <holdout_scores.json> --threshold <t> kerak');
    exitCode = 64;
    return;
  }
  final file = File(scoresPath);
  if (!file.existsSync()) {
    stderr.writeln('Xato: fayl topilmadi: $scoresPath');
    exitCode = 66;
    return;
  }
  final Map<String, dynamic> json;
  try {
    json = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
  } catch (e) {
    stderr.writeln('Xato: JSON o\'qib bo\'lmadi: $e');
    exitCode = 65;
    return;
  }
  final genuine = _asDoubleList(json['genuine']);
  final impostor = _asDoubleList(json['impostor']);
  if (genuine == null || impostor == null) {
    stderr.writeln('Xato: "genuine"/"impostor" raqamlar ro\'yxati shart');
    exitCode = 65;
    return;
  }

  final eval = HoldoutEvaluator.evaluateScores(
    genuineScores: genuine,
    impostorScores: impostor,
    threshold: threshold,
  );
  _printHoldoutEval(eval);
}

void _printHoldoutEval(HoldoutEvaluation eval) {
  stdout.writeln('''
─ HOLDOUT BAHOLASH (spec §11) ─
  Threshold:      ${_p3(eval.threshold)}
  Genuine ballar: ${eval.genuineCount}
  Impostor ballar: ${eval.impostorCount}
  TAR (True Accept):  ${_p3(eval.trueAcceptRate)}
  FAR (False Accept): ${_p3(eval.falseAcceptRate)}
  FRR (False Reject): ${_p3(eval.falseRejectRate)}
''');
  if (eval.eer != null) {
    stdout.writeln(
        '  Holdout EER: ${_p3(eval.eer!)} @ ${_p3(eval.eerThreshold!)}');
  }
  if (eval.insufficientData) {
    stdout.writeln('  ⚠ Kam ballar — natija ishonchsiz (20+ genuine, 20+ '
        'impostor kerak).');
  }
  stdout.writeln('═' * 50);
}

// ── report ──────────────────────────────────────────────────────────────────

void _report(List<String> args) {
  final dir = _arg(args, '--dir') ?? _defaultOutDir;
  final corpusDir = _arg(args, '--corpus') ?? _defaultCorpusDir;

  // Faqat `scores_*.json` (build/calibration/scores_<model>[suffix].json),
  // holdout fayllari bundan mustasno (ular asosiy bilan juftlanadi).
  final scoreFiles = Directory(dir).existsSync()
      ? Directory(dir)
          .listSync()
          .whereType<File>()
          .map((f) => f.uri.pathSegments.last)
          .where((name) =>
              name.startsWith('scores_') &&
              name.endsWith('.json') &&
              !name.endsWith('_holdout.json'))
          .map((name) => File('$dir/$name'))
          .toList()
      : const <File>[];

  if (scoreFiles.isEmpty) {
    stderr.writeln('✗ $dir ichida scores_*.json topilmadi. Avval live '
        'ekstraksiyani ishga tushiring (plan ga qarang).');
    exitCode = 1;
    return;
  }

  final meta = CorpusMetadataIO.load(corpusDir).metadata;
  final validation = CorpusValidator.validate(corpusDir);

  for (final f in scoreFiles) {
    _reportForModel(f, dir, corpusDir, meta, validation);
  }
}

void _reportForModel(
  File scoresFile,
  String outDir,
  String corpusDir,
  CorpusMetadata? meta,
  CorpusValidationResult validation,
) {
  final Map<String, dynamic> json;
  try {
    json = jsonDecode(scoresFile.readAsStringSync()) as Map<String, dynamic>;
  } catch (e) {
    stderr.writeln('✗ JSON xato ${scoresFile.path}: $e');
    return;
  }
  final genuine = _asDoubleList(json['genuine']) ?? const [];
  final impostor = _asDoubleList(json['impostor']) ?? const [];
  final modelKey = json['modelKey'] as String? ?? 'unknown';
  final failures = _asStringList(json['failures']) ?? const [];

  final analyzer = const FaceThresholdAnalyzer();
  final analysis = analyzer.analyze(
    genuineScores: genuine,
    impostorScores: impostor,
  );

  final run = CalibrationRunResult(
    modelKey: modelKey,
    subjectResults: const [],
    genuineScores: genuine,
    impostorScores: impostor,
    failures: failures,
    extractionLatencyMs: _asDoubleList(json['latencyMs']) ?? const [],
    analysis: analysis,
  );
  stdout.writeln(formatCalibrationReport(run));

  // Holdout tekshiruvi (spec §11): scores_<model>_holdout.json bo'lsa.
  final base = scoresFile.path.replaceFirst('.json', '');
  final holdoutFile = File('${base}_holdout.json');
  HoldoutEvaluation? holdoutEval;
  if (holdoutFile.existsSync()) {
    try {
      final hjson =
          jsonDecode(holdoutFile.readAsStringSync()) as Map<String, dynamic>;
      final rec = analysis.recommendation;
      if (rec != null) {
        holdoutEval = HoldoutEvaluator.evaluateScores(
          genuineScores: _asDoubleList(hjson['genuine']) ?? const [],
          impostorScores: _asDoubleList(hjson['impostor']) ?? const [],
          threshold: rec.threshold,
        );
        stdout.writeln('\nHoldout scores fayli topildi: ${holdoutFile.path}');
        _printHoldoutEval(holdoutEval);
      } else {
        stdout.writeln('\nHoldout scores bor, lekin tavsiya yo\'q — '
            'kalibrlash etarli emas, holdout tekshiruvi o\'tkazilmaydi.');
      }
    } catch (e) {
      stderr.writeln('✗ Holdout JSON xato ${holdoutFile.path}: $e');
    }
  }

  // threshold_report_<model>.json (spec §13/§14).
  final report = _buildReportJson(
    modelKey: modelKey,
    analysis: analysis,
    holdoutEval: holdoutEval,
    meta: meta,
    validation: validation,
    corpusDir: corpusDir,
  );
  final reportPath =
      '$outDir/threshold_report_${modelKey.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_')}.json';
  File(reportPath).writeAsStringSync(
      const JsonEncoder.withIndent('  ').convert(report));
  stdout.writeln('Hisobot yozildi: $reportPath');
}

Map<String, dynamic> _buildReportJson({
  required String modelKey,
  required ThresholdAnalysis analysis,
  required HoldoutEvaluation? holdoutEval,
  required CorpusMetadata? meta,
  required CorpusValidationResult validation,
  required String corpusDir,
}) {
  final rec = analysis.recommendation;
  final state = switch (analysis.state) {
    BenchmarkState.notRun => 'NOT_RUN',
    BenchmarkState.insufficientData => 'INSUFFICIENT_DATA',
    BenchmarkState.complete => 'BENCHMARKED',
  };

  // Ishonch darajasi (spec §17 security-first, spec §18 no fake).
  final String confidence;
  if (analysis.state != BenchmarkState.complete) {
    confidence = 'NONE';
  } else if (holdoutEval == null) {
    confidence = 'LOW'; // holdout tekshiruvsiz tavsiya ishonchsiz
  } else if (holdoutEval.insufficientData) {
    confidence = 'MEDIUM';
  } else {
    confidence = 'HIGH';
  }

  return {
    'generatedAt': DateTime.now().toIso8601String(),
    'modelKey': modelKey,
    'model': {
      'name': meta?.modelName ?? 'unknown',
      'version': meta?.modelVersion ?? 'unknown',
      'embeddingDimension': meta?.embeddingDimension ?? 0,
      'preprocessingVersion': meta?.preprocessingVersion ?? 'unknown',
    },
    'dataset': {
      'subjects': validation.subjectCount,
      'images': validation.acceptedImages,
      'rejectedImages': validation.rejectedImages,
      'rejectionReasons': validation.rejectionReasons,
      'positivePairs': validation.positivePairCount,
      'negativePairs': validation.negativePairCount,
      'balanceRatio': validation.positivePairCount == 0 ||
              validation.negativePairCount == 0
          ? null
          : (validation.positivePairCount / validation.negativePairCount),
    },
    'calibration': {
      'state': state,
      'genuineCount': analysis.genuineCount,
      'impostorCount': analysis.impostorCount,
      'eer': analysis.eer,
      'eerThreshold': analysis.eerThreshold,
      'targetFpr': analysis.targetFpr,
      'ambiguousMargin': analysis.ambiguousMargin,
      'candidateThreshold': rec?.threshold,
      'thresholdTpr': rec?.truePositiveRate,
      'thresholdFpr': rec?.falsePositiveRate,
      'thresholdFnr': rec?.falseNegativeRate,
      'thresholdUnknownRate': rec?.unknownRate,
    },
    'holdout': holdoutEval == null
        ? null
        : {
            'threshold': holdoutEval.threshold,
            'tar': holdoutEval.trueAcceptRate,
            'far': holdoutEval.falseAcceptRate,
            'frr': holdoutEval.falseRejectRate,
            'genuineCount': holdoutEval.genuineCount,
            'impostorCount': holdoutEval.impostorCount,
            'eer': holdoutEval.eer,
            'insufficientData': holdoutEval.insufficientData,
          },
    'camera': {
      'realHikvision': (meta?.source == 'hikvision' && meta?.cameraSpecific == true),
      'cameraSpecificCorpus': meta?.cameraSpecific ?? false,
      'source': meta?.source ?? 'not_specified',
    },
    'privacy': {
      'gitExcluded': _isGitIgnored(corpusDir),
      'piiExcluded': !validation.issues.any(
          (i) => i.code == 'SUBJECT_ID_POLICY' && i.isError),
      'rawImagesExcludedFromProduction': true,
    },
    'recommendation': rec == null
        ? null
        : {
            'threshold': rec.threshold,
            'ambiguousThreshold': rec.threshold - analysis.ambiguousMargin,
            'tpr': rec.truePositiveRate,
            'fpr': rec.falsePositiveRate,
            'fnr': rec.falseNegativeRate,
            'confidence': confidence,
            'securityNote': "Face ID attendance: FALSE POSITIVE "
                "(noto'g'ri studentga yozish) FALSE NEGATIVE dan xavfliroq — "
                "threshold kamaytirish orqali security'ni oshirish mumkin, "
                "lekin FRR o'sadi (spec §17).",
          },
    'fakeBenchmark': false,
  };
}

/// Korpus gitignore'da ekanligini static tekshiradi (privacy hisobot §2).
bool _isGitIgnored(String corpusDir) {
  final gitignore = File('.gitignore');
  if (!gitignore.existsSync()) return false;
  try {
    final content = gitignore.readAsStringSync();
    final rel = corpusDir.replaceAll(RegExp(r'^\./'), '');
    return content.split('\n').any((line) {
      final t = line.trim();
      if (t.isEmpty || t.startsWith('#')) return false;
      return t == rel || t == '$rel/' || t == 'test_data/';
    });
  } catch (_) {
    return false;
  }
}

// ── yordamchilar ────────────────────────────────────────────────────────────

String? _arg(List<String> args, String name) {
  final i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) return null;
  return args[i + 1];
}

List<double>? _asDoubleList(dynamic v) {
  if (v is! List) return null;
  final result = <double>[];
  for (final e in v) {
    if (e is num) {
      result.add(e.toDouble());
    } else {
      return null;
    }
  }
  return result;
}

List<String>? _asStringList(dynamic v) {
  if (v is! List) return null;
  final result = <String>[];
  for (final e in v) {
    if (e is String) {
      result.add(e);
    } else {
      return null;
    }
  }
  return result;
}

void _writeIfAbsent(String path, String content) {
  final f = File(path);
  if (f.existsSync()) return;
  f.parent.createSync(recursive: true);
  f.writeAsStringSync(content);
  stdout.writeln('Yaratildi: $path');
}

String _p3(double v) => v.toStringAsFixed(3);
