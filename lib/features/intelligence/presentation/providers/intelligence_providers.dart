import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/network/infrastructure/datasources/sync_operation_datasource.dart';
import '../../../../core/security/permissions.dart';
import '../../../attendance/domain/events/attendance_events.dart';
import '../../../attendance/presentation/providers/attendance_providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../groups/presentation/providers/group_providers.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../payments/domain/events/payment_events.dart';
import '../../../payments/presentation/providers/payment_providers.dart';
import '../../../students/domain/events/student_events.dart';
import '../../../students/presentation/providers/student_providers.dart';
import '../../application/actions/contextual_action_resolver.dart';
import '../../application/automation/automation_engine.dart';
import '../../application/commands/command_ranker.dart';
import '../../application/commands/command_registry.dart';
import '../../application/recommendations/next_best_action_service.dart';
import '../../application/recommendations/priority_scorer.dart';
import '../../application/search/intent_search_service.dart';
import '../../application/search/search_intent_parser.dart';
import '../../application/usage/recent_usage_tracker.dart';
import '../../domain/entities/action_priority.dart';
import '../../domain/entities/automation_rule.dart';
import '../../domain/entities/command.dart';
import '../../domain/entities/search_intent.dart';

/// ─── Statik buyruqlar katalogi ─────────────────────────────────────────
///
/// Barcha navigatsiya/amal buyruqlari shu yerda ro'yxatdan o'tadi
/// (markaziy reyestr — UI'da switch yo'q).
List<CommandAction> buildStaticCommands() {
  return [
    // ── Navigatsiya ──
    const CommandAction(
      id: 'nav.dashboard',
      title: 'Bosh sahifa',
      subtitle: 'Bugungi holat va tezkor amallar',
      iconKey: 'home',
      category: CommandCategory.navigation,
      keywords: ['home', 'dashboard', 'asosiy', 'главная'],
      route: '/dashboard',
      basePriority: 10,
    ),
    const CommandAction(
      id: 'nav.students',
      title: "O'quvchilar",
      subtitle: 'Talabalar ro\'yxati va profillar',
      iconKey: 'student',
      category: CommandCategory.students,
      keywords: ['students', 'talabalar', 'ученики'],
      route: '/students',
      requiredPermission: AppPermission.studentsView,
      basePriority: 9,
    ),
    const CommandAction(
      id: 'nav.groups',
      title: 'Guruhlar',
      subtitle: 'Guruhlar va a\'zolik',
      iconKey: 'group',
      category: CommandCategory.students,
      keywords: ['groups', 'guruhlar', 'классы'],
      route: '/groups',
      requiredPermission: AppPermission.groupsView,
      basePriority: 8,
    ),
    const CommandAction(
      id: 'nav.attendance',
      title: 'Davomat',
      subtitle: 'Bugungi davomatni belgilash',
      iconKey: 'attendance',
      category: CommandCategory.attendance,
      keywords: ['attendance', 'davomat', 'посещаемость'],
      route: '/attendance',
      requiredPermission: AppPermission.attendanceView,
      basePriority: 9,
    ),
    const CommandAction(
      id: 'nav.schedule',
      title: 'Jadval',
      subtitle: 'Dars jadvali va xonalar',
      iconKey: 'schedule',
      category: CommandCategory.navigation,
      keywords: ['schedule', 'jadval', 'расписание'],
      route: '/schedule',
      requiredPermission: AppPermission.scheduleView,
      basePriority: 7,
    ),
    const CommandAction(
      id: 'nav.finance',
      title: 'Moliya',
      subtitle: "To'lovlar, qarzlar va xarajatlar",
      iconKey: 'payment',
      category: CommandCategory.payments,
      keywords: ['finance', 'moliya', 'payments', 'to\'lovlar', 'финансы'],
      route: '/finance',
      requiredPermission: AppPermission.financeView,
      basePriority: 9,
      isBranchGo: true,
    ),
    const CommandAction(
      id: 'nav.reports',
      title: 'Hisobotlar',
      subtitle: 'Davomat, moliya va qarzdorlik hisobotlari',
      iconKey: 'report',
      category: CommandCategory.reports,
      keywords: ['reports', 'hisobot', 'отчеты'],
      route: '/reports',
      requiredPermission: AppPermission.reportsView,
      basePriority: 8,
      isBranchGo: true,
    ),
    const CommandAction(
      id: 'nav.settings',
      title: 'Sozlamalar',
      subtitle: 'Til, mavzu, kamera, zaxira',
      iconKey: 'settings',
      category: CommandCategory.system,
      keywords: ['settings', 'sozlamalar', 'настройки'],
      route: '/settings',
      requiredPermission: AppPermission.settingsView,
      basePriority: 6,
      isBranchGo: true,
    ),
    const CommandAction(
      id: 'nav.notifications',
      title: 'Bildirishnomalar',
      subtitle: 'Xabarlar va eslatmalar',
      iconKey: 'notification',
      category: CommandCategory.system,
      keywords: ['notifications', 'bildirishnoma', 'уведомления'],
      route: '/notifications',
      basePriority: 5,
    ),
    const CommandAction(
      id: 'nav.teachers',
      title: "O'qituvchilar",
      subtitle: "O'qituvchilar ro'yxati",
      iconKey: 'teacher',
      category: CommandCategory.students,
      keywords: ['teachers', 'o\'qituvchi', 'преподаватели'],
      route: '/teachers',
      requiredPermission: AppPermission.teachersView,
      basePriority: 6,
    ),
    const CommandAction(
      id: 'nav.identity',
      title: 'ID Shaxslar',
      subtitle: 'Barcha shaxslar (universal identity)',
      iconKey: 'person',
      category: CommandCategory.students,
      keywords: ['identity', 'shaxslar', 'id'],
      route: '/identity',
      requiredPermission: AppPermission.studentsView,
      basePriority: 5,
    ),

    // ── Amallar ──
    const CommandAction(
      id: 'action.addStudent',
      title: 'Talaba qo\'shish',
      subtitle: "Yangi o'quvchini ro'yxatga olish",
      iconKey: 'add',
      category: CommandCategory.students,
      keywords: ['add', 'new', 'qo\'shish', 'yangi talaba', 'добавить'],
      route: '/identity/register',
      requiredPermission: AppPermission.studentsCreate,
      basePriority: 9,
    ),
    const CommandAction(
      id: 'action.addPayment',
      title: "To'lov qabul qilish",
      subtitle: 'Yangi to\'lovni qayd etish',
      iconKey: 'payment',
      category: CommandCategory.payments,
      keywords: ['payment', 'to\'lov', 'qabul', 'pay'],
      route: '/payments/new',
      requiredPermission: AppPermission.financeCreate,
      basePriority: 9,
    ),
    const CommandAction(
      id: 'action.addExpense',
      title: 'Xarajat kiritish',
      subtitle: 'Chiqimni qayd etish',
      iconKey: 'expense',
      category: CommandCategory.payments,
      keywords: ['expense', 'xarajat', 'chiqim'],
      route: '/finance/expense/new',
      requiredPermission: AppPermission.financeCreate,
      basePriority: 6,
    ),
    const CommandAction(
      id: 'action.debts',
      title: 'Qarzdorlar',
      subtitle: 'Muddati o\'tgan qarzdorliklar',
      iconKey: 'debt',
      category: CommandCategory.payments,
      keywords: ['debt', 'qarz', 'qarzdor', 'unpaid', 'долги'],
      route: '/payments/debts',
      requiredPermission: AppPermission.financeView,
      basePriority: 7,
    ),
    const CommandAction(
      id: 'action.createGroup',
      title: 'Guruh yaratish',
      subtitle: 'Yangi guruh va a\'zolik',
      iconKey: 'add',
      category: CommandCategory.students,
      keywords: ['group', 'guruh', 'yaratish'],
      route: '/groups/create',
      requiredPermission: AppPermission.groupsCreate,
      basePriority: 6,
    ),
    const CommandAction(
      id: 'action.faceScan',
      title: 'Face ID skaneri',
      subtitle: 'Yuz orqali davomat',
      iconKey: 'face',
      category: CommandCategory.attendance,
      keywords: ['face', 'camera', 'kamera', 'yuz'],
      route: '/face-scan',
      requiredPermission: AppPermission.faceIdUse,
      basePriority: 6,
    ),
    const CommandAction(
      id: 'action.qrScan',
      title: 'QR skaner',
      subtitle: 'QR orqali davomat belgilash',
      iconKey: 'qr',
      category: CommandCategory.attendance,
      keywords: ['qr', 'skaner', 'skan'],
      route: '/identity/scan',
      requiredPermission: AppPermission.attendanceCreate,
      basePriority: 5,
    ),
    const CommandAction(
      id: 'action.reportMonthly',
      title: 'Oylik davomat hisoboti',
      subtitle: "O'quvchilar davomati hisoboti",
      iconKey: 'report',
      category: CommandCategory.reports,
      keywords: ['monthly', 'oylik', 'davomat hisoboti'],
      route: '/reports/monthly',
      requiredPermission: AppPermission.reportsView,
      basePriority: 6,
    ),
    const CommandAction(
      id: 'action.reportRevenue',
      title: 'Daromad hisoboti',
      subtitle: 'Oylik daromad va xarajat',
      iconKey: 'report',
      category: CommandCategory.reports,
      keywords: ['revenue', 'daromad', 'foyda'],
      route: '/reports/revenue',
      requiredPermission: AppPermission.reportsView,
      basePriority: 5,
    ),
    const CommandAction(
      id: 'action.syncNow',
      title: 'Sinxronlashni boshlash',
      subtitle: "Navbatdagi yozuvlarni cloud'ga yuborish",
      iconKey: 'sync',
      category: CommandCategory.system,
      keywords: ['sync', 'sinxron', 'yangilash', 'update'],
      route: '/settings',
      isBranchGo: true,
      basePriority: 5,
    ),
  ];
}

/// Buyruq reyestri provider'ı.
final commandRegistryProvider = Provider<CommandRegistry>((ref) {
  final registry = CommandRegistry();
  registry.registerAll(buildStaticCommands());
  return registry;
});

/// Yaqinda ishlatilgan buyruqlar (session ichida).
final recentUsageTrackerProvider = Provider<RecentUsageTracker>(
  (ref) => RecentUsageTracker(),
);

/// Intent parser (sof, stateless).
final searchIntentParserProvider = Provider<SearchIntentParser>(
  (ref) => SearchIntentParser(),
);

/// Intent qidiruv xizmati (sof, stateless).
final intentSearchServiceProvider = Provider<IntentSearchService>(
  (ref) => IntentSearchService(),
);

/// Kontekstual amal resolver.
final contextualActionResolverProvider = Provider<ContextualActionResolver>(
  (ref) => const ContextualActionResolver(),
);

/// Ustuvorlik hisoblagichi.
final priorityScorerProvider = Provider<PriorityScorer>(
  (ref) => const PriorityScorer(),
);

/// NBA xizmati.
final nextBestActionServiceProvider = Provider<NextBestActionService>(
  (ref) => const NextBestActionService(),
);

/// ─── Command palette holati ────────────────────────────────────────────

class CommandPaletteState {
  final bool isOpen;
  final String query;
  final String? currentRoute;

  const CommandPaletteState({
    this.isOpen = false,
    this.query = '',
    this.currentRoute,
  });

  CommandPaletteState copyWith({
    bool? isOpen,
    String? query,
    String? currentRoute,
  }) {
    return CommandPaletteState(
      isOpen: isOpen ?? this.isOpen,
      query: query ?? this.query,
      currentRoute: currentRoute ?? this.currentRoute,
    );
  }
}

/// Palette ochiq/yopiq holati + joriy so'rov.
class CommandPaletteController extends StateNotifier<CommandPaletteState> {
  CommandPaletteController() : super(const CommandPaletteState());

  void open({String? currentRoute}) {
    state = CommandPaletteState(isOpen: true, currentRoute: currentRoute);
  }

  void close() {
    state = const CommandPaletteState(isOpen: false);
  }

  void toggle({String? currentRoute}) {
    if (state.isOpen) {
      close();
    } else {
      open(currentRoute: currentRoute);
    }
  }

  void setQuery(String query) {
    state = state.copyWith(query: query);
  }
}

final commandPaletteControllerProvider =
    StateNotifierProvider<CommandPaletteController, CommandPaletteState>(
  (ref) => CommandPaletteController(),
);

/// ─── Palette natijalari ────────────────────────────────────────────────

/// Palette natijalari — intent + entity + amal + navigatsiya.
class PaletteResults {
  final SearchIntent intent;
  final List<IntentSearchResult> results;
  final List<RankedCommand> rankedCommands;
  final List<String> recentCommandIds;

  const PaletteResults({
    required this.intent,
    required this.results,
    required this.rankedCommands,
    this.recentCommandIds = const [],
  });

  bool get isEmpty => results.isEmpty;
}

/// Palette natijalari — so'rov o'zgarganda qayta hisoblanadi.
/// Real repository'lardan o'qiydi (identity/group/payment), lekin hammasi
/// lokal va deterministik (offline-safe).
final paletteResultsProvider =
    FutureProvider.autoDispose<PaletteResults>((ref) async {
  final state = ref.watch(commandPaletteControllerProvider);
  if (!state.isOpen) {
    return const PaletteResults(
      intent: SearchIntent(rawQuery: ''),
      results: [],
      rankedCommands: [],
    );
  }

  final parser = ref.watch(searchIntentParserProvider);
  final intent = parser.parse(state.query);

  // Buyruqlar: rol filtr + reytinq (recency + current route).
  final registry = ref.watch(commandRegistryProvider);
  final usage = ref.watch(recentUsageTrackerProvider);
  final role = ref.watch(actorRoleProvider);
  final ranker = const CommandRanker();
  final ranked = ranker.rank(
    query: state.query,
    commands: registry.availableFor(role),
    recentlyUsedIds: usage.recentIds.toSet(),
    currentRoute: state.currentRoute,
  );

  // Entity qidiruvi (real lokal ma'lumot).
  final identities = await ref.watch(identityListProvider.future);
  final groups = await ref.watch(groupListProvider.future);
  final payments = await ref.watch(paymentListProvider.future);
  final searchService = ref.watch(intentSearchServiceProvider);

  final entities = searchService.searchEntities(
    intent: intent,
    identities: identities,
    groups: groups,
    payments: payments,
  );
  final actions = searchService.searchActions(intent);

  final results = searchService.combine(
    intent: intent,
    entities: entities,
    actions: actions,
    commands: [
      for (final r in ranked)
        RankedCommandResult(command: r.command, score: r.score),
    ],
  );

  return PaletteResults(
    intent: intent,
    results: results,
    rankedCommands: ranked,
    recentCommandIds: usage.recentIds,
  );
});

/// ─── Tavsiyalar (Next Best Action) ─────────────────────────────────────

/// Tavsiyalar versiya hisoblagichi — automation uni oshiradi.
final recommendationVersionProvider = StateProvider<int>((ref) => 0);

/// Real ma'lumotdan keladigan tavsiyalar.
///
/// Har bir tavsiya [Recommendation.sources] orqali real yozuvga bog'lanadi
/// — "Nega buni ko'ryapman?" savoliga javob real ma'lumotdan beriladi.
final nextBestActionsProvider = FutureProvider<List<Recommendation>>((ref) {
  ref.watch(recommendationVersionProvider);
  ref.watch(studentListVersionProvider);
  ref.watch(paymentListVersionProvider);
  ref.watch(attendanceVersionProvider);
  ref.watch(identityListVersionProvider);

  return _computeRecommendations(ref);
});

Future<List<Recommendation>> _computeRecommendations(Ref ref) async {
  final service = ref.watch(nextBestActionServiceProvider);

  // Sinxronlash navbati (real Isar query).
  final db = ref.watch(appDatabaseProvider);
  final pendingSync =
      await SyncOperationDataSource(db.instance).pendingCount();

  // Faol dars bo'lsa — kutilayotgan davomat soni (guruh a'zolari).
  var expectedAttendance = 0;
  final activeLesson = await ref.watch(activeLessonProvider.future);
  if (activeLesson != null) {
    try {
      final groupStudents =
          await ref.read(studentsByGroupProvider(activeLesson.groupId).future);
      expectedAttendance = groupStudents.length;
    } catch (_) {
      expectedAttendance = 0;
    }
  }

  final snapshot = RecommendationSnapshot(
    debts: await ref.watch(outstandingDebtsProvider.future),
    students: await ref.watch(studentListProvider.future),
    identities: await ref.watch(identityListProvider.future),
    todayAttendance: await ref.watch(todayAttendanceProvider.future),
    expectedAttendanceCount: expectedAttendance,
    pendingSyncCount: pendingSync,
    now: DateTime.now(),
  );

  return service.compute(snapshot);
}

/// ─── Avtomatlashtirish (Phase 5 foundation) ────────────────────────────

/// Qoidalar bilan to'ldirilgan dvigatel.
final automationEngineProvider = Provider<AutomationEngine>((ref) {
  final engine = AutomationEngine();
  engine.registerAll([
    // 1. Yangi talaba yaratildi → profili to'liq emas → tavsiyalarni yangila.
    const AutomationRule(
      id: 'student.profile-incomplete',
      description:
          'Yangi talaba yaratilganda profili to\'liq emas bo\'lsa, '
          '"Profillar to\'liq emas" tavsiyasini ko\'rsatish',
      trigger: AutomationTrigger.studentCreated,
      action: AutomationAction.refreshRecommendations,
    ),
    // 2. To'lov/qarz o'zgardi → dashboard xulosasini yangila.
    const AutomationRule(
      id: 'payment.dashboard-refresh',
      description:
          "To'lov yoki qarz o'zgarganda moliyaviy xulosani yangilash",
      trigger: AutomationTrigger.paymentChanged,
      action: AutomationAction.refreshDashboard,
    ),
    // 3. Davomat belgilandi → tavsiyalarni yangila (qolgan qadamlar).
    const AutomationRule(
      id: 'attendance.refresh',
      description:
          'Davomat belgilanganda qolgan tavsiyalarni qayta hisoblash',
      trigger: AutomationTrigger.attendanceMarked,
      action: AutomationAction.refreshRecommendations,
    ),
    // 4. Ilova ochildi → sinxronlash navbatini tekshirib tavsiya ber.
    const AutomationRule(
      id: 'sync.on-start',
      description:
          'Ilova ochilganda sinxronlash navbatini tekshirish',
      trigger: AutomationTrigger.appStarted,
      action: AutomationAction.refreshRecommendations,
    ),
  ]);
  return engine;
});

/// Event bus → AutomationEngine ko'prigi.
///
/// Hodisa kelganda tegishli trigger qoidalarini tekshiradi va action'ni
/// bajaradi (tavsiyalarni yangilash = recommendationVersion++).
/// Hech qachon ma'lumotni jimgina o'zgartirmaydi — faqat UI'ni yangilaydi.
class AutomationCoordinator {
  final EventBus _bus;
  final AutomationEngine _engine;
  final Ref _ref;
  final List<StreamSubscription<dynamic>> _subscriptions = [];

  AutomationCoordinator({
    required EventBus bus,
    required AutomationEngine engine,
    required Ref ref,
  })  : _bus = bus,
        _engine = engine,
        _ref = ref;

  void start() {
    _on<StudentRegisteredEvent>((event) {
      _runFor(
        AutomationTrigger.studentCreated,
        // Condition: yangi talaba profilida telefon yoki ota-ona yo'q.
        condition: () {
          final identity = _ref
              .read(identityListProvider)
              .valueOrNull
              ?.firstWhere(
                (i) => i.identityId == event.student.identityId,
                orElse: () => Identity(
                  identityId: event.student.identityId,
                  firstName: '',
                  lastName: '',
                  role: IdentityRole.student,
                  status: IdentityStatus.active,
                  qrSeed: '',
                  createdAt: DateTime.now(),
                ),
              );
          final missingPhone =
              identity?.phone == null || identity!.phone!.trim().isEmpty;
          return missingPhone;
        },
      );
    });

    _on<PaymentReceivedEvent>((_) {
      _runFor(
        AutomationTrigger.paymentChanged,
        condition: () => true,
      );
    });
    _on<DebtCreatedEvent>((_) {
      _runFor(
        AutomationTrigger.paymentChanged,
        condition: () => true,
      );
    });
    _on<AttendanceMarkedEvent>((_) {
      _runFor(
        AutomationTrigger.attendanceMarked,
        condition: () => true,
      );
    });
  }

  void _on<T extends DomainEvent>(void Function(T event) handler) {
    _subscriptions.add(_bus.on<T>().listen(handler));
  }

  void _runFor(
    AutomationTrigger trigger, {
    required bool Function() condition,
  }) {
    final matched = _engine.evaluate(
      trigger,
      evaluateCondition: (_) => condition(),
    );
    for (final rule in matched) {
      _apply(rule.action);
    }
  }

  void _apply(AutomationAction action) {
    switch (action) {
      case AutomationAction.refreshRecommendations:
      case AutomationAction.refreshDashboard:
        _ref.read(recommendationVersionProvider.notifier).state++;
      case AutomationAction.startSync:
        // SyncScheduler allaqachon main()'da ishlaydi — bu yerda faqat
        // tavsiya yangilanadi (startSync mustaqil tarzda boshqariladi).
        _ref.read(recommendationVersionProvider.notifier).state++;
      case AutomationAction.createNotification:
        break;
    }
  }

  void dispose() {
    for (final subscription in _subscriptions) {
      subscription.cancel();
    }
  }
}

/// Automation ko'prigi provider — `main.dart`'da watch qilinadi.
final automationCoordinatorProvider = Provider<AutomationCoordinator>((ref) {
  final coordinator = AutomationCoordinator(
    bus: ref.watch(eventBusProvider),
    engine: ref.watch(automationEngineProvider),
    ref: ref,
  );
  coordinator.start();
  ref.onDispose(coordinator.dispose);
  return coordinator;
});
