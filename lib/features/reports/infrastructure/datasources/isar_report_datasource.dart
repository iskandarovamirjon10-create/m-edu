import 'package:isar/isar.dart';

import '../models/report_record.dart';

/// Saqlangan hisobotlar uchun ma'lumot manbai interfeysi.
///
/// Interfeys test uchun ajratilgan — testlarda in-memory fake ishlatiladi
/// (loyiha konvensiyasi: `test/helpers/fake_repositories.dart`).
abstract class ReportDataSource {
  Future<ReportRecord> save(ReportRecord record);

  Future<List<ReportRecord>> findAll({String? type});

  Future<void> delete(String reportId);
}

/// Isar asosidagi implementatsiya.
class IsarReportDataSource implements ReportDataSource {
  final Isar _db;

  IsarReportDataSource(this._db);

  @override
  Future<ReportRecord> save(ReportRecord record) async {
    await _db.writeTxn(() => _db.reportRecords.put(record));
    return record;
  }

  @override
  Future<List<ReportRecord>> findAll({String? type}) async {
    if (type != null && type.isNotEmpty) {
      return _db.reportRecords.where().typeEqualTo(type).findAll();
    }
    return _db.reportRecords.where().findAll();
  }

  @override
  Future<void> delete(String reportId) async {
    await _db.writeTxn(() async {
      final record =
          await _db.reportRecords.where().reportIdEqualTo(reportId).findFirst();
      if (record != null) {
        await _db.reportRecords.delete(record.id);
      }
    });
  }
}
