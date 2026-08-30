import '../../domain/entities/action_priority.dart';
import '../../../payments/domain/entities/debt.dart';
import '../../../students/domain/entities/student.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../attendance/domain/entities/attendance_entry.dart';
import 'priority_scorer.dart';

/// NBA uchun kerakli real ma'lumotlar snapshot'i.
///
/// Provider qatlami ushbu snapshot'ni real repository'lardan yig'adi —
/// xizmatning o'zi hech qanday DB'ga bog'liq emas (sof deterministik).
class RecommendationSnapshot {
  final List<Debt> debts;
  final List<Student> students;
  final List<Identity> identities;
  final List<AttendanceEntry> todayAttendance;

  /// Bugungi faol darsga tegishli talabalar soni (davomat kutilayotganlar).
  final int expectedAttendanceCount;

  /// Sinxronlash navbatidagi yozuvlar soni.
  final int pendingSyncCount;

  /// Bugungi sana (testlar uchun injekt qilinadi).
  final DateTime now;

  const RecommendationSnapshot({
    required this.debts,
    required this.students,
    required this.identities,
    required this.todayAttendance,
    this.expectedAttendanceCount = 0,
    this.pendingSyncCount = 0,
    required this.now,
  });

  /// Identity ID → Identity (tez lookup).
  Map<String, Identity> get identityById => {
        for (final i in identities) i.identityId: i,
      };
}

/// Next Best Action — real ma'lumotdan keladigan tavsiyalar.
///
/// FAKE INSIGHT YO'Q: har bir tavsiya [Recommendation.sources] orqali
/// real yozuvga bog'lanadi. "Why am I seeing this?" — shu manbalardan
/// javob beradi.
class NextBestActionService {
  final PriorityScorer _scorer;

  const NextBestActionService({PriorityScorer scorer = const PriorityScorer()})
      : _scorer = scorer;

  /// Barcha mumkin bo'lgan tavsiyalarni ustuvorlik bo'yicha tartiblab qaytaradi.
  List<Recommendation> compute(RecommendationSnapshot snapshot) {
    final recommendations = <Recommendation>[
      ..._overdueDebtRecommendations(snapshot),
      ..._unpaidStudentRecommendations(snapshot),
      ..._incompleteProfileRecommendations(snapshot),
      ..._missingAttendanceRecommendations(snapshot),
      ..._pendingSyncRecommendation(snapshot),
    ];

    recommendations.sort((a, b) => b.priority.score.compareTo(a.priority.score));
    return recommendations;
  }

  /// Muddati o'tgan qarzlar → "To'lovni qayd etish".
  List<Recommendation> _overdueDebtRecommendations(RecommendationSnapshot s) {
    final overdue = s.debts.where((d) => d.isOverdue).toList()
      ..sort((a, b) => b.remainingAmount.compareTo(a.remainingAmount));
    if (overdue.isEmpty) return const [];

    final top = overdue.first;
    final daysOverdue = s.now.difference(top.dueDate).inDays;
    final priority = _scorer.score(
      urgency: PriorityScorer.urgencyFromDaysOverdue(daysOverdue),
      importance: (top.remainingAmount / 1000000).clamp(0.2, 1.0),
      recency: PriorityScorer.recencyFromAgeDays(
        s.now.difference(top.dueDate).inDays.toDouble(),
      ),
      context: 1.0,
    );

    return [
      Recommendation(
        id: 'payment.overdue.${top.debtId}',
        title: 'To\'lovni qayd etish',
        description:
            '${overdue.length} ta muddati o\'tgan qarzdorlik — '
            'eng kattasi ${top.studentName ?? 'talaba'}: '
            '${top.remainingAmount} so\'m',
        iconKey: 'payment',
        route: '/payments/debts',
        priority: priority,
        sources: [
          RecommendationSource(
            kind: 'debt',
            reference: top.debtId,
            detail: 'Qoldiq ${top.remainingAmount} so\'m, '
                'muddati ${_formatDate(top.dueDate)}',
          ),
        ],
      ),
    ];
  }

  /// To'lamagan (qarzi bor) talabalar → "To'lovni qayd etish".
  List<Recommendation> _unpaidStudentRecommendations(RecommendationSnapshot s) {
    final unpaid = s.students
        .where((st) => st.isActive && !st.hasPaid)
        .toList();
    if (unpaid.isEmpty) return const [];

    final priority = _scorer.score(
      urgency: 0.4,
      importance: (unpaid.length / 10).clamp(0.2, 1.0),
      recency: PriorityScorer.recencyFromAgeDays(
        s.now.difference(unpaid.first.enrolledAt).inDays.toDouble(),
      ),
      context: 0.6,
    );

    return [
      Recommendation(
        id: 'student.unpaid.${unpaid.length}',
        title: 'To\'lanmagan talabalar',
        description:
            '${unpaid.length} ta faol talabada to\'lov holati yo\'q — '
            'to\'lov qabul qilishni ko\'rib chiqing',
        iconKey: 'student',
        route: '/students',
        priority: priority,
        sources: [
          for (final st in unpaid.take(3))
            RecommendationSource(
              kind: 'student',
              reference: st.identityId,
              detail: st.identityId,
            ),
        ],
      ),
    ];
  }

  /// To'liq bo'lmagan profil (telefon/ota-ona yo'q) → "Profilni to'ldirish".
  List<Recommendation> _incompleteProfileRecommendations(
      RecommendationSnapshot s) {
    final incomplete = s.students.where((st) {
      final identity = s.identityById[st.identityId];
      if (identity == null) return false;
      // Profil to'liq emas: telefon yoki ota-ona ma'lumoti yo'q.
      final missingPhone = identity.phone == null || identity.phone!.trim().isEmpty;
      final missingParent =
          st.parentName == null || st.parentPhone == null;
      return missingPhone || missingParent;
    }).toList();

    if (incomplete.isEmpty) return const [];

    final priority = _scorer.score(
      urgency: 0.2,
      importance: (incomplete.length / 10).clamp(0.2, 1.0),
      recency: PriorityScorer.recencyFromAgeDays(
        s.now.difference(incomplete.first.enrolledAt).inDays.toDouble(),
      ),
      context: 0.4,
    );

    return [
      Recommendation(
        id: 'student.incomplete.${incomplete.length}',
        title: 'Profillar to\'liq emas',
        description:
            '${incomplete.length} ta talaba profilida telefon yoki '
            'ota-ona ma\'lumoti yo\'q',
        iconKey: 'profile',
        route: '/students',
        priority: priority,
        sources: [
          for (final st in incomplete.take(3))
            RecommendationSource(
              kind: 'student',
              reference: st.identityId,
              detail: st.identityId,
            ),
        ],
      ),
    ];
  }

  /// Bugungi davomat yetishmayapti → "Davomatni ko'rib chiqish".
  List<Recommendation> _missingAttendanceRecommendations(
      RecommendationSnapshot s) {
    // Faol dars bor va bugungi davomat yozuvlari kutilganidan kam bo'lsa.
    if (s.expectedAttendanceCount <= 0) return const [];
    final markedCount = s.todayAttendance.length;
    if (markedCount >= s.expectedAttendanceCount) return const [];

    final missing = s.expectedAttendanceCount - markedCount;
    final priority = _scorer.score(
      urgency: 0.8,
      importance: (missing / 10).clamp(0.3, 1.0),
      recency: 1.0,
      context: 0.8,
    );

    return [
      Recommendation(
        id: 'attendance.missing.$missing',
        title: 'Davomatni belgilash',
        description:
            'Bugungi darsda $missing ta talaba davomati belgilanmagan',
        iconKey: 'attendance',
        route: '/attendance',
        priority: priority,
        sources: [
          const RecommendationSource(
            kind: 'attendance',
            detail: 'Bugungi faol dars uchun davomat kutilmoqda',
          ),
        ],
      ),
    ];
  }

  /// Sinxronlash navbatida yozuvlar bor → "Sinxronlashni boshlash".
  List<Recommendation> _pendingSyncRecommendation(RecommendationSnapshot s) {
    if (s.pendingSyncCount <= 0) return const [];

    final priority = _scorer.score(
      urgency: 0.6,
      importance: (s.pendingSyncCount / 20).clamp(0.2, 1.0),
      recency: 1.0,
      context: 0.5,
    );

    return [
      Recommendation(
        id: 'sync.pending.${s.pendingSyncCount}',
        title: 'Sinxronlashni boshlash',
        description:
            '${s.pendingSyncCount} ta yozuv sinxronlash navbatida — '
            'tarmoq tiklanganda yuboriladi',
        iconKey: 'sync',
        route: '/settings',
        priority: priority,
        sources: [
          RecommendationSource(
            kind: 'sync',
            detail: '${s.pendingSyncCount} ta navbatdagi operatsiya',
          ),
        ],
      ),
    ];
  }

  static String _formatDate(DateTime d) => '${d.day.toString().padLeft(2, '0')}.'
      '${d.month.toString().padLeft(2, '0')}.${d.year}';
}
