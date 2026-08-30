import 'package:isar/isar.dart';

part 'identity_record.g.dart';

/// `Identity` entity'sining Isar'da saqlanadigan ko'rinishi.
@collection
class IdentityRecord {
  Id id = Isar.autoIncrement;

  /// Real ID raqami, masalan `M-EDU-2026-000482`.
  @Index(unique: true, replace: false)
  late String identityId;

  late String firstName;
  late String lastName;
  String? middleName;

  /// `IdentityRole.name` qiymati.
  @Index()
  late String role;

  /// `IdentityStatus.name` qiymati.
  @Index()
  late String status;

  String? phone;
  String? email;

  /// Lokal foto fayli yo'li (xom yuz rasmi bulutga yuborilmaydi, §4.4).
  String? photoPath;

  /// Digital ID Card QR-kodi uchun yagona seed.
  late String qrSeed;

  late DateTime createdAt;
  DateTime? updatedAt;

  /// Onlayn/oflayn sync uchun versiya.
  int syncVersion = 1;

  /// Hali Firebase'ga sinxronlanmagan yozuvlar uchun belgi (hybrid mode).
  bool pendingSync = true;
}
