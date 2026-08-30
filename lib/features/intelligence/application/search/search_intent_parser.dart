import '../../domain/entities/search_intent.dart';

/// Deterministik qidiruv intent parser'ı — LLM'siz.
///
/// Foydalanuvchi so'rovini tokenlarga ajratib, ma'lumot bazasidagi
/// entity/amal/filter kalitlariga moslashtiradi. Tartib muhim:
/// 1. Guruh pattern'ini aniqlash ("9-B", "9b", "9 b")
/// 2. Entity kalitlarini aniqlash (talaba, guruh, to'lov, davomat, hisobot)
/// 3. Amal kalitlarini aniqlash (qo'shish, belgilash, ko'rib chiqish, eksport)
/// 4. Filter kalitlarini aniqlash (to'lamagan, bugungi, muddati o'tgan)
/// 5. Qolgan tokenlar — nom qidiruvi.
class SearchIntentParser {
  /// Qidiruv kalitlari — (uz, ru, en).
  static const Map<SearchEntityType, List<String>> _entityKeywords = {
    SearchEntityType.student: ['talaba', 'oquvchi', "o'quvchi", 'student', 'ученик'],
    SearchEntityType.teacher: ['oqituvchi', "o'qituvchi", 'teacher', 'преподаватель'],
    SearchEntityType.group: ['guruh', 'group', 'класс', 'группа'],
    SearchEntityType.payment: ['tolov', "to'lov", 'payment', 'pay', 'платеж', 'оплата'],
    SearchEntityType.attendance: ['davomat', 'attendance', 'посещаемость'],
    SearchEntityType.report: ['hisobot', 'report', 'отчет', 'statistika', 'statistics'],
  };

  /// Amal kalitlari.
  static const Map<SearchActionType, List<String>> _actionKeywords = {
    SearchActionType.create: [
      'qoshish',
      "qo'shish",
      'add',
      'new',
      'yangi',
      'yaratish',
      'create',
      'добавить',
      'новый',
    ],
    SearchActionType.record: [
      'belgilash',
      'mark',
      'qayd',
      'record',
      'otmetit',
      'отметить',
      'kiritish',
      'enter',
    ],
    SearchActionType.review: [
      'korib',
      "ko'rib",
      'review',
      'tekshirish',
      'check',
      'просмотр',
    ],
    SearchActionType.export: ['eksport', 'export', 'chiqarish', 'скачать'],
    SearchActionType.sync: ['sinxron', 'sync', 'yangilash', 'update', 'обновить'],
  };

  /// Filter kalitlari.
  static const Map<SearchFilter, List<String>> _filterKeywords = {
    SearchFilter.unpaid: [
      'tolamagan',
      "to'lamagan",
      'unpaid',
      'qarzdor',
      'debt',
      'должник',
      'неоплачен',
    ],
    SearchFilter.today: ['bugun', 'today', 'сегодня'],
    SearchFilter.overdue: [
      'muddati',
      'kechikkan',
      'overdue',
      'просрочен',
    ],
    SearchFilter.active: ['faol', 'active', 'активн'],
  };

  /// Guruh pattern regex — "9-B", "9b", "9 B", "9-б".
  static final RegExp _groupPattern = RegExp(
    r'^\d{1,2}\s*[- ]\s*[a-zA-Zа-яА-ЯёЁ]{1,4}$',
  );
  static final RegExp _groupCodePattern = RegExp(
    r'\b(\d{1,2}[a-zA-Zа-яА-ЯёЁ]{1,3})\b',
  );

  /// So'rovni intent'ga aylantiradi. Deterministik — bir xil so'rov
  /// har doim bir xil intent beradi.
  SearchIntent parse(String rawQuery) {
    final normalized = rawQuery.trim().toLowerCase();
    if (normalized.isEmpty) {
      return const SearchIntent(
        rawQuery: '',
        entityType: SearchEntityType.any,
        hasIntent: false,
      );
    }

    // Tokenlar: har birining davomli alifbo/digit qismi (qidiruv uchun).
    final tokens = normalized.split(RegExp(r'\s+')).where((t) => t.isNotEmpty).toList();

    SearchEntityType entityType = SearchEntityType.any;
    SearchActionType actionType = SearchActionType.none;
    final filters = <SearchFilter>[];
    String groupQuery = '';
    final nameTokens = <String>[];

    for (final token in tokens) {
      // Guruh pattern: "9-B", "9b", "9-б"
      if (_groupPattern.hasMatch(token) || _groupCodePattern.hasMatch(token)) {
        if (groupQuery.isEmpty) groupQuery = token;
        continue;
      }

      // Entity kalitlari (birinchi topilgan ustun turadi).
      final entityHit = _matchKeyword<SearchEntityType>(token, _entityKeywords);
      if (entityHit != null) {
        if (entityType == SearchEntityType.any) entityType = entityHit;
        continue;
      }

      // Amal kalitlari.
      final actionHit = _matchKeyword<SearchActionType>(token, _actionKeywords);
      if (actionHit != null) {
        if (actionType == SearchActionType.none) actionType = actionHit;
        continue;
      }

      // Filter kalitlari.
      final filterHit = _matchKeyword<SearchFilter>(token, _filterKeywords);
      if (filterHit != null) {
        if (!filters.contains(filterHit)) filters.add(filterHit);
        continue;
      }

      // Qolgan tokenlar — nom qidiruvi.
      nameTokens.add(token);
    }

    // To'lov filtr'i (unpaid/overdue) berilgan bo'lsa, lekin entity
    // aniqlanmagan bo'lsa — payment entity deb hisoblaymiz (spec §5:
    // "unpaid" → payment status). Deterministik qoida.
    if (entityType == SearchEntityType.any &&
        (filters.contains(SearchFilter.unpaid) ||
            filters.contains(SearchFilter.overdue))) {
      entityType = SearchEntityType.payment;
    }

    final hasIntent =
        entityType != SearchEntityType.any ||
        actionType != SearchActionType.none ||
        filters.isNotEmpty ||
        groupQuery.isNotEmpty;

    return SearchIntent(
      rawQuery: normalized,
      entityType: entityType,
      actionType: actionType,
      filters: filters,
      nameQuery: nameTokens.join(' '),
      groupQuery: groupQuery,
      hasIntent: hasIntent,
    );
  }

  /// Token kalitlardan biriga mos keladimi (prefix moslik ham qabul qilinadi).
  T? _matchKeyword<T>(String token, Map<T, List<String>> map) {
    for (final entry in map.entries) {
      for (final keyword in entry.value) {
        // To'liq yoki prefix moslik: "davomat" ↔ "davomat", "to'lov" ↔ "tolov"
        if (token == keyword ||
            (token.length >= 3 && keyword.startsWith(token)) ||
            (keyword.length >= 3 && token.startsWith(keyword))) {
          return entry.key;
        }
      }
    }
    return null;
  }
}
