import '../../identity/domain/entities/identity.dart';
import '../../scheduling/domain/entities/lesson_instance.dart';
import '../../students/domain/repositories/student_repository.dart';

/// Face oqimida davomat yozishdan OLDIN bajariladigan biznes validatsiya
/// qarori (spec §17-18). UI darajasida emas — application qatlamida
/// bajariladi, `RecordAttendanceCommand`'ga qadar.
enum FaceAttendanceDecision {
  /// Davomat yozish mumkin.
  allow,

  /// Identity faol emas (arxivlangan/muzlatilgan/bitirilgan) — §17.
  identityInactive,

  /// role=student bo'lsa, Student yozuvi bazada topilmadi — §17.
  studentNotFound,

  /// Student faol emas (arxivlangan/muzlatilgan/bitirilgan) — §17.
  studentInactive,

  /// Student faol darsning guruhiga tegishli emas — §18.
  studentNotInLessonGroup,
}

/// Face ID tanib olingan shaxs uchun davomat oldi tekshiruvi.
///
/// Qoidalar:
/// - Identity `active` bo'lishi shart (arxivlangan/faol emas shaxsga
///   davomat yozilmaydi).
/// - O'quvchi (role=student) uchun qo'shimcha: Student yozuvi bazada
///   mavjud, `active` holatda va `groupId` faol dars guruhiga mos.
/// - O'qituvchi/xodim/ota-ona: faqat identity holati tekshiriladi (guruh
///   a'zoligi faqat talabalar uchun, spec §17-18).
class FaceAttendanceGuard {
  final StudentRepository _studentRepository;

  const FaceAttendanceGuard({required StudentRepository studentRepository})
      : _studentRepository = studentRepository;

  Future<FaceAttendanceDecision> evaluate({
    required Identity identity,
    required LessonInstance lesson,
  }) async {
    if (!identity.isActive) {
      return FaceAttendanceDecision.identityInactive;
    }

    if (identity.role == IdentityRole.student) {
      final student =
          await _studentRepository.fetchByIdentityId(identity.identityId);
      if (student == null) {
        return FaceAttendanceDecision.studentNotFound;
      }
      if (!student.isActive) {
        return FaceAttendanceDecision.studentInactive;
      }
      if (student.groupId == null || student.groupId != lesson.groupId) {
        return FaceAttendanceDecision.studentNotInLessonGroup;
      }
    }

    return FaceAttendanceDecision.allow;
  }
}
