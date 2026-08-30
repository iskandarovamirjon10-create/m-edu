import '../../../../core/error/failures.dart';
import '../../../../core/extensions/enum_x.dart';
import '../../domain/entities/identity.dart';
import '../../domain/entities/identity_activity.dart';
import '../../domain/repositories/identity_repository.dart';
import '../datasources/isar_identity_datasource.dart';
import '../models/identity_activity_record.dart';
import '../models/identity_record.dart';

/// `IdentityRepository` interfeysining Isar asosidagi implementatsiyasi.
///
/// Domain entity ↔ Isar record mapping'i shu yerda amalga oshiriladi.
class IdentityRepositoryImpl implements IdentityRepository {
  final IsarIdentityDataSource _datasource;

  IdentityRepositoryImpl(this._datasource);

  @override
  Future<Identity> save(Identity identity) async {
    // Takroriy identityId holatini datasource o'zi aniqlaydi.
    final saved = await _datasource.insert(_toRecord(identity));
    // Yangi yozilgan record har doim valid (fresh write — `!` xavfsiz).
    return _toEntity(saved)!;
  }

  @override
  Future<Identity> updateStatus(
    String identityId,
    IdentityStatus newStatus,
  ) async {
    final existing = await _datasource.findByIdentityId(identityId);
    if (existing == null) {
      throw NotFoundFailure('Identity topilmadi: $identityId');
    }
    existing.status = newStatus.name;
    existing.updatedAt = DateTime.now();
    existing.syncVersion += 1;
    existing.pendingSync = true;

    final updated = await _datasource.update(existing);
    return _toEntity(updated)!;
  }

  @override
  Future<void> recordActivity(IdentityActivity activity) {
    return _datasource.recordActivity(
      IdentityActivityRecord()
        ..identityId = activity.identityId
        ..type = activity.type
        ..description = activity.description
        ..occurredAt = activity.occurredAt,
    );
  }

  @override
  Future<Identity> update(Identity identity) async {
    final updated = await _datasource.update(_toRecord(identity));
    return _toEntity(updated)!;
  }

  @override
  Future<int> repointActivities(
    String fromIdentityId,
    String toIdentityId,
  ) {
    return _datasource.repointActivities(fromIdentityId, toIdentityId);
  }

  @override
  Future<void> deleteByIdentityId(String identityId) =>
      _datasource.deleteByIdentityId(identityId);

  @override
  Future<Identity?> fetchByIdentityId(String identityId) async {
    final record = await _datasource.findByIdentityId(identityId);
    // Corrupt yozuv → null (UI "Topilmadi" holatini ko'rsatadi, crash yo'q).
    return record == null ? null : _toEntity(record);
  }

  @override
  Future<Identity?> fetchByPhone(String normalizedPhone) async {
    final record = await _datasource.findByPhone(normalizedPhone);
    return record == null ? null : _toEntity(record);
  }

  @override
  Future<List<Identity>> fetchAll() async {
    final records = await _datasource.findAll();
    // Corrupt yozuvlar o'tkazib yuboriladi (spec §7) — ro'yxat hech
    // qachon noto'g'ri rol/status bilan ko'rinmaydi.
    return records.map(_toEntity).whereType<Identity>().toList();
  }

  @override
  Future<List<Identity>> fetchByIds(List<String> identityIds) async {
    final records = await _datasource.findByIds(identityIds);
    return records.map(_toEntity).whereType<Identity>().toList();
  }

  @override
  Future<List<Identity>> fetchByRole(IdentityRole role) async {
    final records = await _datasource.findByRole(role.name);
    return records.map(_toEntity).whereType<Identity>().toList();
  }

  @override
  Future<List<Identity>> fetchByStatus(IdentityStatus status) async {
    final records = await _datasource.findByStatus(status.name);
    return records.map(_toEntity).whereType<Identity>().toList();
  }

  @override
  Future<List<IdentityActivity>> fetchActivities(String identityId) async {
    final records = await _datasource.findActivities(identityId);
    return records
        .map(
          (r) => IdentityActivity(
            identityId: r.identityId,
            type: r.type,
            description: r.description,
            occurredAt: r.occurredAt,
          ),
        )
        .toList();
  }

  IdentityRecord _toRecord(Identity identity) {
    return IdentityRecord()
      ..identityId = identity.identityId
      ..firstName = identity.firstName
      ..lastName = identity.lastName
      ..middleName = identity.middleName
      ..role = identity.role.name
      ..status = identity.status.name
      ..phone = identity.phone
      ..email = identity.email
      ..photoPath = identity.photoPath
      ..qrSeed = identity.qrSeed
      ..createdAt = identity.createdAt
      ..updatedAt = identity.updatedAt
      ..syncVersion = identity.syncVersion
      ..pendingSync = identity.pendingSync;
  }

  /// [Identity]'ga xavfsiz o'giradi. Rol/status nomuvofiq bo'lsa `null`
  /// (corrupt yozuv o'tkazib yuboriladi — crash YO'Q, spec §7, §17).
  /// Noto'g'ri rol talabani o'qituvchi deb ko'rsatmaydi.
  Identity? _toEntity(IdentityRecord record) {
    final role = tryEnumByName(IdentityRole.values, record.role);
    final status = tryEnumByName(IdentityStatus.values, record.status);
    if (role == null || status == null) return null;
    return Identity(
      identityId: record.identityId,
      firstName: record.firstName,
      lastName: record.lastName,
      middleName: record.middleName,
      role: role,
      status: status,
      phone: record.phone,
      email: record.email,
      photoPath: record.photoPath,
      qrSeed: record.qrSeed,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      syncVersion: record.syncVersion,
      pendingSync: record.pendingSync,
    );
  }
}
