import 'dart:io';

/// Kalibrlash korpusidagi bitta subyekt (bir shaxs).
class CalibrationSubject {
  /// Subyekt identifikatori (katalog nomi, masalan 'alisher').
  final String id;

  /// Enroll (ro'yxatga olish) namunalari — shu shaxsning yuzlari.
  final List<File> enrollImages;

  /// Genuine namunalari — enroll'dan FARQLI suratlar (bir xil shaxs).
  final List<File> genuineImages;

  const CalibrationSubject({
    required this.id,
    required this.enrollImages,
    required this.genuineImages,
  });
}

/// Kalibrlash korpusi — diskdagi katalog tuzilmasining modeli.
///
/// Tuzilma (spec §29):
/// ```text
/// test_data/calibration/
///   subjects/
///     <shaxs_id>/
///       enroll/    — 2+ surat (ro'yxatga olish namunalari)
///       genuine/   — 2+ surat (bir xil shaxs, turli holatlar)
///   impostors/
///     <surat>.jpg  — 2+ surat (boshqa shaxslar)
/// ```
///
/// Hech qachon production'ga bormaydigan, faqat development/kalibrlash
/// korpusi (test_data/ gitignore'da).
class CalibrationCorpus {
  final Directory root;
  final List<CalibrationSubject> subjects;
  final List<File> impostorImages;

  const CalibrationCorpus({
    required this.root,
    required this.subjects,
    required this.impostorImages,
  });

  /// Korpus real tahlilga yaroqlimi (eng kam talablar).
  bool get isValid =>
      subjects.length >= 2 &&
      impostorImages.length >= 2 &&
      subjects.every(
          (s) => s.enrollImages.isNotEmpty && s.genuineImages.isNotEmpty);
}
