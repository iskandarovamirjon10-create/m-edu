/// Lead Real ID generatsiyasi uchun domain servis interfeysi.
///
/// Application qatlami qanday saqlanishini (Isar, fayl) bilmaydi — faqat
/// keyingi ketma-ket ID'ni so'raydi. Format: `LEAD-2026-000123`
/// (IdentitySequenceGenerator pattern'iga o'xshash alohida counter,
/// spec CRM §3.1).
abstract class LeadIdGenerator {
  Future<String> next();
}
