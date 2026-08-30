import 'package:equatable/equatable.dart';

import '../../../../core/security/permissions.dart';

/// Command kategoriyasi — palette'da guruhlash va kontekst relevance uchun.
enum CommandCategory {
  navigation,
  students,
  attendance,
  payments,
  reports,
  system,
  recent,
}

/// Bitta buyruq (command) ta'rifi.
///
/// Markaziy reyestr orqali ro'yxatdan o'tadi ([CommandRegistry]). UI'da
/// hardcode qilingan switch emas — har bir buyruq o'zi haqidagi barcha
/// ma'lumotni olib yuradi: sarlavha, izoh, ikonka (kalit), kategoriya,
/// kalit so'zlar, ruxsat, ustuvorlik, navigatsiya maqsadi.
class CommandAction extends Equatable {
  /// Yagona buyruq ID'si (masalan 'students.add').
  final String id;

  /// Asosiy sarlavha (masalan "Talaba qo'shish").
  final String title;

  /// Qisqa izoh (kategoriya yoki maqsad).
  final String subtitle;

  /// Ikonka kaliti — presentation qatlam IconData'ga moslashtiradi.
  /// Domain Flutter'dan mustaqil qolishi uchun string ishlatiladi.
  final String iconKey;

  /// Kategoriya.
  final CommandCategory category;

  /// Qidiruv kalit so'zlari (uz/en/ru).
  final List<String> keywords;

  /// Bajarish uchun talab qilinadigan permission. `null` — barcha
  /// autentifikatsiyalangan foydalanuvchilar ko'rishi mumkin.
  final AppPermission? requiredPermission;

  /// Baza ustuvorligi (0..10) — bir xil moslikdagi buyruqlar orasida
  /// tartibni belgilaydi (recent/frequency'dan oldin).
  final int basePriority;

  /// Navigatsiya maqsadi (masalan '/students/:id'). `null` bo'lsa —
  /// [handlerId] orqali bajariladi.
  final String? route;

  /// `true` — shell branch'iga go() (Moliya/Sozlamalar kabi), `false` — push.
  final bool isBranchGo;

  /// Handler ID — presentation qatlamdagi callback'lar ro'yxatiga havola
  /// (route bo'lmagan buyruqlar uchun, masalan "Sync now").
  final String? handlerId;

  /// Tarmoq talab qilinadimi (offline rejimda "Tarmoq talab qilinadi" badge).
  final bool requiresNetwork;

  /// Destructive amal — bajarishdan oldin tasdiqlash ko'rsatiladi.
  final bool destructive;

  const CommandAction({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.iconKey,
    required this.category,
    this.keywords = const [],
    this.requiredPermission,
    this.basePriority = 5,
    this.route,
    this.isBranchGo = false,
    this.handlerId,
    this.requiresNetwork = false,
    this.destructive = false,
  });

  @override
  List<Object?> get props => [
        id,
        title,
        subtitle,
        iconKey,
        category,
        keywords,
        requiredPermission,
        basePriority,
        route,
        isBranchGo,
        handlerId,
        requiresNetwork,
        destructive,
      ];
}
