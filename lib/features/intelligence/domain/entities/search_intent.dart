import 'package:equatable/equatable.dart';

/// Qidiruv uchun entity turi.
enum SearchEntityType {
  student,
  teacher,
  group,
  payment,
  attendance,
  report,
  any,
}

/// Qidiruvdan kelib chiqqan amal turi (intent).
enum SearchActionType {
  /// Faqat ko'rish / navigatsiya.
  view,

  /// Yangi yozuv yaratish (qo'shish).
  create,

  /// Yozuvni belgilash (davomat, to'lov).
  record,

  /// Ko'rib chiqish / tekshirish.
  review,

  /// Eksport qilish.
  export,

  /// Sinxronlash / yangilash.
  sync,

  /// Aniqlanmagan — oddiy matn qidiruvi.
  none,
}

/// Qidiruv filtrlari (status asosida).
enum SearchFilter {
  /// To'lamaganlar.
  unpaid,

  /// Bugungi.
  today,

  /// Muddati o'tgan.
  overdue,

  /// Faollar.
  active,
}

/// Deterministik qidiruv intent'i — [SearchIntentParser] natijasi.
///
/// Foydalanuvchi so'rovini tuzilgan shaklga o'tkazadi:
/// `"Ali 9-B"` → student + group filter (`groupQuery: '9-B'`)
/// `"unpaid"` → payment + unpaid filter
/// `"today attendance"` → attendance + today filter
class SearchIntent extends Equatable {
  /// Asl (normalizatsiya qilingan) so'rov.
  final String rawQuery;

  /// Entity turi (student/group/payment/...).
  final SearchEntityType entityType;

  /// Amal turi.
  final SearchActionType actionType;

  /// Status filtrlari.
  final List<SearchFilter> filters;

  /// Nom qidiruvi uchun qolgan tokenlar.
  final String nameQuery;

  /// Guruh kodi/pattern (masalan "9-B", "9b").
  final String groupQuery;

  /// Intent bor-yo'qligi — sof matn qidiruvi yoki maqsadli so'rov.
  final bool hasIntent;

  const SearchIntent({
    required this.rawQuery,
    this.entityType = SearchEntityType.any,
    this.actionType = SearchActionType.none,
    this.filters = const [],
    this.nameQuery = '',
    this.groupQuery = '',
    this.hasIntent = false,
  });

  @override
  List<Object?> get props => [
        rawQuery,
        entityType,
        actionType,
        filters,
        nameQuery,
        groupQuery,
        hasIntent,
      ];
}
