import 'package:equatable/equatable.dart';

/// Yutuq (badge) — qat'iy shart asosida ochiladi.
///
/// [iconKey] UI'da haqiqiy IconData'ga xaritalanadi (domain qatlami Flutter
/// widget'lariga bog'lanmaydi). [progress]/[target] progress bar uchun.
class GamificationAchievement extends Equatable {
  final String id;
  final String iconKey;
  final String title;
  final String description;
  final int progress;
  final int target;

  const GamificationAchievement({
    required this.id,
    required this.iconKey,
    required this.title,
    required this.description,
    required this.progress,
    required this.target,
  });

  bool get isUnlocked => progress >= target;

  double get progressRatio =>
      target == 0 ? 0.0 : (progress / target).clamp(0.0, 1.0);

  @override
  List<Object?> get props =>
      [id, iconKey, title, description, progress, target];
}

/// Daraja chegaralari (ball → daraja).
///
/// Daraja k = points [thresholds[k-1], thresholds[k]) oralig'ida.
const List<int> kLevelThresholds = [
  0, 100, 250, 500, 900, 1500, 2500, 4000, 6500, 10000,
];

/// Unvonlar — darajaga mos.
const List<String> kRankTitles = [
  'Boshlovchi',
  'O\'quvchi',
  'Intiluvchan',
  'Faol',
  'Ishonchli',
  'Mutaxassis',
  'Ustoz',
  'Rahbar',
  'Chempion',
  'Afsona',
];

/// O'yinlashtirish profil — real ma'lumotlardan hisoblanadi (V2, no-schema).
///
/// Ballar (faqat ijobiy faoliyatdan):
///  • Kelgan davomat: +10, kechikkan: +5, yuz tanish orqali: +2 bonus
///  • Har bir o'quvchi: +25, o'qituvchi: +20, guruh: +30
///  • Har bir to'lov: +5 va yig'ilgan har 100 000 so'm uchun +1
class GamificationProfile extends Equatable {
  final int points;
  final int level;
  final String rankTitle;

  /// Joriy daraja boshlang'ich balli va keyingi daraja uchun kerakli ball.
  final int levelStartPoints;
  final int? nextLevelPoints;

  // Xom statistikalar (yutuqlar + UI kartochkalar uchun).
  final int presentCount;
  final int lateCount;
  final int faceCount;
  final int paymentCount;
  final int totalCollected;
  final int studentCount;
  final int teacherCount;
  final int groupCount;

  final List<GamificationAchievement> achievements;

  const GamificationProfile({
    required this.points,
    required this.level,
    required this.rankTitle,
    required this.levelStartPoints,
    required this.nextLevelPoints,
    required this.presentCount,
    required this.lateCount,
    required this.faceCount,
    required this.paymentCount,
    required this.totalCollected,
    required this.studentCount,
    required this.teacherCount,
    required this.groupCount,
    required this.achievements,
  });

  /// Joriy darajadagi taraqqiyot (0.0..1.0) — progress ring uchun.
  double get levelProgress {
    final next = nextLevelPoints;
    if (next == null) return 1.0;
    final span = next - levelStartPoints;
    if (span <= 0) return 1.0;
    return ((points - levelStartPoints) / span).clamp(0.0, 1.0);
  }

  int get unlockedAchievements =>
      achievements.where((a) => a.isUnlocked).length;

  @override
  List<Object?> get props => [
        points,
        level,
        rankTitle,
        levelStartPoints,
        nextLevelPoints,
        presentCount,
        lateCount,
        faceCount,
        paymentCount,
        totalCollected,
        studentCount,
        teacherCount,
        groupCount,
        achievements,
      ];
}
