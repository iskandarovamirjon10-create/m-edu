import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/crm/domain/entities/lead.dart';
import 'package:m_edu/features/crm/domain/entities/lead_activity.dart';
import 'package:m_edu/features/crm/domain/repositories/lead_repository.dart';
import 'package:m_edu/features/crm/application/services/sales_funnel_analytics.dart';

class _FakeLeadRepository implements LeadRepository {
  final List<Lead> _leads = [];

  void addLead(Lead lead) => _leads.add(lead);

  @override
  Future<Lead> save(Lead lead) async {
    _leads.add(lead);
    return lead;
  }

  @override
  Future<Lead> update(Lead lead) async => lead;

  @override
  Future<void> recordActivity(LeadActivity activity) async {}

  @override
  Future<Lead?> fetchByLeadId(String leadId) async =>
      _leads.where((l) => l.leadId == leadId).firstOrNull;

  @override
  Future<List<Lead>> fetchAll() async => _leads;

  @override
  Future<List<Lead>> fetchByStage(LeadStage stage) async =>
      _leads.where((l) => l.stage == stage).toList();

  @override
  Future<List<Lead>> fetchByAssignedUser(String userId) async =>
      _leads.where((l) => l.assignedToUserId == userId).toList();

  @override
  Future<List<Lead>> searchByNameOrPhone(String query) async => [];

  @override
  Future<List<LeadActivity>> fetchActivities(String leadId) async => [];

  @override
  Future<int> countByStage(LeadStage stage) async =>
      _leads.where((l) => l.stage == stage).length;

  @override
  Future<Lead?> fetchByConvertedIdentityId(String identityId) async => null;
}

void main() {
  late _FakeLeadRepository repo;
  late SalesFunnelAnalytics analytics;

  setUp(() {
    repo = _FakeLeadRepository();
    analytics = SalesFunnelAnalytics(repo);

    // Add test leads with different stages
    final now = DateTime.now();
    for (var i = 0; i < 5; i++) {
      repo.addLead(Lead(
        leadId: 'LEAD-NEW-$i',
        fullName: 'New Lead $i',
        source: LeadSource.instagram,
        stage: LeadStage.newLead,
        createdAt: now,
      ));
    }
    for (var i = 0; i < 3; i++) {
      repo.addLead(Lead(
        leadId: 'LEAD-CONTACTED-$i',
        fullName: 'Contacted Lead $i',
        source: LeadSource.telegram,
        stage: LeadStage.contacted,
        createdAt: now,
      ));
    }
    for (var i = 0; i < 2; i++) {
      repo.addLead(Lead(
        leadId: 'LEAD-TRIAL-$i',
        fullName: 'Trial Lead $i',
        source: LeadSource.referral,
        stage: LeadStage.trialScheduled,
        createdAt: now,
      ));
    }
    repo.addLead(Lead(
      leadId: 'LEAD-CONVERTED-1',
      fullName: 'Converted Lead',
      source: LeadSource.walkIn,
      stage: LeadStage.converted,
      createdAt: now,
    ));
    repo.addLead(Lead(
      leadId: 'LEAD-LOST-1',
      fullName: 'Lost Lead',
      source: LeadSource.other,
      stage: LeadStage.lost,
      createdAt: now,
    ));
  });

  group('SalesFunnelAnalytics', () {
    test('countByStage returns correct counts', () async {
      final counts = await analytics.countByStage();
      expect(counts[LeadStage.newLead], 5);
      expect(counts[LeadStage.contacted], 3);
      expect(counts[LeadStage.trialScheduled], 2);
      expect(counts[LeadStage.converted], 1);
      expect(counts[LeadStage.lost], 1);
    });

    test('overallConversionRate calculates correctly', () async {
      // 1 converted out of 12 total
      final rate = await analytics.overallConversionRate();
      expect(rate, closeTo(8.33, 0.1));
    });

    test('lostRate calculates correctly', () async {
      // 1 lost out of 12 total
      final rate = await analytics.lostRate();
      expect(rate, closeTo(8.33, 0.1));
    });

    test('funnelData returns all stages', () async {
      final data = await analytics.funnelData();
      expect(data.length, LeadStage.values.length);
      expect(data.first.stage, LeadStage.newLead);
      expect(data.first.count, 5);
    });

    test('overallConversionRate returns 0 for empty data', () async {
      final emptyRepo = _FakeLeadRepository();
      final emptyAnalytics = SalesFunnelAnalytics(emptyRepo);
      final rate = await emptyAnalytics.overallConversionRate();
      expect(rate, 0.0);
    });

    test('lostRate returns 0 for empty data', () async {
      final emptyRepo = _FakeLeadRepository();
      final emptyAnalytics = SalesFunnelAnalytics(emptyRepo);
      final rate = await emptyAnalytics.lostRate();
      expect(rate, 0.0);
    });

    test('funnelData percentages sum to ~100%', () async {
      final data = await analytics.funnelData();
      final totalPercentage =
          data.fold(0.0, (sum, d) => sum + d.percentage);
      expect(totalPercentage, closeTo(100, 1));
    });
  });
}
