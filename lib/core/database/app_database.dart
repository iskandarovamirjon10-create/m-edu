import 'package:isar/isar.dart';
import 'package:path_provider/path_provider.dart';

/// Isar (offline-first lokal DB) uchun yagona ochish nuqtasi.
///
/// Core qatlami feature sxemalaridan bexabar — har bir feature o'z
/// `@collection` sxemalarini ro'yxat sifatida topshiradi.
class AppDatabase {
  final Isar instance;

  AppDatabase._(this.instance);

  static Future<AppDatabase> open({
    required List<CollectionSchema<dynamic>> schemas,
    String name = 'm_edu',
    String? directory,
  }) async {
    final dir = directory ?? (await getApplicationSupportDirectory()).path;
    final isar = await Isar.open(schemas, name: name, directory: dir);
    return AppDatabase._(isar);
  }

  /// Isar'ni yopadi. `Isar.close()` async — future'ni tashlab yubormaslik
  /// uchun bu ham async qilinadi (test/teardown'da ishonchli ishlaydi).
  Future<void> close() async {
    await instance.close();
  }
}
