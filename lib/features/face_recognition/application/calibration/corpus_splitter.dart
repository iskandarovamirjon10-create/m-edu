import 'dart:io';
import 'dart:math';

import 'calibration_corpus.dart';

/// Kalibrlash/holdout bo'limlari (spec §11 — DATA LEAKAGE prevention).
///
/// Qoida: kalibrlash va final baholash BIR XIL rasmlardan foydalanmasligi
/// shart — aks holda natija haddan tashqari optimistik bo'ladi.
class CorpusSplit {
  /// Threshold kalibrlash uchun ishlatiladigan korpus.
  final CalibrationCorpus calibration;

  /// Final report tekshiruvi uchun holdout korpus (kalibrlashda qatnashmagan
  /// rasmlar). Har doim [CalibrationCorpusLoader] bilan yuklana oladigan
  /// tuzilmada (kamida 1 enroll + 1 genuine subyekt va 2 impostor) — bajarib
  /// bo'lmasa, holdout bo'sh korpus emas, balki bu holat [notes] da halol
  /// ko'rsatiladi.
  final CalibrationCorpus holdout;

  /// Split haqida halol izohlar (nima qayerga ketdi, cheklovlar).
  final List<String> notes;

  const CorpusSplit({
    required this.calibration,
    required this.holdout,
    required this.notes,
  });
}

/// Deterministik korpus splitter (spec §11).
///
/// Har bir rasm AYOQ bitta bo'limda qoladi (leakage yo'q). Split `seed`
/// asosida deterministik — bir xil korpus + seed → bir xil bo'limlar.
///
/// Granularity: image-level (har subyektning rasmlari bo'linadi). Eng kam
/// korpus (2 subyekt + 2 impostor) bilan ham ishlaydi. Subyekt-darajali
/// split (qat'iyroq) 4+ subyekt talab qiladi — variant sifatida
/// hujjatlashtirilgan.
class CorpusSplitter {
  CorpusSplitter._();

  static const double defaultHoldoutFraction = 0.3;
  static const int defaultSeed = 42;

  /// Korpusni kalibrlash/holdout bo'limlariga ajratadi.
  ///
  /// [holdoutFraction] — holdout'ga tushadigan rasm ulushi (0..1).
  ///
  /// Kafolatlar:
  /// 1. Leakage yo'q — birorta rasm ikkala bo'limda bo'lmaydi.
  /// 2. Barcha rasmlar saqlanadi (bo'limlar yig'indisi = original).
  /// 3. Ikkala bo'lim [CalibrationCorpusLoader] bilan yuklana oladi
  ///    (impostorlar < 4 bo'lsa holdout'impostorlari yetishmaydi — bu holat
  ///    [CorpusSplit.notes] da halol yoziladi).
  static CorpusSplit split(
    CalibrationCorpus corpus, {
    int seed = defaultSeed,
    double holdoutFraction = defaultHoldoutFraction,
  }) {
    final notes = <String>[];
    final calSubjects = <CalibrationSubject>[];
    final holdSubjects = <CalibrationSubject>[];

    for (final subject in corpus.subjects) {
      // String.hashCode VM versiyalari orasida barqaror emas — platforma/
      // mashina o'rtasida deterministik split uchun barqaror xesh ishlatiladi.
      final rng = Random(seed ^ _stableHash(subject.id));

      final enrollSplit = _splitList(subject.enrollImages, rng, holdoutFraction);
      final genuineSplit =
          _splitList(subject.genuineImages, rng, holdoutFraction);

      final calEnroll = [...enrollSplit.keep];
      final calGenuine = [...genuineSplit.keep];
      final holdEnroll = enrollSplit.holdout;
      final holdGenuine = genuineSplit.holdout;

      if (holdEnroll.isNotEmpty && holdGenuine.isNotEmpty) {
        // Holdout subyekti to'liq (enroll + genuine) — loader talabi.
        holdSubjects.add(CalibrationSubject(
          id: subject.id,
          enrollImages: holdEnroll,
          genuineImages: holdGenuine,
        ));
      } else if (holdEnroll.isNotEmpty || holdGenuine.isNotEmpty) {
        // Yarimta holdout subyekt bo'lmaydi (loader ikkalasini talab qiladi)
        // — shu rasmlar kalibrlashda qoladi, halol yoziladi.
        calEnroll.addAll(holdEnroll);
        calGenuine.addAll(holdGenuine);
        notes.add('${subject.id}: holdout uchun yetarli emas (enroll yoki '
            'genuine juda kam) — barcha rasmlari kalibrlashda qoldi.');
      }

      calSubjects.add(CalibrationSubject(
        id: subject.id,
        enrollImages: calEnroll,
        genuineImages: calGenuine,
      ));
    }

    // Impostorlar: ikkala bo'limda ham kamida 2 tadan (loader talabi).
    // Jami < 4 bo'lsa holdout'impostorlari to'ldirib bo'lmaydi — halol izoh.
    final impostorRng = Random(seed);
    List<File> calImpostors;
    List<File> holdImpostors;
    if (corpus.impostorImages.length >= 4) {
      final split = _splitList(corpus.impostorImages, impostorRng, holdoutFraction);
      calImpostors = split.keep;
      holdImpostors = split.holdout;
      // Loader talabi: har birida >= 2.
      if (calImpostors.length < 2 || holdImpostors.length < 2) {
        // juda ekstremal holat — qayta muvozanatlash.
        final all = [...corpus.impostorImages]..sort((a, b) => a.path.compareTo(b.path));
        calImpostors = all.take(max(2, all.length - 2)).toList();
        holdImpostors = all.skip(max(2, all.length - 2)).toList();
      }
    } else {
      calImpostors = [...corpus.impostorImages];
      holdImpostors = const [];
      notes.add('impostors: jami < 4 — holdout uchun impostorlar '
          'yetishmaydi (loader 2+ talab qiladi). Holdout tekshiruvi '
          'cheklangan.');
    }

    final calibration = CalibrationCorpus(
      root: corpus.root,
      subjects: calSubjects,
      impostorImages: calImpostors,
    );
    final holdout = CalibrationCorpus(
      root: corpus.root,
      subjects: holdSubjects,
      impostorImages: holdImpostors,
    );

    if (holdSubjects.isEmpty) {
      notes.add('holdout: hech qanday subyekt holdout\'ga tusha olmadi '
          '(rasmlar juda kam) — holdout korpusi bo\'sh.');
    }

    notes.add('split parametrlari: seed=$seed, holdout=$holdoutFraction');
    return CorpusSplit(
      calibration: calibration,
      holdout: holdout,
      notes: notes,
    );
  }

  /// Bo'limlarni diskka yozadi (rasmlar nusxalanadi).
  ///
  /// Natija: `<outRoot>/calibration/` va `<outRoot>/holdout/` — ikkalasi ham
  /// [CalibrationCorpusLoader] bilan o'qiladigan tuzilmada (masalan
  /// `test_data/calibration/splits/...`, gitignore'da).
  static void writeToDisk(CorpusSplit split, String outRoot) {
    _writeCorpus(split.calibration, '$outRoot/calibration');
    _writeCorpus(split.holdout, '$outRoot/holdout');
  }

  static void _writeCorpus(CalibrationCorpus corpus, String outPath) {
    for (final subject in corpus.subjects) {
      _copyFiles(subject.enrollImages,
          '$outPath/subjects/${subject.id}/enroll');
      _copyFiles(subject.genuineImages,
          '$outPath/subjects/${subject.id}/genuine');
    }
    _copyFiles(corpus.impostorImages, '$outPath/impostors');
  }

  static void _copyFiles(List<File> files, String dirPath) {
    if (files.isEmpty) return;
    final dir = Directory(dirPath)..createSync(recursive: true);
    for (final f in files) {
      File('${dir.path}/${f.uri.pathSegments.last}')
          .writeAsBytesSync(f.readAsBytesSync());
    }
  }

  /// Barqaror (platforma o'rtasida bir xil) satr xeshi.
  /// String.hashCode'ga tayanilmaydi — u VM versiyalarida o'zgarishi mumkin.
  static int _stableHash(String s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = (h * 31 + s.codeUnitAt(i)) & 0x7fffffff;
    }
    return h;
  }

  /// Ro'yxatni `keep` (kalibrlash) va `holdout` ga ajratadi.
  ///
  /// Kafolat: holdout kamida 1, ko'pi bilan n-1 element oladi (n >= 2);
  /// keep ham kamida 1 bo'ladi. n < 2 → barchasi keep.
  static _SplitResult _splitList(
    List<File> items,
    Random rng,
    double fraction,
  ) {
    if (items.length < 2) {
      return _SplitResult(keep: [...items], holdout: const []);
    }
    final shuffled = [...items]..shuffle(rng);
    final desired = (items.length * fraction).round();
    final holdoutCount =
        desired.clamp(1, items.length - 1);
    final holdout = shuffled.take(holdoutCount).toList();
    final keep = shuffled.skip(holdoutCount).toList();
    return _SplitResult(keep: keep, holdout: holdout);
  }
}

class _SplitResult {
  final List<File> keep;
  final List<File> holdout;

  const _SplitResult({required this.keep, required this.holdout});
}
