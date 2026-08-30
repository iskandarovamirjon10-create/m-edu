import 'package:equatable/equatable.dart';

/// Dars INSTANCE — jadval (Schedule) shablonining aniq sanadagi hodisasi.
///
/// [Schedule] shablon (hafta kuni + vaqt oralig'i), [LessonInstance] esa
/// REAL dars: "2026-08-11, Matematika, Group A, 09:00". Bitta recurring
/// schedule har bir mos sanada yangi instance hosil qiladi.
///
/// ```text
/// Schedule (template)
///      ↓ coversDate(sana)
/// LessonInstance ──lessonId──▶ Attendance
/// ```
///
/// Instance ID deterministik: `LESSON-{scheduleId}-{yyyyMMdd}` — bir xil
/// (schedule, sana) juftligi har doim bir xil ID beradi. DB'da alohida
/// saqlanmaydi — [LessonInstanceService] hisoblab chiqaradi.
class LessonInstance extends Equatable {
  /// Yagona dars instance ID (attendance `lessonId` sifatida ishlatiladi).
  final String lessonId;

  /// Manba jadval.
  final String scheduleId;

  /// Instance sanasi (00:00 ga normallashtirilgan).
  final DateTime date;

  /// Dars boshlanish vaqti (HH:mm).
  final String startTime;

  /// Dars tugash vaqti (HH:mm).
  final String endTime;

  /// Fan nomi.
  final String? subject;

  /// Guruh ID.
  final String groupId;

  /// Guruh nomi (denormalized).
  final String? groupName;

  /// O'qituvchi ismi (denormalized).
  final String? teacherName;

  /// Xona nomi (denormalized).
  final String? roomName;

  const LessonInstance({
    required this.lessonId,
    required this.scheduleId,
    required this.date,
    required this.startTime,
    required this.endTime,
    this.subject,
    required this.groupId,
    this.groupName,
    this.teacherName,
    this.roomName,
  });

  /// UI uchun qisqa label: "Matematika • 09:00 - 10:30".
  String get label {
    final base = subject ?? 'Dars';
    return '$base • $startTime - $endTime';
  }

  @override
  List<Object?> get props => [
        lessonId,
        scheduleId,
        date,
        startTime,
        endTime,
        subject,
        groupId,
        groupName,
        teacherName,
        roomName,
      ];
}
