// GAPS-G5 — liveness (anti-spoofing) birlik testlari.
//
// LivenessService: ko'z ochiqlik (0..1) ketma-ketligidan blinklarni
// aniqlaydi va jonlilikni baholaydi. Fotosurat / ekran replay'i hech qachon
// blink bermaydi — shuning uchun `live` bo'lmaydi.
import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/face_recognition/domain/services/liveness_service.dart';

/// Vaqt sinovlari uchun qulay wrapper: `feed`'ni boshidan boshlab
/// millisekundlarda berilgan vaqtlarda chaqiradi.
class _Timeline {
  final LivenessService service;
  int _t = 0;

  _Timeline({LivenessConfig? config})
      : service = LivenessService(config: config ?? const LivenessConfig());

  LivenessSnapshot feed(double openness, int dtMs) {
    _t += dtMs;
    return service.feed(openness, now: DateTime.fromMillisecondsSinceEpoch(_t));
  }

  LivenessSnapshot feedAt(double openness, int absMs) {
    _t = absMs;
    return service.feed(openness, now: DateTime.fromMillisecondsSinceEpoch(_t));
  }
}

/// Odatiy blink: ochiq (0.8) → yopiq (0.1) ~150ms → ochiq (0.8).
void _blink(_Timeline tl, int startMs) {
  tl.feedAt(0.8, startMs);
  tl.feedAt(0.1, startMs + 50);
  tl.feedAt(0.1, startMs + 100);
  tl.feedAt(0.1, startMs + 150);
  tl.feedAt(0.8, startMs + 200); // yopiq 150ms — me'yorda → blink
}

void main() {
  group('LivenessService — blink detektsiyasi', () {
    test('2 blink (ochiq→yopiq→ochiq ×2) → live', () {
      final tl = _Timeline();
      _blink(tl, 0);
      _blink(tl, 1200);
      final snap = tl.service.feed(0.8, now: DateTime.fromMillisecondsSinceEpoch(1400));
      expect(snap.status, LivenessStatus.live);
      expect(snap.blinksObserved, greaterThanOrEqualTo(2));
    });

    test('doim ochiq yuz (foto replay) → hech qachon live emas, timedOut', () {
      final tl = _Timeline();
      for (var t = 0; t <= 9000; t += 100) {
        tl.feedAt(0.8, t);
      }
      final snap = tl.service.feed(0.8, now: DateTime.fromMillisecondsSinceEpoch(9100));
      expect(snap.status, LivenessStatus.timedOut);
      expect(snap.blinksObserved, 0);
    });

    test('doim yopiq yuz → live emas, timedOut', () {
      final tl = _Timeline();
      for (var t = 0; t <= 9000; t += 100) {
        tl.feedAt(0.1, t);
      }
      expect(tl.service.feed(0.1, now: DateTime.fromMillisecondsSinceEpoch(9000)).status,
          LivenessStatus.timedOut);
    });

    test('juda qisqa yopilish (40ms) → blink sanalmaydi', () {
      final tl = _Timeline();
      tl.feedAt(0.8, 0);
      tl.feedAt(0.1, 100);
      tl.feedAt(0.8, 140); // yopiq 40ms < minBlinkDuration (80ms)
      var snap = tl.service.feed(0.8, now: DateTime.fromMillisecondsSinceEpoch(140));
      expect(snap.blinksObserved, 0);
      // Ikkinchi me'yordagi blink bilan live bo'ladi.
      _blink(tl, 500);
      snap = tl.service.feed(0.8, now: DateTime.fromMillisecondsSinceEpoch(700));
      expect(snap.blinksObserved, 1);
      expect(snap.status, LivenessStatus.observing);
    });

    test('uzoq yumilish (2s) → blink emas (ko\'z yumib turish)', () {
      final tl = _Timeline();
      tl.feedAt(0.8, 0);
      for (var t = 100; t <= 2000; t += 100) {
        tl.feedAt(0.1, t);
      }
      tl.feedAt(0.8, 2100); // yopiq 2100ms > maxBlinkDuration (1200ms)
      final snap = tl.service.feed(0.8, now: DateTime.fromMillisecondsSinceEpoch(2100));
      expect(snap.blinksObserved, 0);
    });

    test('histerezis: chegara orasidagi qiymatlar holatni o\'zgartirmaydi', () {
      final tl = _Timeline();
      // 0.4..0.5 — closedThreshold (0.35) va openThreshold (0.55) orasida.
      tl.feedAt(0.45, 0);
      tl.feedAt(0.5, 100);
      tl.feedAt(0.42, 200);
      final snap = tl.service.feed(0.48, now: DateTime.fromMillisecondsSinceEpoch(300));
      expect(snap.blinksObserved, 0);
      expect(snap.eyesClosedNow, isFalse);
    });

    test('blink oynasi: 8 soniyadan eski blink hisoblanmaydi', () {
      final tl = _Timeline();
      _blink(tl, 0); // t=0..200
      // 9 soniya o'tgach yangi sessiya qadar eski blink o'chiriladi.
      final snap = tl.service.feed(0.8, now: DateTime.fromMillisecondsSinceEpoch(9500));
      expect(snap.blinksObserved, 0);
      expect(snap.status, LivenessStatus.timedOut);
    });

    test('reset sessiyani tozalaydi', () {
      final tl = _Timeline();
      _blink(tl, 0);
      _blink(tl, 500);
      expect(tl.service.feed(0.8, now: DateTime.fromMillisecondsSinceEpoch(700)).blinksObserved, 2);
      tl.service.reset();
      final snap = tl.service.feed(0.8, now: DateTime.fromMillisecondsSinceEpoch(900));
      expect(snap.blinksObserved, 0);
      expect(snap.status, LivenessStatus.observing);
    });
  });

  group('LivenessService — config', () {
    test('enabled=false → darhol live (eski xatti-harakat)', () {
      final service = LivenessService(
        config: const LivenessConfig(enabled: false),
      );
      final snap = service.feed(0.8);
      expect(snap.status, LivenessStatus.live);
    });

    test('requiredBlinks=3 → 2 blinkda hali observing', () {
      final tl = _Timeline(config: const LivenessConfig(requiredBlinks: 3));
      _blink(tl, 0);
      _blink(tl, 500);
      final snap = tl.service.feed(0.8, now: DateTime.fromMillisecondsSinceEpoch(700));
      expect(snap.status, LivenessStatus.observing);
      expect(snap.blinksObserved, 2);
      _blink(tl, 1000);
      expect(
        tl.service.feed(0.8, now: DateTime.fromMillisecondsSinceEpoch(1300)).status,
        LivenessStatus.live,
      );
    });
  });

  group('EAR geometriyasi', () {
    test('ochiq ko\'z EAR yuqori, yopiq ko\'z EAR past', () {
      // Kanonik EAR tartibi: [outer, upper1, upper2, inner, lower2,
      // lower1] — juftliklar (upper1, lower1) va (upper2, lower2) vertikal
      // bo'ladi. Ochiq ko'z: qovoqlar orasidagi masofa katta.
      const open = [
        (0.0, 0.0), // outer
        (2.5, -2.5), // upper1
        (7.5, -2.5), // upper2
        (10.0, 0.0), // inner
        (7.5, 2.5), // lower2
        (2.5, 2.5), // lower1
      ];
      // Yopiq ko'z: qovoqlar bir-biriga yaqin (past EAR).
      const closed = [
        (0.0, 0.0),
        (2.5, -0.3),
        (7.5, -0.3),
        (10.0, 0.0),
        (7.5, 0.3),
        (2.5, 0.3),
      ];
      final openEar = LivenessService.eyeAspectRatio(open);
      final closedEar = LivenessService.eyeAspectRatio(closed);
      expect(openEar, greaterThan(closedEar));
      // Ochiq ko'z ochiqlikga yuqori qiymat beradi.
      expect(
        LivenessService.opennessFromEar(openEar),
        greaterThan(LivenessService.opennessFromEar(closedEar)),
      );
    });

    test('opennessFromEar 0..1 oralig\'ida siqiladi', () {
      expect(LivenessService.opennessFromEar(0.05), lessThan(0.5));
      expect(LivenessService.opennessFromEar(0.30), closeTo(1.0, 0.001));
      // Juda katta EAR ham 1.0 dan oshmaydi.
      expect(LivenessService.opennessFromEar(1.0), 1.0);
      // Salbiy/mumkin bo'lmagan EAR 0 ga siqiladi.
      expect(LivenessService.opennessFromEar(-0.1), 0.0);
    });

    test('noto\'g\'ri nuqta soni → 0 (degenerativ)', () {
      expect(LivenessService.eyeAspectRatio(const [(0.0, 0.0), (1.0, 1.0)]), 0);
    });
  });
}
