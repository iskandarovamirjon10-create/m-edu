import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/auth/login_throttle.dart';
// ThrottleStorage is already exported from login_throttle.dart

/// Brute-force himoyasi (transformation mission Phase 9):
/// progressiv blokirovka + vaqtinchalik lockout, injectable clock bilan.
///
/// P1-002: Saqlash (persistence) testlari qo'shildi — flutter_secure_storage
/// mock bilan.
void main() {
  group('LoginThrottle', () {
    test('boshlang\'ich holat — ruxsat beriladi', () {
      final throttle = LoginThrottle();
      expect(throttle.check('a@b.uz').allowed, isTrue);
      expect(throttle.failureCount('a@b.uz'), 0);
    });

    test('maxFailures gacha ruxsat, keyin blokirovka', () {
      final clock = _TestClock();
      final throttle = LoginThrottle(
        maxFailures: 3,
        lockoutDuration: const Duration(minutes: 5),
        clock: clock.now,
      );
      const key = 'a@b.uz';

      throttle.recordFailure(key);
      throttle.recordFailure(key);
      expect(throttle.check(key).allowed, isTrue);
      expect(throttle.failureCount(key), 2);

      // 3-chi xato — blok.
      throttle.recordFailure(key);
      final gate = throttle.check(key);
      expect(gate.allowed, isFalse);
      expect(gate.retryAfter, const Duration(minutes: 5));
    });

    test('blok tugagach yana ruxsat (lockout muddati o\'tdi)', () {
      final clock = _TestClock();
      final throttle = LoginThrottle(
        maxFailures: 2,
        lockoutDuration: const Duration(minutes: 5),
        clock: clock.now,
      );
      const key = 'a@b.uz';

      throttle.recordFailure(key);
      throttle.recordFailure(key);
      expect(throttle.check(key).allowed, isFalse);

      // 6 daqiqa o'tdi — blok tugadi, hisob tozalandi.
      clock.advance(const Duration(minutes: 6));
      expect(throttle.check(key).allowed, isTrue);
      expect(throttle.failureCount(key), 0);
    });

    test('muvaffaqiyatli kirish hisobni tozalaydi', () async {
      final throttle = LoginThrottle(maxFailures: 3);
      const key = 'a@b.uz';

      throttle.recordFailure(key);
      throttle.recordFailure(key);
      expect(throttle.failureCount(key), 2);

      await throttle.recordSuccess(key);
      expect(throttle.failureCount(key), 0);
      expect(throttle.check(key).allowed, isTrue);
    });

    test('window ichida yangi xato bo\'lmasa hisob tozalanadi', () {
      final clock = _TestClock();
      final throttle = LoginThrottle(
        maxFailures: 3,
        window: const Duration(minutes: 15),
        clock: clock.now,
      );
      const key = 'a@b.uz';

      throttle.recordFailure(key);
      throttle.recordFailure(key);

      // 16 daqiqa o'tdi — oyna tugadi.
      clock.advance(const Duration(minutes: 16));
      expect(throttle.failureCount(key), 0);
      throttle.recordFailure(key);
      expect(throttle.failureCount(key), 1);
    });

    test('blokda qolgan vaqt retryAfter sifatida qaytariladi', () {
      final clock = _TestClock();
      final throttle = LoginThrottle(
        maxFailures: 2,
        lockoutDuration: const Duration(minutes: 5),
        clock: clock.now,
      );
      const key = 'a@b.uz';

      throttle.recordFailure(key);
      throttle.recordFailure(key);
      expect(throttle.check(key).allowed, isFalse);

      clock.advance(const Duration(minutes: 2));
      final gate = throttle.check(key);
      expect(gate.allowed, isFalse);
      expect(gate.retryAfter, const Duration(minutes: 3));
    });

    test('turli email hisoblari mustaqil', () {
      final throttle = LoginThrottle(maxFailures: 1);
      throttle.recordFailure('a@b.uz');
      expect(throttle.check('a@b.uz').allowed, isFalse);
      expect(throttle.check('c@d.uz').allowed, isTrue);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // P1-002: Persistent LoginThrottle tests
  // ══════════════════════════════════════════════════════════════════════

  group('LoginThrottle — P1-002 Persistence', () {
    test('saqlangan holat yuklanadi — 5 xatodan keyin restart', () async {
      final clock = _TestClock();
      final fakeStorage = _FakeThrottleStorage();

      // Birinchi sessiya: 3 xato qilamiz (maxFailures=5)
      final throttle1 = LoginThrottle(
        maxFailures: 5,
        lockoutDuration: const Duration(minutes: 5),
        clock: clock.now,
        storage: fakeStorage,
      );
      throttle1.recordFailure('user@test.com');
      throttle1.recordFailure('user@test.com');
      throttle1.recordFailure('user@test.com');
      expect(throttle1.failureCount('user@test.com'), 3);
      expect(throttle1.check('user@test.com').allowed, isTrue);

      // App "qayta ishga tushdi" — yangi throttle, xuddi shu storage
      final throttle2 = LoginThrottle(
        maxFailures: 5,
        lockoutDuration: const Duration(minutes: 5),
        clock: clock.now,
        storage: fakeStorage,
      );
      await throttle2.loadPersistedState();

      // 3 xato saqlangan — hali bloklanmagan (5 gacha ruxsat)
      expect(throttle2.failureCount('user@test.com'), 3);
      expect(throttle2.check('user@test.com').allowed, isTrue);

      // 2 ta yana xato — bloklanishi kerak
      throttle2.recordFailure('user@test.com');
      throttle2.recordFailure('user@test.com');
      expect(throttle2.check('user@test.com').allowed, isFalse);
    });

    test('bloklangan holat restart\'dan keyin saqlanadi', () async {
      final clock = _TestClock();
      final fakeStorage = _FakeThrottleStorage();

      // 5 xato → blok
      final throttle1 = LoginThrottle(
        maxFailures: 3,
        lockoutDuration: const Duration(minutes: 5),
        clock: clock.now,
        storage: fakeStorage,
      );
      throttle1.recordFailure('user@test.com');
      throttle1.recordFailure('user@test.com');
      throttle1.recordFailure('user@test.com');
      expect(throttle1.check('user@test.com').allowed, isFalse);

      // Qayta ishga tushish
      final throttle2 = LoginThrottle(
        maxFailures: 3,
        lockoutDuration: const Duration(minutes: 5),
        clock: clock.now,
        storage: fakeStorage,
      );
      await throttle2.loadPersistedState();

      // Blok hali amal qiladi (lockout muddati o'tmagan)
      expect(throttle2.check('user@test.com').allowed, isFalse);
    });

    test('lockout muddati o\'tgandan keyin restart — blok ochiladi', () async {
      final clock = _TestClock();
      final fakeStorage = _FakeThrottleStorage();

      final throttle1 = LoginThrottle(
        maxFailures: 3,
        lockoutDuration: const Duration(minutes: 5),
        clock: clock.now,
        storage: fakeStorage,
      );
      throttle1.recordFailure('user@test.com');
      throttle1.recordFailure('user@test.com');
      throttle1.recordFailure('user@test.com');
      expect(throttle1.check('user@test.com').allowed, isFalse);

      // 6 daqiqa o'tdi
      clock.advance(const Duration(minutes: 6));

      // Qayta ishga tushish — blok o'tgan
      final throttle2 = LoginThrottle(
        maxFailures: 3,
        lockoutDuration: const Duration(minutes: 5),
        clock: clock.now,
        storage: fakeStorage,
      );
      await throttle2.loadPersistedState();

      // Blok ochilgan — xatolar ham tozalangan
      expect(throttle2.check('user@test.com').allowed, isTrue);
      expect(throttle2.failureCount('user@test.com'), 0);
    });

    test('muvaffaqiyatli kirish hisobni tozalaydi va saqlaydi', () async {
      final clock = _TestClock();
      final fakeStorage = _FakeThrottleStorage();

      final throttle = LoginThrottle(
        maxFailures: 5,
        clock: clock.now,
        storage: fakeStorage,
      );
      throttle.recordFailure('user@test.com');
      throttle.recordFailure('user@test.com');
      expect(throttle.failureCount('user@test.com'), 2);

      await throttle.recordSuccess('user@test.com');
      expect(throttle.failureCount('user@test.com'), 0);

      // Saqlangan holatdan tekshirish
      final throttle2 = LoginThrottle(
        maxFailures: 5,
        clock: clock.now,
        storage: fakeStorage,
      );
      await throttle2.loadPersistedState();
      expect(throttle2.failureCount('user@test.com'), 0);
    });

    test('buzilgan saqlangan holat — xavfsiz (default qiymatlar)', () async {
      final fakeStorage = _FakeThrottleStorage();
      fakeStorage.data['m_edu_login_throttle_v1'] = '{invalid json!!!';

      final throttle = LoginThrottle(
        maxFailures: 3,
        storage: fakeStorage,
      );

      // Xato tashlanmaydi — default holat qaytariladi
      await throttle.loadPersistedState();
      expect(throttle.check('user@test.com').allowed, isTrue);
      expect(throttle.failureCount('user@test.com'), 0);
    });

    test('oyna tugagan saqlangan holat — xavfsiz yuklanadi', () async {
      final clock = _TestClock();
      final fakeStorage = _FakeThrottleStorage();

      // Eski holat (16 daqiqa oldin)
      fakeStorage.data['m_edu_login_throttle_v1'] = '{'
          '"user@test.com": {'
          '  "failures": 4,'
          '  "lastFailureAt": "${clock.now().subtract(const Duration(minutes: 16)).toIso8601String()}",'
          '  "lockedUntil": null'
          '}'
          '}';

      final throttle = LoginThrottle(
        maxFailures: 5,
        window: const Duration(minutes: 15),
        clock: clock.now,
        storage: fakeStorage,
      );
      await throttle.loadPersistedState();

      // Oyna tugagan — eski hisob e'tiborga olinmaydi
      expect(throttle.failureCount('user@test.com'), 0);
      expect(throttle.check('user@test.com').allowed, isTrue);
    });

    test('parol/plaintext hech qachon saqlanmaydi', () async {
      final fakeStorage = _FakeThrottleStorage();
      final throttle = LoginThrottle(
        storage: fakeStorage,
      );
      throttle.recordFailure('user@test.com');

      final stored = fakeStorage.data['m_edu_login_throttle_v1'] ?? '';
      // Faqat kalitlar, failures, vaqt — parol yo'q
      expect(stored, isNot(contains('password')));
      expect(stored, isNot(contains('parol')));
    });
  });
}

class _TestClock {
  DateTime _now = DateTime(2026, 8, 17, 12, 0, 0);

  DateTime now() => _now;

  void advance(Duration d) => _now = _now.add(d);
}

/// P1-002: ThrottleStorage mock — testlarda ishlatiladi.
///
/// Saqlash/O'qish operatsiyalari oddiy Map'da amalga oshiriladi.
/// Parol/plaintext saqlanmasligini tekshirish uchun ishlatiladi.
class _FakeThrottleStorage implements ThrottleStorage {
  final Map<String, String> data = {};

  @override
  Future<String?> read({required String key}) async => data[key];
  @override
  Future<void> write({required String key, required String? value}) async {
    if (value != null) {
      data[key] = value;
    }
  }
}
