import 'package:isar/isar.dart';

part 'identity_activity_record.g.dart';

/// `IdentityActivity` entity'sining Isar'da saqlanadigan ko'rinishi
/// (Activity Timeline audit-log, spec §3).
@collection
class IdentityActivityRecord {
  Id id = Isar.autoIncrement;

  /// Qaysi identity'ga tegishli.
  @Index()
  late String identityId;

  /// `IdentityActivityTypes` dagi tur.
  late String type;

  /// Insonga tushunarli tavsif (audit uchun).
  late String description;

  @Index()
  late DateTime occurredAt;
}
