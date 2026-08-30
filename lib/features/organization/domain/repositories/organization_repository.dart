import '../entities/organization.dart';

/// Tashkilot ma'lumotlarini saqlash/o'qish uchun repository interfeysi.
abstract class OrganizationRepository {
  /// Tashkilot ma'lumotlarini saqlaydi (yagona joriy yozuv sifatida).
  Future<Organization> save(Organization organization);

  /// Joriy tashkilotni qaytaradi; o'rnatilmagan bo'lsa null.
  Future<Organization?> fetchCurrent();
}
