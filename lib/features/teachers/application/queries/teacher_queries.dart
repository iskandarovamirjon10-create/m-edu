import '../../domain/entities/teacher.dart';
import '../../domain/repositories/teacher_repository.dart';

/// O'qituvchi o'qish operatsiyalari (CQRS queries).
class TeacherQueries {
  final TeacherRepository _repository;

  TeacherQueries({required TeacherRepository repository})
      : _repository = repository;

  Future<List<Teacher>> fetchAll() => _repository.fetchAll();

  Future<List<Teacher>> fetchActive() => _repository.fetchActive();

  Future<Teacher?> fetchByIdentityId(String identityId) =>
      _repository.fetchByIdentityId(identityId);

  Future<List<Teacher>> fetchByGroupId(String groupId) =>
      _repository.fetchByGroupId(groupId);

  Future<List<Teacher>> fetchBySpecialization(String specialization) =>
      _repository.fetchBySpecialization(specialization);

  Future<int> countAll() async {
    final teachers = await _repository.fetchAll();
    return teachers.length;
  }

  Future<int> countActive() async {
    final teachers = await _repository.fetchActive();
    return teachers.length;
  }
}
