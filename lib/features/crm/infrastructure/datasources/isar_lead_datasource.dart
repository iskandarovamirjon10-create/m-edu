import 'package:isar/isar.dart';

import '../models/lead_activity_record.dart';
import '../models/lead_record.dart';

/// Isar asosidagi lead datasource — barcha quyi darajadagi query'lar.
///
/// Repository interfeysi (domain) bu qatlamni bilmaydi — faqat
/// `LeadRepositoryImpl` orqali ishlatiladi (Repository Pattern, spec §1).
class IsarLeadDataSource {
  final Isar _db;

  IsarLeadDataSource(this._db);

  /// Yangi lead saqlaydi. Bir xil leadId mavjud bo'lsa — xato
  /// (unique index replace: false). Eski yozuvni yangilash uchun
  /// [update] ishlatiladi.
  Future<LeadRecord> insert(LeadRecord record) async {
    await _db.writeTxn(() async {
      await _db.leadRecords.put(record);
    });
    return record;
  }

  /// Mavjud lead'ni yangilaydi.
  ///
  /// Yangi `LeadRecord` (id=autoIncrement/0) put qilinmasdan avval mavjud
  /// yozuvning `id`si olinadi — `leadId` unique index `replace: false`
  /// bo'lgani uchun put id bo'yicha almashtiradi, unique to'qnashuv
  /// tashlanmaydi (Isar putUpsert xulq-atvori).
  Future<LeadRecord> update(LeadRecord record) async {
    return _db.writeTxn(() async {
      final existing = await _db.leadRecords
          .filter()
          .leadIdEqualTo(record.leadId)
          .findFirst();
      if (existing != null) {
        record.id = existing.id;
      }
      await _db.leadRecords.put(record);
      return record;
    });
  }

  Future<LeadRecord?> findById(String leadId) {
    return _db.leadRecords
        .filter()
        .leadIdEqualTo(leadId)
        .findFirst();
  }

  /// Barcha lead'lar — yangi birinchi.
  Future<List<LeadRecord>> findAll() {
    return _db.leadRecords
        .where()
        .sortByCreatedAtDesc()
        .findAll();
  }

  /// Bosqich bo'yicha (Kanban ustunlari) — yangi birinchi.
  Future<List<LeadRecord>> findByStage(String stage) {
    return _db.leadRecords
        .filter()
        .stageEqualTo(stage)
        .sortByCreatedAtDesc()
        .findAll();
  }

  /// Tayinlangan foydalanuvchi bo'yicha.
  Future<List<LeadRecord>> findByAssignedUser(String userId) {
    return _db.leadRecords
        .filter()
        .assignedToUserIdEqualTo(userId)
        .sortByCreatedAtDesc()
        .findAll();
  }

  /// Ism yoki telefon bo'yicha qidiruv (dedup ogohlantirishi uchun).
  /// Isar'da contains LIKE query: barcha yozuvlar filtrlanadi — lead'lar
  /// soni odatda kichik bo'lgani uchun bu yondashuv yetarli.
  Future<List<LeadRecord>> searchByNameOrPhone(String query) async {
    final q = query.trim().toLowerCase();
    final all = await findAll();
    return all
        .where((r) =>
            r.fullName.toLowerCase().contains(q) ||
            (r.phone ?? '').toLowerCase().contains(q))
        .toList();
  }

  Future<int> countByStage(String stage) {
    return _db.leadRecords
        .filter()
        .stageEqualTo(stage)
        .count();
  }

  /// Konvertatsiya qilingan leadni identityId bo'yicha topadi.
  ///
  /// [convertedToIdentityId] indexed — O(log N) lookup. Student 360
  /// aggregator uchun N+1 (`findAll` + filter) o'rniga.
  /// Hech qachon bir nechta natija qaytarmasligi kerak (konvertatsiya
  /// — 1:1 mapping, isFinal stage).
  Future<LeadRecord?> findByConvertedIdentityId(String identityId) {
    return _db.leadRecords
        .filter()
        .convertedToIdentityIdEqualTo(identityId)
        .findFirst();
  }

  // ─── LeadActivity ──────────────────────────────────────────────────────

  Future<void> insertActivity(LeadActivityRecord record) async {
    await _db.writeTxn(() async {
      await _db.leadActivityRecords.put(record);
    });
  }

  /// Lead timeline — eski → yangi (xronologik).
  Future<List<LeadActivityRecord>> findActivities(String leadId) {
    return _db.leadActivityRecords
        .filter()
        .leadIdEqualTo(leadId)
        .sortByOccurredAt()
        .findAll();
  }
}
