import 'package:isar/isar.dart';

part 'subject_record.g.dart';

/// `Subject` entity'sining Isar'da saqlanadigan ko'rinishi.
@collection
class SubjectRecord {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: false)
  late String subjectId;

  late String name;

  String? code;

  String? color;

  late bool isActive;
}
