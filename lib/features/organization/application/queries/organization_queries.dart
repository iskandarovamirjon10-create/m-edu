import '../../domain/entities/organization.dart';
import '../../domain/repositories/organization_repository.dart';

class OrganizationQueries {
  final OrganizationRepository _repository;

  OrganizationQueries({required OrganizationRepository repository})
      : _repository = repository;

  Future<Organization?> fetchCurrent() => _repository.fetchCurrent();

  /// First-run wizard ko'rsatilishi kerakligini aniqlaydi
  /// (tashkilot hali o'rnatilmagan bo'lsa — true).
  Future<bool> requiresSetup() async {
    final current = await _repository.fetchCurrent();
    return current == null;
  }
}
