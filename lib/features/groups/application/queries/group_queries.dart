import '../../domain/entities/group.dart';
import '../../domain/repositories/group_repository.dart';

/// Guruh o'qish operatsiyalari (CQRS queries).
class GroupQueries {
  final GroupRepository _repository;

  GroupQueries({required GroupRepository repository})
      : _repository = repository;

  Future<List<Group>> fetchAll() => _repository.fetchAll();

  Future<List<Group>> fetchActive() => _repository.fetchActive();

  Future<Group?> fetchById(String groupId) => _repository.fetchById(groupId);

  Future<List<Group>> fetchByTeacherId(String teacherId) =>
      _repository.fetchByTeacherId(teacherId);

  Future<List<Group>> fetchByRoomId(String roomId) =>
      _repository.fetchByRoomId(roomId);

  Future<int> countAll() async {
    final groups = await _repository.fetchAll();
    return groups.length;
  }

  Future<int> countActive() async {
    final groups = await _repository.fetchActive();
    return groups.length;
  }
}
