import 'package:equatable/equatable.dart';

/// Uy vazifasi holati.
enum HomeworkStatus {
  /// Yaqinlashib kelayotgan / yangi.
  pending,

  /// Berilgan va bajarilish muddati hali o'tmagan.
  active,

  /// Muddat o'tgan (bajarilmagan yoki tekshirilgan).
  completed,
}

/// Uy vazifasi entity'si.
///
/// O'qituvchi guruhga vazifa beradi: sarlavha, tavsif, fan, muddat.
/// Vazifalar guruh bo'yicha guruhlanadi va holat bo'yicha filtrlanadi.
class Homework extends Equatable {
  final String homeworkId;
  final String groupId;
  final String? groupName;
  final String subjectName;
  final String title;
  final String description;
  final DateTime dueDate;
  final String? createdBy;
  final String? createdByName;

  /// Bajarilgan deb belgilanganmi (teacher/admin).
  final bool isCompleted;
  final DateTime createdAt;
  final int syncVersion;

  const Homework({
    required this.homeworkId,
    required this.groupId,
    this.groupName,
    required this.subjectName,
    required this.title,
    required this.description,
    required this.dueDate,
    this.createdBy,
    this.createdByName,
    this.isCompleted = false,
    required this.createdAt,
    this.syncVersion = 1,
  });

  HomeworkStatus get status {
    if (isCompleted) return HomeworkStatus.completed;
    if (DateTime.now().isAfter(dueDate)) return HomeworkStatus.completed;
    return HomeworkStatus.active;
  }

  bool get isOverdue =>
      !isCompleted && DateTime.now().isAfter(dueDate);

  Homework copyWith({
    String? homeworkId,
    String? groupId,
    String? groupName,
    String? subjectName,
    String? title,
    String? description,
    DateTime? dueDate,
    String? createdBy,
    String? createdByName,
    bool? isCompleted,
    DateTime? createdAt,
    int? syncVersion,
  }) {
    return Homework(
      homeworkId: homeworkId ?? this.homeworkId,
      groupId: groupId ?? this.groupId,
      groupName: groupName ?? this.groupName,
      subjectName: subjectName ?? this.subjectName,
      title: title ?? this.title,
      description: description ?? this.description,
      dueDate: dueDate ?? this.dueDate,
      createdBy: createdBy ?? this.createdBy,
      createdByName: createdByName ?? this.createdByName,
      isCompleted: isCompleted ?? this.isCompleted,
      createdAt: createdAt ?? this.createdAt,
      syncVersion: syncVersion ?? this.syncVersion,
    );
  }

  @override
  List<Object?> get props => [
        homeworkId,
        groupId,
        groupName,
        subjectName,
        title,
        description,
        dueDate,
        createdBy,
        createdByName,
        isCompleted,
        createdAt,
        syncVersion,
      ];
}
