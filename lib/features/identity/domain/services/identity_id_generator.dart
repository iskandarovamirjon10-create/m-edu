import '../value_objects/real_id.dart';

/// Real ID generatsiyasi uchun domain servis interfeysi.
///
/// Application qatlami qanday saqlanishini (Isar, fayl) bilmaydi — faqat
/// keyingi ketma-ket ID'ni so'raydi (spec §3 "Real ID raqami — ketma-ket
/// generatsiya qilinadi").
abstract class IdentityIdGenerator {
  Future<RealId> next();
}
