import 'package:isar/isar.dart';

part 'user_record.g.dart';

/// `AppUser` entity'sining Isar'da saqlanadigan ko'rinishi.
@collection
class UserRecord {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: false)
  late String userId;

  late String identityId;

  @Index(unique: true)
  late String email;

  late String role;

  late bool isActive;

  late DateTime createdAt;

  DateTime? lastLoginAt;
}
