import '../../../../core/error/failures.dart';
import '../../domain/entities/lead.dart';
import '../../domain/entities/lead_activity.dart';
import '../../domain/repositories/lead_repository.dart';
import '../datasources/isar_lead_datasource.dart';
import '../models/lead_activity_record.dart';
import '../models/lead_record.dart';

/// `LeadRepository` interfeysining Isar asosidagi implementatsiyasi.
class LeadRepositoryImpl implements LeadRepository {
  final IsarLeadDataSource _datasource;

  LeadRepositoryImpl(this._datasource);

  @override
  Future<Lead> save(Lead lead) async {
    // Fake repo xatti bilan bir xil: dublikat leadId — xato.
    final existing = await _datasource.findById(lead.leadId);
    if (existing != null) {
      throw const ValidationFailure('Bu lead ID allaqachon mavjud');
    }
    final saved = await _datasource.insert(_toRecord(lead));
    return _toEntity(saved);
  }

  @override
  Future<Lead> update(Lead lead) async {
    final saved = await _datasource.update(_toRecord(lead));
    return _toEntity(saved);
  }

  @override
  Future<void> recordActivity(LeadActivity activity) async {
    await _datasource.insertActivity(_toActivityRecord(activity));
  }

  @override
  Future<Lead?> fetchByLeadId(String leadId) async {
    final record = await _datasource.findById(leadId);
    return record == null ? null : _toEntity(record);
  }

  @override
  Future<List<Lead>> fetchAll() async {
    final records = await _datasource.findAll();
    return records.map(_toEntity).toList();
  }

  @override
  Future<List<Lead>> fetchByStage(LeadStage stage) async {
    final records = await _datasource.findByStage(stage.name);
    return records.map(_toEntity).toList();
  }

  @override
  Future<List<Lead>> fetchByAssignedUser(String userId) async {
    final records = await _datasource.findByAssignedUser(userId);
    return records.map(_toEntity).toList();
  }

  @override
  Future<List<Lead>> searchByNameOrPhone(String query) async {
    final records = await _datasource.searchByNameOrPhone(query);
    return records.map(_toEntity).toList();
  }

  @override
  Future<List<LeadActivity>> fetchActivities(String leadId) async {
    final records = await _datasource.findActivities(leadId);
    return records.map(_toActivity).toList();
  }

  @override
  Future<int> countByStage(LeadStage stage) {
    return _datasource.countByStage(stage.name);
  }

  @override
  Future<Lead?> fetchByConvertedIdentityId(String identityId) async {
    final record = await _datasource.findByConvertedIdentityId(identityId);
    return record == null ? null : _toEntity(record);
  }

  // ─── Mapping ──────────────────────────────────────────────────────────

  LeadRecord _toRecord(Lead lead) {
    return LeadRecord()
      ..leadId = lead.leadId
      ..fullName = lead.fullName
      ..phone = lead.phone
      ..email = lead.email
      ..source = lead.source.name
      ..stage = lead.stage.name
      ..score = lead.score
      ..assignedToUserId = lead.assignedToUserId
      ..referredByIdentityId = lead.referredByIdentityId
      ..lostReason = lead.lostReason
      ..convertedToIdentityId = lead.convertedToIdentityId
      ..notes = lead.notes
      ..lastContactedAt = lead.lastContactedAt
      ..nextFollowUpAt = lead.nextFollowUpAt
      ..createdAt = lead.createdAt
      ..updatedAt = lead.updatedAt
      ..syncVersion = lead.syncVersion
      ..pendingSync = lead.pendingSync;
  }

  Lead _toEntity(LeadRecord record) {
    return Lead(
      leadId: record.leadId,
      fullName: record.fullName,
      phone: record.phone,
      email: record.email,
      source: _sourceOf(record.source),
      stage: _stageOf(record.stage),
      score: record.score,
      assignedToUserId: record.assignedToUserId,
      referredByIdentityId: record.referredByIdentityId,
      lostReason: record.lostReason,
      convertedToIdentityId: record.convertedToIdentityId,
      notes: record.notes,
      lastContactedAt: record.lastContactedAt,
      nextFollowUpAt: record.nextFollowUpAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      syncVersion: record.syncVersion,
      pendingSync: record.pendingSync,
    );
  }

  LeadActivityRecord _toActivityRecord(LeadActivity activity) {
    return LeadActivityRecord()
      ..leadId = activity.leadId
      ..type = activity.type
      ..description = activity.description
      ..occurredAt = activity.occurredAt
      ..authoredByUserId = activity.authoredByUserId
      ..authoredByName = activity.authoredByName
      ..metadata = activity.metadata != null
          ? '${activity.metadata}'
          : null;
  }

  LeadActivity _toActivity(LeadActivityRecord record) {
    return LeadActivity(
      leadId: record.leadId,
      type: record.type,
      description: record.description,
      occurredAt: record.occurredAt,
      authoredByUserId: record.authoredByUserId,
      authoredByName: record.authoredByName,
    );
  }

  static LeadSource _sourceOf(String value) {
    for (final source in LeadSource.values) {
      if (source.name == value) return source;
    }
    return LeadSource.other;
  }

  static LeadStage _stageOf(String value) {
    for (final stage in LeadStage.values) {
      if (stage.name == value) return stage;
    }
    return LeadStage.newLead;
  }
}
