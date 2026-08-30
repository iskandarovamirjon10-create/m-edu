import 'package:equatable/equatable.dart';

import '../../../crm/domain/entities/lead_activity.dart';

/// Student 360 — CRM snapshot.
///
/// Student'ga konvertatsiya qilingan lead ma'lumotlari. Lead
/// yaratilganidan keyin `IdentityRegisteredEvent` orqali student
/// yaratilganda, `Lead.convertedToIdentityId` shu student identity
/// ID'si bilan bog'lanadi.
///
/// MUHIM: agar student CRM orqali kelmagan bo'lsa (to'g'ridan-to'g'ri
/// ro'yxatdan o'tgan), snapshot bo'sh bo'ladi (`hasLead = false`).
class CrmSnapshot extends Equatable {
  /// Lead mavjudmi?
  final bool hasLead;

  /// Lead manbasi (Instagram, Telegram, referral, ...).
  final String? source;

  /// Lead capture (yaratilgan) sanasi.
  final DateTime? capturedAt;

  /// Konvertatsiya sanasi (lead → student aylanish).
  final DateTime? convertedAt;

  /// Lead uchun mas'ul moderator identityId.
  final String? responsibleModeratorId;

  /// Lead notes (agar mavjud bo'lsa).
  final String? notes;

  /// Lead score (0..100).
  final int score;

  /// Lead'dan kelib chiqqan barcha lead activity'lar.
  /// (Original Lead entity'dan keladi)
  final List<LeadActivity> leadActivities;

  const CrmSnapshot({
    required this.hasLead,
    required this.source,
    required this.capturedAt,
    required this.convertedAt,
    required this.responsibleModeratorId,
    required this.notes,
    required this.score,
    required this.leadActivities,
  });

  /// Lead mavjud bo'lmagan holat uchun.
  const CrmSnapshot.empty()
      : hasLead = false,
        source = null,
        capturedAt = null,
        convertedAt = null,
        responsibleModeratorId = null,
        notes = null,
        score = 0,
        leadActivities = const [];

  @override
  List<Object?> get props => [
        hasLead,
        source,
        capturedAt,
        convertedAt,
        responsibleModeratorId,
        notes,
        score,
        leadActivities,
      ];
}
