import '../../domain/services/identity_id_generator.dart';
import '../../domain/value_objects/real_id.dart';

/// `IdentityIdGenerator` interfeysining ULID asosidagi implementatsiyasi.
///
/// A2/E2 (multi-device): avvalgi versiya Isar'dagi qurilmaviy
/// `sequenceCounters` hisoblagichidan `M-EDU-{yil}-{000001}` generatsiya
/// qilardi — ikkinchi qurilma ham 1-dan boshlagani uchun sync'da ID
/// to'qnashardi (ikki shaxs bitta Firestore doc'ga yozilardi). Endi har
/// bir ID global yagona ULID — qurilmaviy holat (counter) talab
/// qilinmaydi, offline ham xavfsiz.
///
/// Eski ketma-ket ID'lar (mavjud yozuvlar) o'zgarmaydi — ular bir
/// qurilmada yagona bo'lgan va sync'da allaqachon qatnashgan.
class IdentitySequenceGenerator implements IdentityIdGenerator {
  IdentitySequenceGenerator();

  @override
  Future<RealId> next() async => RealId.generate();
}
