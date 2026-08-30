import 'package:equatable/equatable.dart';

import '../../../identity/domain/entities/identity.dart';

/// Student 360 — IDENTITY snapshot.
///
/// [Identity] agregatining minimal, o'zgarmas ko'rinishi (snapshot).
/// Student 360 faqat REAL identity ma'lumotlarini ko'rsatadi —
/// to'liq entity'ni qaytarish o'rniga snapshot projection ishlatiladi.
///
/// MUHIM: Identity entity'sida hozir `birthDate`, `gender`, `address`
/// kabi maydonlar MAVJUD EMAS (Identity spec §3 — minimal aggregate).
/// Shu sababli bu snapshot ham ularsiz qaytadi. Kelajakda Identity
/// kengaytirilganda shu snapshot ham avtomatik kengaytiriladi.
class StudentIdentitySnapshot extends Equatable {
  final String identityId;
  final String fullName;
  final String? photoPath;
  final String? phone;
  final String? email;
  final IdentityStatus status;
  final IdentityRole role;
  final DateTime registeredAt;
  final DateTime? lastUpdatedAt;

  const StudentIdentitySnapshot({
    required this.identityId,
    required this.fullName,
    required this.photoPath,
    required this.phone,
    required this.email,
    required this.status,
    required this.role,
    required this.registeredAt,
    required this.lastUpdatedAt,
  });

  /// [Identity] → snapshot proyeksiyasi.
  ///
  /// To'g'ridan-to'g'ri field-to-field ko'chirish — qo'shimcha
  /// validatsiya yoki transformatsiya yo'q (snapshot o'zgarmas).
  factory StudentIdentitySnapshot.fromIdentity(Identity identity) {
    return StudentIdentitySnapshot(
      identityId: identity.identityId,
      fullName: identity.fullName,
      photoPath: identity.photoPath,
      phone: identity.phone,
      email: identity.email,
      status: identity.status,
      role: identity.role,
      registeredAt: identity.createdAt,
      lastUpdatedAt: identity.updatedAt,
    );
  }

  @override
  List<Object?> get props => [
        identityId,
        fullName,
        photoPath,
        phone,
        email,
        status,
        role,
        registeredAt,
        lastUpdatedAt,
      ];
}
