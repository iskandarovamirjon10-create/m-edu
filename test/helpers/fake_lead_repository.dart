import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/features/crm/domain/entities/lead.dart';
import 'package:m_edu/features/crm/domain/entities/lead_activity.dart';
import 'package:m_edu/features/crm/domain/repositories/lead_repository.dart';
import 'package:m_edu/features/crm/domain/services/lead_id_generator.dart';

/// Testlar uchun soxta Lead repository (Isar'siz).
class FakeLeadRepository implements LeadRepository {
  final List<Lead> saved = [];
  final List<LeadActivity> activities = [];

  @override
  Future<Lead> save(Lead lead) async {
    final exists = saved.any((l) => l.leadId == lead.leadId);
    if (exists) throw const ValidationFailure('Bu lead ID allaqachon mavjud');
    saved.add(lead);
    return lead;
  }

  @override
  Future<Lead> update(Lead lead) async {
    final index = saved.indexWhere((l) => l.leadId == lead.leadId);
    if (index == -1) throw const NotFoundFailure('Lead topilmadi');
    saved[index] = lead;
    return lead;
  }

  @override
  Future<void> recordActivity(LeadActivity activity) async {
    activities.add(activity);
  }

  @override
  Future<Lead?> fetchByLeadId(String leadId) async {
    for (final lead in saved) {
      if (lead.leadId == leadId) return lead;
    }
    return null;
  }

  @override
  Future<List<Lead>> fetchAll() async => List.of(saved);

  @override
  Future<List<Lead>> fetchByStage(LeadStage stage) async =>
      saved.where((l) => l.stage == stage).toList();

  @override
  Future<List<Lead>> fetchByAssignedUser(String userId) async =>
      saved.where((l) => l.assignedToUserId == userId).toList();

  @override
  Future<List<Lead>> searchByNameOrPhone(String query) async {
    final q = query.trim().toLowerCase();
    return saved
        .where((l) =>
            l.fullName.toLowerCase().contains(q) ||
            (l.phone ?? '').contains(q))
        .toList();
  }

  @override
  Future<List<LeadActivity>> fetchActivities(String leadId) async =>
      activities.where((a) => a.leadId == leadId).toList();

  @override
  Future<int> countByStage(LeadStage stage) async =>
      saved.where((l) => l.stage == stage).length;

  @override
  Future<Lead?> fetchByConvertedIdentityId(String identityId) async {
    for (final lead in saved) {
      if (lead.convertedToIdentityId == identityId) {
        return lead;
      }
    }
    return null;
  }
}

/// Testlar uchun soxta lead ID generator — ketma-ket `LEAD-2026-000001`.
class FakeLeadIdGenerator implements LeadIdGenerator {
  int _counter = 0;
  final int startYear;
  final int startFrom;

  /// [startFrom] — oldindan saqlangan yozuvlar bo'lsa shundan keyin
  /// generatsiya qiladi (ID to'qnashuvini oldini olish uchun).
  FakeLeadIdGenerator({this.startYear = 2026, this.startFrom = 0});

  @override
  Future<String> next() async {
    _counter += 1;
    return 'LEAD-$startYear-${(_counter + startFrom).toString().padLeft(6, '0')}';
  }
}
