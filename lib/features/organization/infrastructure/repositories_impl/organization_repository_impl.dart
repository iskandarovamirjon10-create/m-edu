import '../../domain/entities/organization.dart';
import '../../domain/repositories/organization_repository.dart';
import '../datasources/isar_organization_datasource.dart';
import '../models/organization_record.dart';

class OrganizationRepositoryImpl implements OrganizationRepository {
  final IsarOrganizationDataSource _datasource;

  OrganizationRepositoryImpl(this._datasource);

  @override
  Future<Organization> save(Organization organization) async {
    final saved = await _datasource.save(_toRecord(organization));
    return _toEntity(saved);
  }

  @override
  Future<Organization?> fetchCurrent() async {
    final record = await _datasource.fetchCurrent();
    return record == null ? null : _toEntity(record);
  }

  OrganizationRecord _toRecord(Organization organization) {
    return OrganizationRecord()
      ..organizationName = organization.organizationName
      ..branchName = organization.branchName
      ..roomName = organization.roomName
      ..courseName = organization.courseName
      ..createdAt = organization.createdAt
      ..syncVersion = organization.syncVersion
      ..pendingSync = organization.pendingSync;
  }

  Organization _toEntity(OrganizationRecord record) {
    return Organization(
      organizationName: record.organizationName,
      branchName: record.branchName,
      roomName: record.roomName,
      courseName: record.courseName,
      createdAt: record.createdAt,
      syncVersion: record.syncVersion,
      pendingSync: record.pendingSync,
    );
  }
}
