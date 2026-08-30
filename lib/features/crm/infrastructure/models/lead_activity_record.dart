import 'package:isar/isar.dart';

part 'lead_activity_record.g.dart';

/// `LeadActivity` timeline yozuvining Isar'da saqlanadigan ko'rinishi
/// (IdentityActivity pattern'iga mos).
@collection
class LeadActivityRecord {
  Id id = Isar.autoIncrement;

  /// Qaysi lead'ga tegishli (leadId bo'yicha timeline query).
  @Index()
  late String leadId;

  /// `LeadActivityTypes` qiymati — CAPTURED/STAGE_CHANGED/...
  late String type;

  late String description;

  @Index()
  late DateTime occurredAt;

  String? authoredByUserId;

  String? authoredByName;

  String? metadata;
}
