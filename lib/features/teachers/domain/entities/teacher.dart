import 'package:equatable/equatable.dart';

/// O'qituvchi holati.
enum TeacherStatus { active, inactive, onLeave }

/// O'qituvchi entity'si — Identity agregatiga bog'liq (spec §6 #12-15).
///
/// O'qituvchi qo'shimcha ma'lumotlarni saqlaydi:
/// - Mutaxassislik (subject/specialization)
/// - Tayinlangan guruhlar
/// - Ish yuki (workload)
/// - Dars jadvali
class Teacher extends Equatable {
  /// Identity ID orqali bog'lanadi.
  final String identityId;

  /// O'qituvchi raqami (ichki).
  final int teacherNumber;

  /// Mutaxassislik (masalan, "Matematika", "Ingliz tili").
  final String? specialization;

  /// Tayinlangan guruhlar ID'lari.
  final List<String> assignedGroupIds;

  /// Haftalik dars soati.
  final int weeklyHours;

  /// Maksimal haftalik soat.
  final int maxWeeklyHours;

  /// O'qituvchi holati.
  final TeacherStatus status;

  /// Ish boshlagan sana.
  final DateTime? startDate;

  /// Tugatgan sana (agar bo'lsa).
  final DateTime? endDate;

  /// Maosh (UZS).
  final int salary;

  /// Izoh.
  final String? notes;

  /// Sinxronlash versiyasi.
  final int syncVersion;

  /// Hali serverga sinxronlanmagan.
  final bool pendingSync;

  const Teacher({
    required this.identityId,
    required this.teacherNumber,
    this.specialization,
    this.assignedGroupIds = const [],
    this.weeklyHours = 0,
    this.maxWeeklyHours = 40,
    this.status = TeacherStatus.active,
    this.startDate,
    this.endDate,
    this.salary = 0,
    this.notes,
    this.syncVersion = 1,
    this.pendingSync = true,
  });

  bool get isActive => status == TeacherStatus.active;
  bool get isAvailable => isActive && weeklyHours < maxWeeklyHours;

  /// Yuklama foizi (0-100).
  double get workloadPercentage =>
      maxWeeklyHours > 0 ? (weeklyHours / maxWeeklyHours) * 100 : 0;

  /// Bo'sh soatlar soni.
  int get availableHours => maxWeeklyHours - weeklyHours;

  /// Guruhga tayinlanganmi?
  bool hasGroup(String groupId) => assignedGroupIds.contains(groupId);

  /// Yangilangan nusxa (profil tahriri — [UpdateTeacherCommand]).
  Teacher copyWith({
    Object? specialization = _unset,
    Object? notes = _unset,
    int? maxWeeklyHours,
    int? salary,
  }) {
    return Teacher(
      identityId: identityId,
      teacherNumber: teacherNumber,
      specialization: identical(specialization, _unset)
          ? this.specialization
          : specialization as String?,
      assignedGroupIds: assignedGroupIds,
      weeklyHours: weeklyHours,
      maxWeeklyHours: maxWeeklyHours ?? this.maxWeeklyHours,
      status: status,
      startDate: startDate,
      endDate: endDate,
      salary: salary ?? this.salary,
      notes: identical(notes, _unset) ? this.notes : notes as String?,
      syncVersion: syncVersion,
      pendingSync: pendingSync,
    );
  }

  /// [copyWith] uchun "o'zgartirilmagan" qiymat sentineli.
  static const Object _unset = _CopyWithUnset();

  @override
  List<Object?> get props => [
        identityId,
        teacherNumber,
        specialization,
        assignedGroupIds,
        weeklyHours,
        maxWeeklyHours,
        status,
        startDate,
        endDate,
        salary,
        notes,
        syncVersion,
        pendingSync,
      ];
}

class _CopyWithUnset {
  const _CopyWithUnset();
}
