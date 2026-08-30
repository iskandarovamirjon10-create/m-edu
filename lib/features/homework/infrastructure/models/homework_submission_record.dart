import 'package:isar/isar.dart';

part 'homework_submission_record.g.dart';

/// Uy vazifasining TALABA darajasidagi topshirish yozuvi (spec §23).
///
/// Har bir (homeworkId, studentId) juftligi uchun bitta primary yozuv:
/// - `submitted == true` — talaba topshirdi (✓).
/// - `isLate == true` — muddat o'tgandan keyin topshirildi
///   (\"Kechikib topshirdi\" belgisi).
/// - `note` — ixtiyoriy izoh / matnli javob (fayl saqlanmaydi).
@collection
class HomeworkSubmissionRecord {
  Id id = Isar.autoIncrement;

  @Index()
  late String homeworkId;

  /// Talabaning identity ID'si.
  @Index()
  late String studentId;

  /// Denormalized talaba ismi (ro'yxat ko'rinishi uchun).
  late String studentName;

  /// Topshirilganmi.
  bool submitted = false;

  /// Topshirilgan vaqt.
  DateTime? submittedAt;

  /// Muddatdan keyin topshirilganmi.
  bool isLate = false;

  /// Ixtiyoriy izoh / javob matni.
  String? note;

  /// Sinxronlash versiyasi.
  int syncVersion = 1;
}
