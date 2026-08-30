import '../../domain/entities/search_intent.dart';
import '../../domain/entities/command.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../groups/domain/entities/group.dart';
import '../../../payments/domain/entities/payment.dart';

/// Bitta qidiruv natijasi — entity, amal yoki navigatsiya.
class IntentSearchResult {
  /// Natija turi.
  final SearchResultType type;

  /// Sarlavha (masalan "Ali Valiyev").
  final String title;

  /// Izoh (masalan "Talaba • 9-B").
  final String subtitle;

  /// Ikonka kaliti.
  final String iconKey;

  /// Marshrut (ko'rsatiladigan natija uchun).
  final String route;

  /// Shell branch'iga go() kerakmi.
  final bool isBranchGo;

  /// Qidiruv balli (reytinq uchun).
  final double score;

  const IntentSearchResult({
    required this.type,
    required this.title,
    required this.subtitle,
    required this.iconKey,
    required this.route,
    required this.score,
    this.isBranchGo = false,
  });
}

enum SearchResultType { entity, action, navigation }

/// Intent-ga asoslangan qidiruv xizmati.
///
/// Natijalar uch xil bo'ladi:
/// 1. ENTITY — talaba/guruh/to'lov yozuvlari ("Ali" → talaba).
/// 2. ACTION — intent'dan kelgan amallar ("unpaid" → to'lovni qayd etish).
/// 3. NAVIGATION — buyruq reyestridan kelgan navigatsiya.
///
/// [SearchIntent] ishlatiladi — LLM'siz, deterministik.
class IntentSearchService {
  /// Entity qidiruvi — talabalar va guruhlar.
  ///
  /// [nameQuery] — nom/familya mosligi, [groupQuery] — guruh kodi/ismi.
  List<IntentSearchResult> searchEntities({
    required SearchIntent intent,
    required List<Identity> identities,
    required List<Group> groups,
    List<Payment> payments = const [],
  }) {
    final results = <IntentSearchResult>[];
    final nameQuery = intent.nameQuery.toLowerCase();
    final groupQuery = intent.groupQuery.toLowerCase();

    // Bo'sh so'rov + aniq entity intent yo'q → butun bazani skan qilmaymiz
    // (performance spec §43: butun ma'lumot bazasini prefetch qilish yomon).
    if (nameQuery.isEmpty &&
        groupQuery.isEmpty &&
        intent.entityType == SearchEntityType.any) {
      return const [];
    }

    // Guruh qidiruvi: guruh nomi yoki kodi bo'yicha.
    final isGroupSearch = intent.entityType == SearchEntityType.group ||
        groupQuery.isNotEmpty;
    if (isGroupSearch) {
      for (final group in groups) {
        final name = group.name.toLowerCase();
        final code = (group.code ?? '').toLowerCase();
        final matches = nameQuery.isEmpty ||
            name.contains(nameQuery) ||
            code.contains(nameQuery);
        if (!matches) continue;
        if (groupQuery.isNotEmpty &&
            !name.contains(groupQuery) &&
            !code.contains(groupQuery)) {
          continue;
        }
        results.add(IntentSearchResult(
          type: SearchResultType.entity,
          title: group.name,
          subtitle: 'Guruh • ${group.currentSize}/${group.capacity} talaba',
          iconKey: 'group',
          route: '/groups/${group.groupId}',
          score: _entityScore(nameQuery.isNotEmpty ? nameQuery : groupQuery, name),
        ));
      }
    }

    // Talaba/o'qituvchi qidiruvi.
    final isPersonSearch = intent.entityType == SearchEntityType.student ||
        intent.entityType == SearchEntityType.teacher ||
        intent.entityType == SearchEntityType.any;
    if (isPersonSearch) {
      for (final identity in identities) {
        final fullName = identity.fullName.toLowerCase();
        if (nameQuery.isNotEmpty && !fullName.contains(nameQuery)) continue;

        // Guruh filtri: identity guruhda ekani student ma'lumotidan
        // aniqlanmaydi (Identity'da groupId yo'q) — guruh kodi bo'yicha
        // faqat guruh natijalarida qidiriladi. Person natijalarida
        // guruhQuery faqat non-empty bo'lsa ham qidiriladi (subtitle).
        results.add(IntentSearchResult(
          type: SearchResultType.entity,
          title: identity.fullName,
          subtitle: _personSubtitle(identity, groupQuery),
          iconKey: switch (identity.role) {
            IdentityRole.student => 'student',
            IdentityRole.teacher => 'teacher',
            _ => 'person',
          },
          route: '/identity/${identity.identityId}',
          score: _entityScore(nameQuery, fullName),
        ));
      }
    }

    // To'lov qidiruvi (filter unpaid bo'lsa ustun).
    final isPaymentSearch = intent.entityType == SearchEntityType.payment ||
        intent.filters.contains(SearchFilter.unpaid) ||
        intent.filters.contains(SearchFilter.overdue);
    if (isPaymentSearch) {
      for (final payment in payments) {
        final name = (payment.studentName ?? payment.studentIdentityId)
            .toLowerCase();
        if (nameQuery.isNotEmpty && !name.contains(nameQuery)) continue;
        results.add(IntentSearchResult(
          type: SearchResultType.entity,
          title: payment.studentName ?? payment.studentIdentityId,
          subtitle: 'To\'lov • ${payment.amount} so\'m • '
              '${payment.status.name}',
          iconKey: 'payment',
          route: '/finance',
          score: _entityScore(nameQuery, name),
        ));
      }
    }

    // Deterministik tartib: score pasayish, keyin sarlavha.
    results.sort((a, b) {
      final byScore = b.score.compareTo(a.score);
      if (byScore != 0) return byScore;
      return a.title.compareTo(b.title);
    });
    return results;
  }

  /// Intent'dan keladigan ACTION natijalari.
  ///
  /// "unpaid" → "To'lovni qayd etish" amali; "today attendance" →
  /// "Davomatni belgilash" amali; "reports" → "Hisobotlar" navigatsiyasi.
  List<IntentSearchResult> searchActions(SearchIntent intent) {
    final results = <IntentSearchResult>[];

    if (intent.filters.contains(SearchFilter.unpaid)) {
      results.add(const IntentSearchResult(
        type: SearchResultType.action,
        title: 'To\'lovni qayd etish',
        subtitle: 'Qarzdor/to\'lamagan talabalar uchun to\'lov qabul qilish',
        iconKey: 'payment',
        route: '/payments/new',
        score: 90,
      ));
      results.add(const IntentSearchResult(
        type: SearchResultType.action,
        title: 'Qarzdorlar ro\'yxati',
        subtitle: 'Muddati o\'tgan va ochiq qarzdorliklar',
        iconKey: 'debt',
        route: '/payments/debts',
        score: 80,
      ));
    }

    if (intent.entityType == SearchEntityType.attendance ||
        intent.filters.contains(SearchFilter.today) ||
        intent.actionType == SearchActionType.record ||
        intent.actionType == SearchActionType.review) {
      results.add(const IntentSearchResult(
        type: SearchResultType.action,
        title: 'Davomatni belgilash',
        subtitle: 'Bugungi dars davomatini belgilash',
        iconKey: 'attendance',
        route: '/attendance',
        score: 85,
      ));
    }

    if (intent.entityType == SearchEntityType.report) {
      results.add(const IntentSearchResult(
        type: SearchResultType.navigation,
        title: 'Hisobotlar markazi',
        subtitle: 'Davomat, moliya va qarzdorlik hisobotlari',
        iconKey: 'report',
        route: '/reports',
        score: 85,
        isBranchGo: true,
      ));
    }

    if (intent.actionType == SearchActionType.create &&
        (intent.entityType == SearchEntityType.student ||
            intent.entityType == SearchEntityType.any)) {
      results.add(const IntentSearchResult(
        type: SearchResultType.action,
        title: 'Talaba qo\'shish',
        subtitle: 'Yangi o\'quvchini ro\'yxatga olish',
        iconKey: 'add',
        route: '/identity/register',
        score: 88,
      ));
    }

    if (intent.actionType == SearchActionType.export) {
      results.add(const IntentSearchResult(
        type: SearchResultType.action,
        title: 'Hisobotlarni eksport qilish',
        subtitle: 'Davomat/moliya hisobotini eksport qilish',
        iconKey: 'export',
        route: '/reports',
        score: 70,
        isBranchGo: true,
      ));
    }

    if (intent.actionType == SearchActionType.sync) {
      results.add(const IntentSearchResult(
        type: SearchResultType.action,
        title: 'Sinxronlashni boshlash',
        subtitle: 'Navbatdagi yozuvlarni cloud\'ga yuborish',
        iconKey: 'sync',
        route: '/settings',
        score: 72,
        isBranchGo: true,
      ));
    }

    return results;
  }

  /// [intent] + buyruqlarni birlashtirib bitta natijalar ro'yxati beradi.
  List<IntentSearchResult> combine({
    required SearchIntent intent,
    required List<IntentSearchResult> entities,
    required List<IntentSearchResult> actions,
    required List<RankedCommandResult> commands,
  }) {
    final results = <IntentSearchResult>[
      ...actions,
      ...entities,
      ...commands.map((c) => IntentSearchResult(
            type: SearchResultType.navigation,
            title: c.command.title,
            subtitle: c.command.subtitle,
            iconKey: c.command.iconKey,
            route: c.command.route ?? '',
            isBranchGo: c.command.isBranchGo,
            score: c.score,
          )),
    ];
    // Action'lar ustun, keyin entity, keyin navigatsiya — ammo ball
    // birinchi darajali omil (deterministik).
    results.sort((a, b) {
      final byScore = b.score.compareTo(a.score);
      if (byScore != 0) return byScore;
      return a.title.compareTo(b.title);
    });
    return results;
  }

  static double _entityScore(String query, String target) {
    if (query.isEmpty) return 50;
    if (target == query) return 100;
    if (target.startsWith(query)) return 80;
    if (target.contains(query)) return 60;
    return 10;
  }

  static String _personSubtitle(Identity identity, String groupQuery) {
    final role = switch (identity.role) {
      IdentityRole.student => 'Talaba',
      IdentityRole.teacher => "O'qituvchi",
      IdentityRole.staff => 'Xodim',
      IdentityRole.parent => 'Ota-ona',
    };
    final group = groupQuery.isEmpty ? '' : ' • $groupQuery';
    return '$role${group.isNotEmpty ? group : ''} • ${identity.identityId}';
  }
}

/// [IntentSearchService.combine] uchun yordamchi tur.
class RankedCommandResult {
  final CommandAction command;
  final double score;

  const RankedCommandResult({required this.command, required this.score});
}
