import '../../domain/entities/identity.dart';
import '../../domain/entities/identity_activity.dart';
import '../../domain/repositories/identity_repository.dart';

/// Identity o'qish operatsiyalari (CQRS queries).
class IdentityQueries {
  final IdentityRepository _repository;

  IdentityQueries({required IdentityRepository repository})
      : _repository = repository;

  Future<List<Identity>> fetchAll() => _repository.fetchAll();

  /// Berilgan IDlar bo'yicha (Phase 16 — sahifalangan browse).
  Future<List<Identity>> fetchByIds(List<String> identityIds) =>
      _repository.fetchByIds(identityIds);

  Future<Identity?> fetchByIdentityId(String identityId) =>
      _repository.fetchByIdentityId(identityId);

  Future<List<Identity>> fetchStudents() =>
      _repository.fetchByRole(IdentityRole.student);

  Future<List<Identity>> fetchTeachers() =>
      _repository.fetchByRole(IdentityRole.teacher);

  Future<List<IdentityActivity>> fetchActivities(String identityId) =>
      _repository.fetchActivities(identityId);
}
