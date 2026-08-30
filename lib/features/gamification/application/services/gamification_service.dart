import '../../../attendance/domain/entities/attendance_entry.dart';
import '../../../payments/domain/entities/payment.dart';
import '../../domain/entities/gamification_profile.dart';

/// O'yinlashtirish hisoblash logikasi — sof, holatsiz funksiya.
///
/// Isar'da yangi schema qo'shmasdan, mavjud real ma'lumotlar (davomat,
/// to'lovlar, o'quvchilar, o'qituvchilar, guruhlar) ustidan ball/daraja/yutuq
/// hisoblaydi. Har safar qayta hisoblash mumkin — xotira saqlanmaydi.
class GamificationService {
  const GamificationService();

  GamificationProfile compute({
    required List<AttendanceEntry> attendance,
    required List<Payment> payments,
    required int studentCount,
    required int teacherCount,
    required int groupCount,
    required int totalCollected,
  }) {
    var points = 0;
    var present = 0, late = 0, face = 0;

    for (final entry in attendance) {
      final status = entry.status.toLowerCase();
      if (status == 'present') {
        present++;
        points += 10;
      } else if (status == 'late') {
        late++;
        points += 5;
      }
      if (entry.method == 'face') {
        face++;
        points += 2;
      }
    }

    final completedPayments =
        payments.where((p) => p.isCompleted).length;
    points += completedPayments * 5;
    points += totalCollected ~/ 100000; // har 100k so'm uchun +1

    points += studentCount * 25;
    points += teacherCount * 20;
    points += groupCount * 30;

    final (level, startPoints, nextPoints) = _levelFor(points);

    return GamificationProfile(
      points: points,
      level: level,
      rankTitle: kRankTitles[(level - 1).clamp(0, kRankTitles.length - 1)],
      levelStartPoints: startPoints,
      nextLevelPoints: nextPoints,
      presentCount: present,
      lateCount: late,
      faceCount: face,
      paymentCount: completedPayments,
      totalCollected: totalCollected,
      studentCount: studentCount,
      teacherCount: teacherCount,
      groupCount: groupCount,
      achievements: _buildAchievements(
        present: present,
        face: face,
        payments: completedPayments,
        totalCollected: totalCollected,
        students: studentCount,
        teachers: teacherCount,
        groups: groupCount,
      ),
    );
  }

  /// Ball → daraja. (level, levelStartPoints, nextLevelPoints)
  (int, int, int?) _levelFor(int points) {
    for (var i = kLevelThresholds.length - 1; i >= 0; i--) {
      if (points >= kLevelThresholds[i]) {
        final next = i + 1 < kLevelThresholds.length
            ? kLevelThresholds[i + 1]
            : null;
        return (i + 1, kLevelThresholds[i], next);
      }
    }
    return (1, 0, kLevelThresholds[1]);
  }

  List<GamificationAchievement> _buildAchievements({
    required int present,
    required int face,
    required int payments,
    required int totalCollected,
    required int students,
    required int teachers,
    required int groups,
  }) {
    return [
      GamificationAchievement(
        id: 'first_step',
        iconKey: 'walk',
        title: 'Birinchi qadam',
        description: "Birinchi o'quvchi ro'yxatga olinsin",
        progress: students,
        target: 1,
      ),
      GamificationAchievement(
        id: 'team_builder',
        iconKey: 'groups',
        title: 'Jamoa quruvchi',
        description: "3 ta guruh yaratilsin",
        progress: groups,
        target: 3,
      ),
      GamificationAchievement(
        id: 'mentor',
        iconKey: 'school',
        title: 'Mentor',
        description: "2 ta o'qituvchi qo'shilsin",
        progress: teachers,
        target: 2,
      ),
      GamificationAchievement(
        id: 'attendance_master',
        iconKey: 'event',
        title: 'Davomat ustasi',
        description: '20 ta "Kelgan" belgilansin',
        progress: present,
        target: 20,
      ),
      GamificationAchievement(
        id: 'face_champion',
        iconKey: 'face',
        title: 'Yuz Chempioni',
        description: "10 ta davomat yuz tanish orqali",
        progress: face,
        target: 10,
      ),
      GamificationAchievement(
        id: 'finance_guru',
        iconKey: 'savings',
        title: 'Moliya gurusi',
        description: "1 000 000 so'm yig'ilsin",
        progress: totalCollected,
        target: 1000000,
      ),
      GamificationAchievement(
        id: 'payments_streak',
        iconKey: 'verified',
        title: 'Ishonchli hamyon',
        description: '10 ta to\'lov qabul qilinsin',
        progress: payments,
        target: 10,
      ),
    ];
  }
}
