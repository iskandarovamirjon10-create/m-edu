import 'package:equatable/equatable.dart';

/// §13 davomat holati.
enum AttendanceStatus { present, late, absent, excused }

/// Davomat yozuvi entity'si (V3 — P0-02).
///
/// **Invariant (spec §14): 1 talaba + 1 dars = 1 primary yozuv.**
/// Birinchi belgilash → [checkInAt]; dars ichidagi ikkinchi belgilash →
/// [checkOutAt]; uchinchisi → takroriy (e'tiborsiz).
///
/// [lessonId] berilganda yozuv dars darajasida (1 talaba + 1 dars),
/// aks holda kundalik (legacy V2: 1 talaba + 1 kun).
class AttendanceEntry extends Equatable {
  /// Isar ichki ID (yangisi uchun null).
  final int? id;

  final String identityId;
  final String fullName;

  /// IdentityRole.name: student | teacher | staff | parent.
  final String role;

  /// Primary yozuv sanasi (00:00 ga normallashtirilgan) — §69.
  final DateTime attendanceDate;

  /// Dars instance ID (P0-02): `LESSON-{scheduleId}-{yyyyMMdd}`.
  ///
  /// Null — legacy kundalik yozuv (V2). Dars aniqlanganda to'ldiriladi
  /// va shu dars bo'yicha idempotent merge qilinadi.
  final String? lessonId;

  /// Kirish vaqti (birinchi belgilash).
  final DateTime? checkInAt;

  /// Chiqish vaqti (ikkinchi belgilash) — agar bo'lsa.
  final DateTime? checkOutAt;

  /// Belgilash usuli: face | qr | manual (check-in usuli).
  final String method;

  /// §13 holat (string — eski yozuvlarda legacy qiymat bo'lishi mumkin).
  final String status;

  /// Face usuli uchun ishonch darajasi (0..1).
  final double? confidence;

  /// Manba: kamera nomi, qurilma, admin.
  final String? source;

  /// Eski (V1) yozuv birlashtirilganmi — so'rovlarda ko'rsatilmaydi.
  final bool isLegacyMerged;

  /// Qaysi primary yozuvga birlashtirilgani (audit izi).
  final int? mergedIntoId;

  /// Yozuv tahrirlangan vaqti (V4) — null = yozuv asl holatida.
  final DateTime? editedAt;

  const AttendanceEntry({
    this.id,
    required this.identityId,
    required this.fullName,
    required this.role,
    required this.attendanceDate,
    this.lessonId,
    this.checkInAt,
    this.checkOutAt,
    required this.method,
    this.status = 'present',
    this.confidence,
    this.source,
    this.isLegacyMerged = false,
    this.mergedIntoId,
    this.editedAt,
  });

  /// Vaqt nuqtasi — V1 bilan moslik: check-in vaqti (yoki sana).
  DateTime get timestamp => checkInAt ?? attendanceDate;

  /// Chiqish belgilanganmi?
  bool get isCheckedOut => checkOutAt != null;

  /// Vaqt oralig'i (masalan, "09:00 - 12:30" yoki "09:00").
  String get timeRange {
    final inTime = _formatTime(checkInAt ?? attendanceDate);
    final outTime = checkOutAt == null ? null : _formatTime(checkOutAt!);
    return outTime == null ? inTime : '$inTime - $outTime';
  }

  AttendanceEntry copyWith({
    DateTime? attendanceDate,
    String? lessonId,
    DateTime? checkInAt,
    Object? checkOutAt = _unset,
    String? method,
    String? status,
    double? confidence,
    String? source,
    bool? isLegacyMerged,
    int? mergedIntoId,
    Object? editedAt = _unset,
  }) {
    return AttendanceEntry(
      id: id,
      identityId: identityId,
      fullName: fullName,
      role: role,
      attendanceDate: attendanceDate ?? this.attendanceDate,
      lessonId: lessonId ?? this.lessonId,
      checkInAt: checkInAt ?? this.checkInAt,
      checkOutAt: identical(checkOutAt, _unset) ? this.checkOutAt : checkOutAt as DateTime?,
      method: method ?? this.method,
      status: status ?? this.status,
      confidence: confidence ?? this.confidence,
      source: source ?? this.source,
      isLegacyMerged: isLegacyMerged ?? this.isLegacyMerged,
      mergedIntoId: mergedIntoId ?? this.mergedIntoId,
      editedAt: identical(editedAt, _unset) ? this.editedAt : editedAt as DateTime?,
    );
  }

  static String _formatTime(DateTime t) {
    final h = t.hour.toString().padLeft(2, '0');
    final m = t.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  static const Object _unset = _CopyWithUnset();

  @override
  List<Object?> get props => [
        id,
        identityId,
        fullName,
        role,
        attendanceDate,
        lessonId,
        checkInAt,
        checkOutAt,
        method,
        status,
        confidence,
        source,
        isLegacyMerged,
        mergedIntoId,
        editedAt,
      ];
}

class _CopyWithUnset {
  const _CopyWithUnset();
}
