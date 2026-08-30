import 'package:equatable/equatable.dart';

/// Student 360 — ACADEMIC snapshot.
///
/// Student'ning guruh bilan bog'liq holati:
/// - Joriy guruh
/// - O'qituvchi
/// - O'quv yili
/// - Status
///
/// Hozirgi mavjud field'lar: Student.groupId, groupName, academicYear,
/// studentStatus, transferStatus.
///
/// Student.transferStatus.pending + transferToGroupId mavjud bo'lsa —
/// `pendingTransferTo` ko'rsatiladi (guruh o'tkazish jarayonda).
class AcademicSnapshot extends Equatable {
  final String? currentGroupId;
  final String? currentGroupName;
  final String? academicYear;
  final String studentStatus;

  /// Agar transfer pending bo'lsa — maqsad guruh.
  final String? pendingTransferToGroupId;

  /// Transfer holati ('none' / 'pending' / 'completed').
  final String transferStatus;

  /// Ro'yxatga olingan sana.
  final DateTime? enrolledAt;

  /// Guruhga tayinlangan sana.
  final DateTime? assignedAt;

  /// Bitirgan/arxivlangan sana.
  final DateTime? completedAt;

  const AcademicSnapshot({
    required this.currentGroupId,
    required this.currentGroupName,
    required this.academicYear,
    required this.studentStatus,
    required this.pendingTransferToGroupId,
    required this.transferStatus,
    required this.enrolledAt,
    required this.assignedAt,
    required this.completedAt,
  });

  bool get hasGroup => currentGroupId != null;
  bool get isPendingTransfer => transferStatus == 'pending';
  bool get isActive => studentStatus == 'active';

  AcademicSnapshot copyWith({
    Object? currentGroupId = _unset,
    Object? currentGroupName = _unset,
    Object? academicYear = _unset,
    String? studentStatus,
    Object? pendingTransferToGroupId = _unset,
    String? transferStatus,
    Object? enrolledAt = _unset,
    Object? assignedAt = _unset,
    Object? completedAt = _unset,
  }) {
    return AcademicSnapshot(
      currentGroupId: identical(currentGroupId, _unset)
          ? this.currentGroupId
          : currentGroupId as String?,
      currentGroupName: identical(currentGroupName, _unset)
          ? this.currentGroupName
          : currentGroupName as String?,
      academicYear: identical(academicYear, _unset)
          ? this.academicYear
          : academicYear as String?,
      studentStatus: studentStatus ?? this.studentStatus,
      pendingTransferToGroupId: identical(pendingTransferToGroupId, _unset)
          ? this.pendingTransferToGroupId
          : pendingTransferToGroupId as String?,
      transferStatus: transferStatus ?? this.transferStatus,
      enrolledAt:
          identical(enrolledAt, _unset) ? this.enrolledAt : enrolledAt as DateTime?,
      assignedAt:
          identical(assignedAt, _unset) ? this.assignedAt : assignedAt as DateTime?,
      completedAt: identical(completedAt, _unset)
          ? this.completedAt
          : completedAt as DateTime?,
    );
  }

  @override
  List<Object?> get props => [
        currentGroupId,
        currentGroupName,
        academicYear,
        studentStatus,
        pendingTransferToGroupId,
        transferStatus,
        enrolledAt,
        assignedAt,
        completedAt,
      ];

  static const Object _unset = _CopyWithUnset();
}

class _CopyWithUnset {
  const _CopyWithUnset();
}
