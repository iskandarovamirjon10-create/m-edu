import '../entities/group.dart';

/// Guruh ma'lumotlarini saqlash va o'qish uchun repository interfeysi.
abstract class GroupRepository {
  /// Yangi guruhni saqlaydi.
  Future<Group> save(Group group);

  /// Guruh ma'lumotlarini yangilaydi.
  Future<Group> update(Group group);

  /// Guruh ID bo'yicha guruhni topadi.
  Future<Group?> fetchById(String groupId);

  /// Barcha guruhlarni qaytaradi.
  Future<List<Group>> fetchAll();

  /// Faol guruhlarni qaytaradi.
  Future<List<Group>> fetchActive();

  /// O'qituvchi ID bo'yicha guruhlarni topadi.
  Future<List<Group>> fetchByTeacherId(String teacherId);

  /// Xona ID bo'yicha guruhlarni topadi.
  Future<List<Group>> fetchByRoomId(String roomId);

  /// Guruh a'zosini qo'shadi (currentSize++).
  Future<Group> addMember(String groupId);

  /// Guruh a'zosini chiqaradi (currentSize--).
  Future<Group> removeMember(String groupId);

  /// Guruh holatini yangilaydi.
  Future<Group> updateStatus(String groupId, GroupStatus newStatus);

  /// Guruhni arxivlaydi.
  Future<Group> archive(String groupId);
}
