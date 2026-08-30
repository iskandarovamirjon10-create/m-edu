import 'package:equatable/equatable.dart';

/// Shaxsning tizimdagi roli (spec §3 Universal Identity).
enum IdentityRole { student, teacher, staff, parent }

/// Identity holati workflow'i (spec §4 #11):
/// faol → muzlatilgan → bitirgan → arxiv.
enum IdentityStatus { active, frozen, graduated, archived }

/// Universal Identity — har bir shaxs (talaba, o'qituvchi, xodim,
/// ota-ona) uchun yagona, real ID'ga ega bo'lgan agregat.
class Identity extends Equatable {
  /// Real ID raqami, masalan `M-EDU-2026-000482` (hech qachon hardcode
  /// emas — `IdentityIdGenerator` tomonidan generatsiya qilinadi).
  final String identityId;

  final String firstName;
  final String lastName;
  final String? middleName;

  final IdentityRole role;
  final IdentityStatus status;

  final String? phone;
  final String? email;
  final String? photoPath;

  /// QR-kod uchun yagona seed (Digital ID Card identifikatsiyasi).
  final String qrSeed;

  final DateTime createdAt;
  final DateTime? updatedAt;

  /// Onlayn/oflayn sinxronizatsiya uchun optimistik versiya.
  final int syncVersion;

  /// Hali serverga sinxronlanmaganligini bildiradi (hybrid mode).
  final bool pendingSync;

  const Identity({
    required this.identityId,
    required this.firstName,
    required this.lastName,
    this.middleName,
    required this.role,
    required this.status,
    this.phone,
    this.email,
    this.photoPath,
    required this.qrSeed,
    required this.createdAt,
    this.updatedAt,
    this.syncVersion = 1,
    this.pendingSync = true,
  });

  String get fullName =>
      [firstName, middleName, lastName].whereType<String>().join(' ');

  bool get isStudent => role == IdentityRole.student;
  bool get isActive => status == IdentityStatus.active;

  @override
  List<Object?> get props => [
        identityId,
        firstName,
        lastName,
        middleName,
        role,
        status,
        phone,
        email,
        photoPath,
        qrSeed,
        createdAt,
        updatedAt,
        syncVersion,
        pendingSync,
      ];
}
