import '../../../homework/domain/entities/homework.dart';
import '../datasources/isar_homework_datasource.dart';
import '../models/homework_record.dart';

/// Repository responsible for translating between the Homework domain entity
/// and its Isar persistence model.
class HomeworkRepository {
  final IsarHomeworkDataSource _dataSource;

  HomeworkRepository(this._dataSource);

  Future<Homework> create(Homework homework) async {
    final record = _toRecord(homework);
    final savedRecord = await _dataSource.insert(record);
    return _toEntity(savedRecord);
  }

  Future<Homework> update(Homework homework) async {
    final record = _toRecord(homework);
    final savedRecord = await _dataSource.update(record);
    return _toEntity(savedRecord);
  }

  Future<void> delete(String homeworkId) {
    return _dataSource.delete(homeworkId);
  }

  Future<Homework?> fetchById(String homeworkId) async {
    final record = await _dataSource.findById(homeworkId);
    return record == null ? null : _toEntity(record);
  }

  Future<List<Homework>> fetchAll() async {
    final records = await _dataSource.findAll();
    return <Homework>[
      for (final record in records) _toEntity(record),
    ];
  }

  Future<List<Homework>> fetchByGroup(String groupId) async {
    final records = await _dataSource.findByGroup(groupId);
    return <Homework>[
      for (final record in records) _toEntity(record),
    ];
  }

  HomeworkRecord _toRecord(Homework homework) {
    return HomeworkRecord()
      ..homeworkId = homework.homeworkId
      ..groupId = homework.groupId
      ..groupName = homework.groupName
      ..subjectName = homework.subjectName
      ..title = homework.title
      ..description = homework.description
      ..dueDate = homework.dueDate
      ..createdBy = homework.createdBy
      ..createdByName = homework.createdByName
      ..isCompleted = homework.isCompleted
      ..createdAt = homework.createdAt
      ..syncVersion = homework.syncVersion;
  }

  Homework _toEntity(HomeworkRecord record) {
    return Homework(
      homeworkId: record.homeworkId,
      groupId: record.groupId,
      groupName: record.groupName,
      subjectName: record.subjectName,
      title: record.title,
      description: record.description,
      dueDate: record.dueDate,
      createdBy: record.createdBy,
      createdByName: record.createdByName,
      isCompleted: record.isCompleted,
      createdAt: record.createdAt,
      syncVersion: record.syncVersion,
    );
  }
}