import 'dart:math';

import 'package:isar/isar.dart';

import 'infrastructure/models/device_info_record.dart';

/// Qurilma uchun barqaror identifikator.
///
/// Birinchi ishga tushirishda tasodifiy ID generatsiya qilinadi va Isar'da
/// saqlanadi — qayta ishga tushirish, yangilanishlarda o'zgarmaydi.
/// Sync operatsiyalari [deviceId] sifatida shu qiymatni ishlatadi
/// (qaysi qurilma yozganini aniqlash, conflict tahlili uchun).
class DeviceIdentity {
  static const _key = 'device_id';

  final Isar _db;

  DeviceIdentity(this._db);

  Future<String> getDeviceId() async {
    final record = await _db.deviceInfoRecords
        .filter()
        .keyEqualTo(_key)
        .findFirst();
    if (record != null) return record.value;

    final generated = _generate();
    await _db.writeTxn(() async {
      await _db.deviceInfoRecords.put(
        DeviceInfoRecord()
          ..key = _key
          ..value = generated
          ..createdAt = DateTime.now(),
      );
    });
    return generated;
  }

  /// 16 baytlik tasodifiy hex identifikator — shaxsiy ma'lumot yo'q.
  static String _generate() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }
}
