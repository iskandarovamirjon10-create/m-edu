import '../datasources/isar_homework_submission_datasource.dart';
import '../models/homework_submission_record.dart';

/// Uy vazifasi topshiriqlari uchun repository.
///
/// Upsert semantika: (homeworkId, studentId) juftligi bo'yicha bitta
/// primary yozuv — takroriy belgilash mavjud yozuvni yangilaydi.
class HomeworkSubmissionRepository {
  final IsarHomeworkSubmissionDataSource _dataSource;

  HomeworkSubmissionRepository(this._dataSource);

  /// Talaba topshirish holatini saqlaydi (✓ / ○ almashtirish).
  Future<HomeworkSubmissionRecord> put(HomeworkSubmissionRecord record) {
    return _dataSource.putSubmission(record);
  }

  /// Vazifa bo'yicha barcha topshiriqlar.
  Future<List<HomeworkSubmissionRecord>> fetchByHomework(String homeworkId) {
    return _dataSource.findByHomework(homeworkId);
  }

  /// Vazifa o'chirilganda unga tegishli topshiriqlarni ham o'chiradi.
  Future<void> deleteByHomework(String homeworkId) {
    return _dataSource.deleteByHomework(homeworkId);
  }
}
