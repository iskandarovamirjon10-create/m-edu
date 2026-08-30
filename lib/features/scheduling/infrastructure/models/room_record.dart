import 'package:isar/isar.dart';

part 'room_record.g.dart';

/// `Room` entity'sining Isar'da saqlanadigan ko'rinishi.
@collection
class RoomRecord {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: false)
  late String roomId;

  late String name;

  String? code;

  late int capacity;

  String? location;

  @Index()
  late String status;

  /// Jihozlar JSON formatda.
  String? amenitiesJson;

  String? photoPath;

  String? notes;

  int syncVersion = 1;
}
