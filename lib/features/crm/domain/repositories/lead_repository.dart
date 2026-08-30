import '../entities/lead.dart';
import '../entities/lead_activity.dart';

/// Lead saqlash va o'qish uchun repository interfeysi.
///
/// Domain qatlami faqat shu interfeysni biladi; Isar tafsilotlari
/// `infrastructure` qatlamida yashiringan (spec §1 Repository Pattern).
abstract class LeadRepository {
  /// Yangi lead'ni saqlaydi. Bir xil `leadId` takrorlansa xato qaytariladi
  /// (mavjud Failure pattern'lari orqali — application qatlamida aniqlanadi).
  Future<Lead> save(Lead lead);

  /// Lead'ni to'liq yangilaydi (stage, score, follow-up va h.k.).
  Future<Lead> update(Lead lead);

  /// Lead uchun timeline yozuvini qo'shadi (LeadActivity).
  Future<void> recordActivity(LeadActivity activity);

  Future<Lead?> fetchByLeadId(String leadId);

  Future<List<Lead>> fetchAll();

  /// Bosqich bo'yicha guruhlangan lead'lar (Kanban ustunlari uchun).
  Future<List<Lead>> fetchByStage(LeadStage stage);

  /// Tayinlangan foydalanuvchi bo'yicha ("Faqat menga" filtri).
  Future<List<Lead>> fetchByAssignedUser(String userId);

  /// Dedup tekshiruvi uchun: ism yoki telefon bo'yicha qidiruv
  /// (IdentityDuplicatesQuery pattern'i — ogohlantiradi, bloklamaydi).
  Future<List<Lead>> searchByNameOrPhone(String query);

  /// Lead uchun timeline yozuvlarini vaqt bo'yicha qaytaradi.
  Future<List<LeadActivity>> fetchActivities(String leadId);

  /// Bosqichdagi lead'lar soni (ustun sarlavhasidagi pill-badge uchun).
  Future<int> countByStage(LeadStage stage);

  /// Konvertatsiya qilingan leadni identityId bo'yicha topadi.
  ///
  /// [Student 360] aggregator uchun — barcha leadlarni skan qilmasdan
  /// (N+1) bitta student'ga tegishli leadni o'qish.
  /// Hech qachon `null` bo'lmasligi kerak (konvertatsiya — 1:1 mapping).
  /// Agar topilmasa — student CRM orqali kelmagan (`CrmSnapshot.empty`).
  Future<Lead?> fetchByConvertedIdentityId(String identityId);
}
