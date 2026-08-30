import 'dart:io';

import '../../application/calibration/calibration_corpus.dart';

/// Korpusni diskdan yuklash natijasi — xatolar halol ko'rsatiladi.
class CalibrationCorpusLoadResult {
  final CalibrationCorpus? corpus;
  final List<String> errors;

  const CalibrationCorpusLoadResult({required this.corpus, required this.errors});

  bool get isValid => corpus != null && errors.isEmpty;
}

/// Korpus yuklovchi (fayl tizimidan).
///
/// Tuzilma:
/// ```text
/// <root>/
///   subjects/
///     <shaxs_id>/
///       enroll/    — 1+ rasm
///       genuine/   — 1+ rasm
///   impostors/
///     — 1+ rasm
/// ```
///
/// Rasm kengaytmalari: .jpg, .jpeg, .png. Boshqa fayllar e'tiborsiz.
/// Katalog yo'q yoki bo'sh bo'lsa — `CalibrationCorpusLoadResult.errors`
/// da sabab ko'rsatiladi (jimgina hech narsa qaytarilmaydi).
class CalibrationCorpusLoader {
  CalibrationCorpusLoader._();

  static const _imageExts = {'.jpg', '.jpeg', '.png'};

  static CalibrationCorpusLoadResult load(String rootPath) {
    final errors = <String>[];
    final root = Directory(rootPath);
    if (!root.existsSync()) {
      return CalibrationCorpusLoadResult(
        corpus: null,
        errors: ['Korpus katalogi topilmadi: $rootPath'],
      );
    }

    final subjectsDir = Directory('$rootPath/subjects');
    final impostorsDir = Directory('$rootPath/impostors');

    if (!subjectsDir.existsSync()) {
      errors.add('subjects/ katalogi yo\'q: ${subjectsDir.path}');
    }
    if (!impostorsDir.existsSync()) {
      errors.add('impostors/ katalogi yo\'q: ${impostorsDir.path}');
    }

    if (errors.isNotEmpty) {
      return CalibrationCorpusLoadResult(corpus: null, errors: errors);
    }

    final subjects = <CalibrationSubject>[];
    final subjectDirs = subjectsDir
        .listSync()
        .whereType<Directory>()
        .toList()
      ..sort((a, b) => a.path.compareTo(b.path));
    for (final entry in subjectDirs) {
      final id = entry.path.split(Platform.pathSeparator).last;
      final enroll = _listImages(Directory('${entry.path}/enroll'));
      final genuine = _listImages(Directory('${entry.path}/genuine'));
      if (enroll.isEmpty) {
        errors.add('$id/enroll: hech qanday rasm yo\'q');
      }
      if (genuine.isEmpty) {
        errors.add('$id/genuine: hech qanday rasm yo\'q');
      }
      subjects.add(CalibrationSubject(
        id: id,
        enrollImages: enroll,
        genuineImages: genuine,
      ));
    }

    if (subjects.isEmpty) {
      errors.add('subjects/: kamida bitta subyekt kerak');
    }
    if (subjects.length < 2) {
      errors.add('subjects/: EER uchun kamida 2 subyekt kerak');
    }

    final impostors = _listImages(impostorsDir);
    if (impostors.length < 2) {
      errors.add('impostors/: kamida 2 rasm kerak (hammasi boshqa '
          'shaxslar bo\'lishi shart)');
    }

    if (errors.isNotEmpty) {
      return CalibrationCorpusLoadResult(corpus: null, errors: errors);
    }

    return CalibrationCorpusLoadResult(
      corpus: CalibrationCorpus(
        root: root,
        subjects: subjects,
        impostorImages: impostors,
      ),
      errors: const [],
    );
  }

  static List<File> _listImages(Directory dir) {
    if (!dir.existsSync()) return const [];
    final files = <File>[];
    for (final entry in dir.listSync()) {
      if (entry is! File) continue;
      final ext = entry.path.toLowerCase();
      if (_imageExts.any(ext.endsWith)) {
        files.add(entry);
      }
    }
    files.sort((a, b) => a.path.compareTo(b.path));
    return files;
  }
}
