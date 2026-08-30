import 'package:isar/isar.dart';

part 'organization_record.g.dart';

/// `Organization` entity'sining Isar'da saqlanadigan ko'rinishi.
@collection
class OrganizationRecord {
  Id id = Isar.autoIncrement;

  /// Haqiqiy tashkilot (markaz) nomi — "No Demo Data" siyosati: bu maydon
  /// hech qachon oldindan to'ldirilmaydi, faqat admin kiritadi (spec §5).
  late String organizationName;
  late String branchName;
  String? roomName;
  String? courseName;

  late DateTime createdAt;

  /// Onlayn/oflayn sync uchun.
  int syncVersion = 1;
  bool pendingSync = true;
}
