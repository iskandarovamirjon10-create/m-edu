import 'package:isar/isar.dart';

part 'device_info_record.g.dart';

/// Qurilma identifikatori — multi-device sync uchun.
///
/// Bir marta generatsiya qilinadi va Isar'da saqlanadi (qayta ishga
/// tushirishda o'zgarmaydi). Hech qanday shaxsiy ma'lumotni o'z ichiga
/// olmaydi — tasodifiy identifikator.
@collection
class DeviceInfoRecord {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: false)
  late String key;

  late String value;

  late DateTime createdAt;
}
