import 'package:equatable/equatable.dart';

/// Student 360 — FAMILY snapshot.
///
/// M-EDU'da ota-ona/vasiy ma'lumotlari `Student` entity'sida
/// denormalized saqlanadi (Student.parentId, parentName, parentPhone,
/// parentTelegramId) — alohida Parent aggregate MAVJUD EMAS.
///
/// Shuning uchun family snapshot bevosita [Student] maydonlaridan
/// quriladi. Hozirgi mavjud field'lar:
/// - parentName (vasiy ismi)
/// - parentPhone (vasiy telefoni, normalized)
/// - parentTelegramId (Telegram chat ID)
/// - parentId (Identity ID — agar mavjud bo'lsa, ota-onaning alohida
///   identity yozuvi mavjudligini bildiradi)
///
/// MUHIM: "ota", "ona", "guardian" alohida maydonlari MAVJUD EMAS —
/// hozir tizimda bitta "primary guardian" tushunchasi bor (spec §6).
class FamilySnapshot extends Equatable {
  final String? guardianName;
  final String? guardianPhone;
  final String? guardianTelegramId;

  /// Guardian'ning alohida Identity yozuvi mavjudmi.
  final bool hasLinkedIdentity;

  const FamilySnapshot({
    required this.guardianName,
    required this.guardianPhone,
    required this.guardianTelegramId,
    required this.hasLinkedIdentity,
  });

  /// Bo'sh snapshot — ota-ona ma'lumotlari mavjud bo'lmasa.
  const FamilySnapshot.empty()
      : guardianName = null,
        guardianPhone = null,
        guardianTelegramId = null,
        hasLinkedIdentity = false;

  /// Telegram bog'langanmi?
  bool get hasTelegramLinkage =>
      guardianTelegramId != null && guardianTelegramId!.isNotEmpty;

  bool get hasAny => guardianName != null || guardianPhone != null;

  @override
  List<Object?> get props => [
        guardianName,
        guardianPhone,
        guardianTelegramId,
        hasLinkedIdentity,
      ];
}
