import 'package:equatable/equatable.dart';

/// Guruh holati.
enum GroupStatus { active, inactive, archived }

/// Guruh entity'si (spec §6 #16-18).
///
/// Guruh quyidagi ma'lumotlarni saqlaydi:
/// - Guruh nomi va kodi
/// - Sig'im va hozirgi a'zolar soni
/// - Tayinlangan o'qituvchi
/// - Xona (room)
/// - Kurs/fan
/// - Narx
/// - Dars vaqtlari
class Group extends Equatable {
  /// Guruhning yagona identifikatori.
  final String groupId;

  /// Guruh nomi (masalan, "Matematika-101").
  final String name;

  /// Guruh kodi (qisqa, masalan, "MATH-101").
  final String? code;

  /// Maksimal sig'im.
  final int capacity;

  /// Hozirgi a'zolar soni (denormalized, tez qidirish uchun).
  final int currentSize;

  /// Tayinlangan o'qituvchi identity ID'si.
  final String? teacherId;

  /// O'qituvchi ismi (denormalized).
  final String? teacherName;

  /// Xona ID'si.
  final String? roomId;

  /// Xona nomi (denormalized).
  final String? roomName;

  /// Kurs/fan nomi.
  final String? subject;

  /// O'quv yili.
  final String? academicYear;

  /// Oylik narx (UZS).
  final int monthlyFee;

  /// Guruh holati.
  final GroupStatus status;

  /// Dars boshlanish sanasi.
  final DateTime? startDate;

  /// Dars tugash sanasi.
  final DateTime? endDate;

  /// Haftalik dars kunlari (masalan, ["dushanba", "chorshanba"]).
  final List<String> daysOfWeek;

  /// Dars boshlanish vaqti (HH:mm).
  final String? startTime;

  /// Dars tugash vaqti (HH:mm).
  final String? endTime;

  /// Izoh.
  final String? notes;

  /// Sinxronlash versiyasi.
  final int syncVersion;

  /// Hali serverga sinxronlanmagan.
  final bool pendingSync;

  const Group({
    required this.groupId,
    required this.name,
    this.code,
    required this.capacity,
    this.currentSize = 0,
    this.teacherId,
    this.teacherName,
    this.roomId,
    this.roomName,
    this.subject,
    this.academicYear,
    this.monthlyFee = 0,
    this.status = GroupStatus.active,
    this.startDate,
    this.endDate,
    this.daysOfWeek = const [],
    this.startTime,
    this.endTime,
    this.notes,
    this.syncVersion = 1,
    this.pendingSync = true,
  });

  bool get isActive => status == GroupStatus.active;
  bool get isFull => currentSize >= capacity;
  bool get hasAvailableSlots => currentSize < capacity;
  bool get hasTeacher => teacherId != null;
  bool get hasRoom => roomId != null;

  /// Bo'sh joylar soni.
  int get availableSlots => capacity - currentSize;

  /// Sig'im foizi (0-100).
  double get occupancyPercentage =>
      capacity > 0 ? (currentSize / capacity) * 100 : 0;

  @override
  List<Object?> get props => [
        groupId,
        name,
        code,
        capacity,
        currentSize,
        teacherId,
        teacherName,
        roomId,
        roomName,
        subject,
        academicYear,
        monthlyFee,
        status,
        startDate,
        endDate,
        daysOfWeek,
        startTime,
        endTime,
        notes,
        syncVersion,
        pendingSync,
      ];
}
