import 'package:isar/isar.dart';

part 'report_record.g.dart';

/// Saqlangan hisobot yozuvi (spec §6 #34-37, AUDIT P1-02).
///
/// Ilgari `ReportRepositoryImpl.saveReport` fake edi (hech narsa
/// yozmasdi) va `fetchSavedReports` doim `[]` qaytarardi. Endi real
/// Isar persistence: SAVE / LOAD / DELETE to'liq ishlaydi.
@collection
class ReportRecord {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: false)
  late String reportId;

  /// ReportType.name (studentStats | groupStats | revenue | ...).
  @Index()
  late String type;

  late String title;

  /// Hisobot ma'lumotlari (JSON string).
  late String dataJson;

  DateTime? startDate;
  DateTime? endDate;

  @Index()
  late DateTime createdAt;
}
