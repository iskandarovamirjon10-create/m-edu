import 'package:isar/isar.dart';

import '../models/organization_record.dart';

/// Isar bilan ishlaydigan organization datasource.
///
/// Yagona-joriy-yozuv semantikasi: qayta o'rnatish (re-setup) holatida
/// eski yozuv yangisi bilan almashtiriladi (bitta aktiv tashkilot).
class IsarOrganizationDataSource {
  final Isar _db;

  IsarOrganizationDataSource(this._db);

  Future<OrganizationRecord> save(OrganizationRecord record) async {
    return _db.writeTxn(() async {
      final existing = await _db.organizationRecords.where().findFirst();
      if (existing != null) {
        await _db.organizationRecords.delete(existing.id);
      }
      await _db.organizationRecords.put(record);
      return record;
    });
  }

  Future<OrganizationRecord?> fetchCurrent() {
    return _db.organizationRecords.where().sortByCreatedAtDesc().findFirst();
  }
}
