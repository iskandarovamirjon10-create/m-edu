import 'package:url_launcher/url_launcher.dart';

/// SMS yuborish xizmati.
///
/// Haqiqiy SMS shlyuz (gateway) hali ulanmagan — shuning uchun SMS
/// qurilmaning standart SMS ilovasi orqali yuboriladi (`sms:` intent).
/// `launchSms` matn va raqam bilan SMS ilovasini ochadi; foydalanuvchi
/// tasdiqlab yuboradi. Bu offline-first ilova uchun eng ishonchli yo'l
/// (internet/API talab qilinmaydi).
class SmsService {
  const SmsService();

  /// Qurilmaning SMS ilovasini oldindan to'ldirilgan xabar bilan ochadi.
  ///
  /// [phone] — qabul qiluvchi raqam (+998901234567 formatida).
  /// [message] — SMS matni.
  ///
  /// Qaytarilgan qiymat: SMS ilovasi muvaffaqiyatli ochilganmi.
  Future<bool> launchSms({
    required String phone,
    required String message,
  }) async {
    if (phone.isEmpty) return false;

    final uri = Uri(
      scheme: 'sms',
      path: phone,
      queryParameters: {'body': message},
    );
    try {
      return await launchUrl(uri);
    } catch (_) {
      return false;
    }
  }
}
