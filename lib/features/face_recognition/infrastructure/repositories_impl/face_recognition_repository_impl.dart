import 'dart:typed_data';

import 'package:isar/isar.dart';

import '../../application/face_matcher.dart';
import '../models/face_record.dart';
import '../../domain/repositories/face_recognition_repository.dart';
import '../../domain/value_objects/face_signature.dart';
import '../datasources/isar_face_datasource.dart';
import '../services/face_encryption_service.dart';

/// [FaceRecognitionRepository] interfeysining Isar asosidagi implementatsiyasi.
///
/// H-03: Yuz imzosi Isar'da plaintext emas — [FaceEncryptionService]
/// (AES-256-GCM) bilan shifrlangan holda saqlanadi. Eski plaintext
/// yozuvlar birinchi o'qishda avtomatik shifrlanadi va tozalanadi.
class FaceRecognitionRepositoryImpl implements FaceRecognitionRepository {
  final IsarFaceDataSource _datasource;
  final FaceEncryptionService _encryption = FaceEncryptionService();

  FaceRecognitionRepositoryImpl(this._datasource);

  @override
  Future<void> saveFace({
    required String identityId,
    required FaceSignature signature,
    required int sampleCount,
  }) async {
    final existing = await _datasource.findByIdentityId(identityId);
    final now = DateTime.now();

    // Biometrik imzoni shifrlab saqlaymiz — Isar'da plaintext qolmaydi.
    final encrypted = await _encryption.encrypt(signature.vector);

    await _datasource.put(
      FaceRecord()
        ..id = existing?.id ?? Isar.autoIncrement
        ..identityId = identityId
        // Legacy maydon bo'sh qoldiriladi — endi faqat shifrlangan holat.
        ..signature = const []
        ..encryptedSignature = encrypted
        ..sampleCount = sampleCount
        ..source = signature.source
        ..createdAt = existing?.createdAt ?? now
        ..updatedAt = now,
    );
  }

  @override
  Future<EnrolledFace?> findFaceByIdentityId(String identityId) async {
    final record = await _datasource.findByIdentityId(identityId);
    if (record == null) return null;

    final vector = await _decryptVector(record);
    if (vector == null) return null;
    return EnrolledFace(
      identityId: record.identityId,
      signature: FaceSignature(vector: vector, source: record.source),
    );
  }

  @override
  Future<List<EnrolledFace>> findAllFaces() async {
    final records = await _datasource.findAll();
    final result = <EnrolledFace>[];
    for (final r in records) {
      final vector = await _decryptVector(r);
      if (vector == null) continue;
      result.add(
        EnrolledFace(
          identityId: r.identityId,
          signature: FaceSignature(vector: vector, source: r.source),
        ),
      );
    }
    return result;
  }

  @override
  Future<void> deleteFace(String identityId) {
    return _datasource.deleteByIdentityId(identityId);
  }

  @override
  Future<bool> hasFace(String identityId) {
    return _datasource.hasFace(identityId);
  }

  @override
  Future<int> repointIdentityReferences(
    String fromIdentityId,
    String toIdentityId,
  ) =>
      _datasource.repointIdentityReferences(fromIdentityId, toIdentityId);

  /// Yozuvdan asl imzo vektorini oladi: shifrlangan bo'lsa decrypt,
  /// eski plaintext qolgan bo'lsa — bir marta shifrlab, Isar'ni tozalaydi.
  Future<List<double>?> _decryptVector(FaceRecord record) async {
    // Yangi format: shifrlangan imzo.
    if (record.encryptedSignature != null &&
        record.encryptedSignature!.isNotEmpty) {
      return _encryption.decrypt(
        Uint8List.fromList(record.encryptedSignature!),
      );
    }

    // Legacy: plaintext signature (H-03 dan oldingi yozuv).
    if (record.signature.isNotEmpty) {
      final vector = record.signature;
      try {
        final encrypted = await _encryption.encrypt(vector);
        await _datasource.put(record
          ..signature = const []
          ..encryptedSignature = encrypted);
      } catch (_) {
        // Migratsiya muvaffaqiyatsiz bo'lsa ham eski qiymatni qaytaramiz.
      }
      return vector;
    }
    return null;
  }
}
