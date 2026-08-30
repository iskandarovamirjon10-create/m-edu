import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/attendance/domain/entities/attendance_entry.dart';
import 'package:m_edu/features/gamification/application/services/gamification_service.dart';
import 'package:m_edu/features/gamification/domain/entities/gamification_profile.dart';
import 'package:m_edu/features/payments/domain/entities/payment.dart';

/// Minimal davomat yozuvi yasaydi (faqat hisoblash uchun kerakli maydonlar).
AttendanceEntry _entry({
  required String status,
  String method = 'manual',
  String identityId = 'M-EDU-2026-000001',
}) {
  return AttendanceEntry(
    identityId: identityId,
    fullName: 'Test Talaba',
    role: 'student',
    attendanceDate: DateTime(2026, 8, 10),
    method: method,
    status: status,
  );
}

Payment _payment({required PaymentStatus status, int amount = 100000}) {
  return Payment(
    paymentId: 'PAY-${status.name}-$amount',
    studentIdentityId: 'M-EDU-2026-000001',
    amount: amount,
    paymentType: PaymentType.cash,
    status: status,
    paymentDate: DateTime(2026, 8, 10),
  );
}

void main() {
  const service = GamificationService();

  group('GamificationService — sof, deterministik hisoblash', () {
    test('bo\'sh ma\'lumotlar (zero state): 0 ball, 1-daraja, barcha yutuqlar yopiq', () {
      final profile = service.compute(
        attendance: const [],
        payments: const [],
        studentCount: 0,
        teacherCount: 0,
        groupCount: 0,
        totalCollected: 0,
      );

      expect(profile.points, 0);
      expect(profile.level, 1);
      expect(profile.rankTitle, 'Boshlovchi');
      expect(profile.levelStartPoints, 0);
      expect(profile.nextLevelPoints, 100);
      expect(profile.levelProgress, 0.0);
      expect(profile.presentCount, 0);
      expect(profile.lateCount, 0);
      expect(profile.faceCount, 0);
      expect(profile.paymentCount, 0);
      expect(profile.totalCollected, 0);
      expect(profile.unlockedAchievements, 0);
      expect(profile.achievements.every((a) => !a.isUnlocked), isTrue);
    });

    test('happy path: davomat + to\'lov + hisoblar ball matematik to\'g\'ri', () {
      // 2 present (+20), 1 late (+5), 1 face-bonus (+2) → 27
      // 2 completed payment (+10), totalCollected 500000 (→ +5)
      // studentCount 3 (+75), teacherCount 1 (+20), groupCount 2 (+60)
      final profile = service.compute(
        attendance: [
          _entry(status: 'present'),
          _entry(status: 'present', identityId: 'M-EDU-2026-000002'),
          _entry(status: 'late', identityId: 'M-EDU-2026-000003'),
          _entry(status: 'present', method: 'face', identityId: 'M-EDU-2026-000004'),
        ],
        payments: [
          _payment(status: PaymentStatus.completed),
          _payment(status: PaymentStatus.completed, amount: 200000),
          _payment(status: PaymentStatus.pending), // hisoblanmaydi
        ],
        studentCount: 3,
        teacherCount: 1,
        groupCount: 2,
        totalCollected: 500000,
      );

      // davomat: 3 present (+30) + 1 late (+5) + 1 face-bonus (+2) = 37
      // to'lov: +10, yig'im: +5, o'quvchi: +75, o'qituvchi: +20, guruh: +60
      // Jami: 37 + 10 + 5 + 75 + 20 + 60 = 207
      expect(profile.points, 207);
      expect(profile.presentCount, 3);
      expect(profile.lateCount, 1);
      expect(profile.faceCount, 1);
      expect(profile.paymentCount, 2);
      expect(profile.totalCollected, 500000);
      expect(profile.level, 2); // 207 ≥ 100 → 2-daraja, 207 < 250
    });

    test('unknown/hisobga olinmaydigan statuslar (absent, excused) ball bermaydi', () {
      final profile = service.compute(
        attendance: [
          _entry(status: 'absent'),
          _entry(status: 'excused'),
          _entry(status: 'unknown-status'),
          _entry(status: 'PRESENT'), // katta harf — toLowerCase qilinadi
        ],
        payments: const [],
        studentCount: 0,
        teacherCount: 0,
        groupCount: 0,
        totalCollected: 0,
      );

      // Faqat 'PRESENT' → toLowerCase → present → +10
      expect(profile.points, 10);
      expect(profile.presentCount, 1);
    });

    test('faqat completed to\'lovlar sanaladi (pending/failed/refunded/cancelled — 0)', () {
      final profile = service.compute(
        attendance: const [],
        payments: [
          _payment(status: PaymentStatus.pending),
          _payment(status: PaymentStatus.failed),
          _payment(status: PaymentStatus.refunded),
          _payment(status: PaymentStatus.cancelled),
        ],
        studentCount: 0,
        teacherCount: 0,
        groupCount: 0,
        totalCollected: 0,
      );

      expect(profile.paymentCount, 0);
      expect(profile.points, 0);
    });

    test('yig\'ilgan har 100000 so\'m uchun +1 ball (floor)', () {
      final profile = service.compute(
        attendance: const [],
        payments: const [],
        studentCount: 0,
        teacherCount: 0,
        groupCount: 0,
        totalCollected: 250000,
      );

      // 250000 ~/ 100000 = 2
      expect(profile.points, 2);
    });

    test('duplicate event-safe: takroriy yozuvlar deterministik sanaladi, hech narsa buzilmaydi', () {
      final dup = _entry(status: 'present', method: 'face');
      final profile = service.compute(
        attendance: [dup, dup, dup],
        payments: const [],
        studentCount: 0,
        teacherCount: 0,
        groupCount: 0,
        totalCollected: 0,
      );

      // (10 + 2) * 3 = 36
      expect(profile.points, 36);
      expect(profile.presentCount, 3);
      expect(profile.faceCount, 3);

      // Deterministik: ikkinchi marta hisoblash bir xil natija beradi.
      final again = service.compute(
        attendance: [dup, dup, dup],
        payments: const [],
        studentCount: 0,
        teacherCount: 0,
        groupCount: 0,
        totalCollected: 0,
      );
      expect(again, profile);
    });

    test('boundary: daraja chegaralari (0/100/250/500/.../10000)', () {
      // Har 100 000 so'm → +1 ball, shuning uchun P ball uchun
      // totalCollected = P * 100000 beriladi.
      int levelFor(int points) => service
          .compute(
            attendance: const [],
            payments: const [],
            studentCount: 0,
            teacherCount: 0,
            groupCount: 0,
            totalCollected: points * 100000,
          )
          .level;

      expect(levelFor(0), 1); // [0, 100)
      expect(levelFor(99), 1);
      expect(levelFor(100), 2); // 100 → level 2
      expect(levelFor(250), 3);
      expect(levelFor(500), 4);
      expect(levelFor(900), 5);
      expect(levelFor(1500), 6);
      expect(levelFor(2500), 7);
      expect(levelFor(4000), 8);
      expect(levelFor(6500), 9);
      expect(levelFor(10000), 10); // maksimal
    });

    test('maksimal daraja: nextLevelPoints null, levelProgress 1.0, rankTitle Afsona', () {
      final profile = service.compute(
        attendance: const [],
        payments: const [],
        studentCount: 0,
        teacherCount: 0,
        groupCount: 0,
        totalCollected: 1000000000, // 10 000 ball — maksimal daraja
      );

      expect(profile.level, 10);
      expect(profile.rankTitle, 'Afsona');
      expect(profile.nextLevelPoints, isNull);
      expect(profile.levelProgress, 1.0);
    });

    test('large values: katta hajmda ham overflow bo\'lmaydi', () {
      final attendance = List.generate(
        10000,
        (i) => _entry(
          status: 'present',
          method: i.isEven ? 'face' : 'manual',
          identityId: 'M-EDU-2026-${i.toString().padLeft(6, '0')}',
        ),
      );
      final profile = service.compute(
        attendance: attendance,
        payments: List.generate(
          1000,
          (i) => _payment(status: PaymentStatus.completed, amount: 1000000),
        ),
        studentCount: 500,
        teacherCount: 20,
        groupCount: 30,
        totalCollected: 1000000000,
      );

      // 10000 * 10 + 5000 * 2 (face) + 1000 * 5 + 10000 (yig'im) + 12500 + 400 + 900
      expect(profile.points, 100000 + 10000 + 5000 + 10000 + 12500 + 400 + 900);
      expect(profile.level, 10);
      expect(profile.presentCount, 10000);
    });

    test('salbiy/mana sifatida kutilmagan qiymatlar — 0 ga normallashadi yoki xato tashlamaydi', () {
      // negative counts — service matematik xato tashlamasligi kerak
      final profile = service.compute(
        attendance: const [],
        payments: const [],
        studentCount: -5,
        teacherCount: -1,
        groupCount: 0,
        totalCollected: -100000,
      );

      // -5*25 + -1*20 + -1 (yig'im) = -146 — salbiy ball; daraja 1 ga clamp.
      expect(profile.level, 1);
      expect(profile.points, -146);
      expect(profile.levelStartPoints, 0);
      // levelProgress salbiy ball uchun 0.0'ga clamp bo'ladi.
      expect(profile.levelProgress, 0.0);
    });
  });

  group('GamificationProfile — yutuq (achievement) logikasi', () {
    test('isUnlocked/progressRatio progress va target bo\'yicha', () {
      final a = GamificationAchievement(
        id: 'x',
        iconKey: 'star',
        title: 'X',
        description: 'D',
        progress: 7,
        target: 10,
      );
      expect(a.isUnlocked, isFalse);
      expect(a.progressRatio, closeTo(0.7, 0.0001));

      final b = GamificationAchievement(
        id: 'y',
        iconKey: 'star',
        title: 'Y',
        description: 'D',
        progress: 10,
        target: 10,
      );
      expect(b.isUnlocked, isTrue);
      expect(b.progressRatio, 1.0);

      // target=0 bo'lsa ratio 0 (bo'lish xatosi bo'lmaydi).
      final c = GamificationAchievement(
        id: 'z',
        iconKey: 'star',
        title: 'Z',
        description: 'D',
        progress: 5,
        target: 0,
      );
      expect(c.progressRatio, 0.0);
    });

    test('yutuqlar real ma\'lumotlarga mos ochiladi', () {
      final profile = service.compute(
        attendance: List.generate(20, (i) => _entry(status: 'present')),
        payments: List.generate(10, (i) => _payment(status: PaymentStatus.completed)),
        studentCount: 1,
        teacherCount: 2,
        groupCount: 3,
        totalCollected: 1000000,
      );

      String? byId(String id) {
        for (final a in profile.achievements) {
          if (a.id == id) return a.isUnlocked ? 'unlocked' : 'locked';
        }
        return null;
      }

      expect(byId('first_step'), 'unlocked'); // 1+ o'quvchi
      expect(byId('team_builder'), 'unlocked'); // 3 guruh
      expect(byId('mentor'), 'unlocked'); // 2 o'qituvchi
      expect(byId('attendance_master'), 'unlocked'); // 20 present
      expect(byId('finance_guru'), 'unlocked'); // 1000000
      expect(byId('payments_streak'), 'unlocked'); // 10 to'lov
      expect(byId('face_champion'), 'locked'); // 0 face
    });

    test('levelProgress oraliq darajada 0..1', () {
      // 100 ball → level 2, start 100, next 250 → progress 0.0
      final atStart = service.compute(
        attendance: List.generate(10, (_) => _entry(status: 'present')),
        payments: const [],
        studentCount: 0,
        teacherCount: 0,
        groupCount: 0,
        totalCollected: 0,
      );
      expect(atStart.level, 2);
      expect(atStart.levelProgress, 0.0);

      // 175 ball → level 2, (175-100)/(250-100) = 0.5
      // 17 present (+170) + 1 completed payment (+5) = 175
      final mid = service.compute(
        attendance: List.generate(17, (_) => _entry(status: 'present')),
        payments: [_payment(status: PaymentStatus.completed, amount: 500000)],
        studentCount: 0,
        teacherCount: 0,
        groupCount: 0,
        totalCollected: 0,
      );
      expect(mid.points, 175);
      expect(mid.level, 2);
      expect(mid.levelProgress, closeTo(0.5, 0.0001));
    });
  });
}
