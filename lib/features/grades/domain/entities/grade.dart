/// O'quvchi bahosi (5-ballik tizim).
///
/// Professional education CRM — o'quvchilar o'zlashtirishini kuzatish
/// moduli. Har bir baho fan, sana va ixtiyoriy izoh bilan saqlanadi.
class Grade {
  final String gradeId;
  final String studentIdentityId;
  final String studentName;
  final String? groupId;
  final String? groupName;
  final String subjectId;
  final String subjectName;
  final int value;
  final String? comment;
  final DateTime date;

  /// Sinxronlash versiyasi.
  final int syncVersion;

  const Grade({
    required this.gradeId,
    required this.studentIdentityId,
    required this.studentName,
    this.groupId,
    this.groupName,
    required this.subjectId,
    required this.subjectName,
    required this.value,
    this.comment,
    required this.date,
    this.syncVersion = 1,
  });

  Grade copyWith({
    int? value,
    String? comment,
    String? subjectId,
    String? subjectName,
    DateTime? date,
  }) {
    return Grade(
      gradeId: gradeId,
      studentIdentityId: studentIdentityId,
      studentName: studentName,
      groupId: groupId,
      groupName: groupName,
      subjectId: subjectId ?? this.subjectId,
      subjectName: subjectName ?? this.subjectName,
      value: value ?? this.value,
      comment: comment ?? this.comment,
      date: date ?? this.date,
      syncVersion: syncVersion,
    );
  }
}

/// Bir o'quvchining barcha fanlar bo'yicha jamlanmasi.
class StudentGradeSummary {
  final String studentIdentityId;
  final String studentName;
  final String? groupName;
  final int gradeCount;
  final double average;
  final int bestGrade;
  final int lowestGrade;

  const StudentGradeSummary({
    required this.studentIdentityId,
    required this.studentName,
    this.groupName,
    required this.gradeCount,
    required this.average,
    required this.bestGrade,
    required this.lowestGrade,
  });
}

/// Bir fan bo'yicha guruhlangan baholar (o'quvchi detail'ida ko'rsatiladi).
class SubjectGradeGroup {
  final String subjectName;
  final List<Grade> grades;
  final double average;

  const SubjectGradeGroup({
    required this.subjectName,
    required this.grades,
    required this.average,
  });
}
