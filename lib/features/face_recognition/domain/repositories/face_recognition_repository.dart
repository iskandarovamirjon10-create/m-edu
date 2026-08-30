import '../value_objects/face_signature.dart';
import '../../application/face_matcher.dart';

/// Yuz bazasi (enrollment) uchun repository interfeysi.
abstract class FaceRecognitionRepository {
  /// Identity uchun yuz imzosini saqlaydi (mavjud bo'lsa yangilaydi).
  Future<void> saveFace({
    required String identityId,
    required FaceSignature signature,
    required int sampleCount,
  });

  /// Identity'ning yuz imzosini qaytaradi (yo'q bo'lsa — null).
  Future<EnrolledFace?> findFaceByIdentityId(String identityId);

  /// Barcha ro'yxatga olingan yuzlar.
  Future<List<EnrolledFace>> findAllFaces();

  /// Identity'ning yuz bazasini o'chiradi.
  Future<void> deleteFace(String identityId);

  /// Identity'ning yuzi bor yoki yo'qligi.
  Future<bool> hasFace(String identityId);

  /// Identity merge (P0-01): duplicate yuz bazasini survivor'ga ko'chiradi.
  /// Survivor'da yuz bor bo'lsa — duplicate'niki o'chiriladi (biometrik
  /// ma'lumotda noaniqlik qoldirilmaydi).
  /// Qaytarilgan qiymat: 1 yoki 0 (ko'chirilgan/ishlangan yozuvlar soni).
  Future<int> repointIdentityReferences(
    String fromIdentityId,
    String toIdentityId,
  );
}
