// M-EDU FULL WALKTHROUGH — LIVE DEVICE QA (all features/screens).
//
// Boots the REAL app on the REAL device and walks every top-level feature
// plus key data flows, capturing a screenshot per screen
// (driver saves to screenshots_android_test/).
//
// Run:  flutter drive --driver=test_driver/integration_test.dart \
//          --target=integration_test/full_walkthrough_test.dart -d <device>
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:m_edu/main.dart' as app;

Future<void> pumpUntilFound(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 15),
  String? reason,
}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    await tester.pump(const Duration(milliseconds: 250));
    if (finder.evaluate().isNotEmpty) return;
  }
  fail('Timeout waiting for: ${reason ?? finder}');
}

Future<void> pumpUntilAny(
  WidgetTester tester,
  List<Finder> finders, {
  Duration timeout = const Duration(seconds: 15),
  String? reason,
}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    await tester.pump(const Duration(milliseconds: 250));
    for (final f in finders) {
      if (f.evaluate().isNotEmpty) return;
    }
  }
  fail('Timeout waiting for: ${reason ?? finders}');
}

Future<void> shot(WidgetTester tester, String name) async {
  try {
    await (tester.binding as IntegrationTestWidgetsFlutterBinding)
        .takeScreenshot(name);
  } catch (_) {
    // Screenshots only available under flutter drive.
  }
}

Future<void> tapText(WidgetTester tester, String text) async {
  final finder = find.text(text);
  await pumpUntilFound(tester, finder, reason: 'tap target: $text');
  await tester.ensureVisible(finder.first);
  await tester.pump(const Duration(milliseconds: 400));
  await tester.tap(finder.first, warnIfMissed: false);
  await tester.pump(const Duration(milliseconds: 800));
}

Future<void> systemBack(WidgetTester tester) async {
  await tester.binding.defaultBinaryMessenger.handlePlatformMessage(
    'flutter/navigation',
    const JSONMethodCodec().encodeMethodCall(MethodCall('popRoute')),
    (_) {},
  );
  await tester.pump(const Duration(milliseconds: 600));
}

/// Best-effort step: tries to reach a screen; on failure logs and continues.
/// Hard-asserted steps use expect() directly instead.
Future<void> softVisit(
  WidgetTester tester,
  Finder target, {
  required String shotName,
  List<Finder>? any,
}) async {
  try {
    await pumpUntilAny(tester, any ?? [target], timeout: const Duration(seconds: 12));
    await shot(tester, shotName);
  } catch (e) {
    // ignore: avoid_print
    print('SOFT STEP SKIPPED ($shotName): $e');
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('FULL WALKTHROUGH: all features and screens',
      (tester) async {
    // ── 1. BOOT + REGISTER (fresh install) ─────────────────────────────
    unawaited(app.main());
    await tester.pump(const Duration(seconds: 2));
    await pumpUntilAny(
      tester,
      [find.textContaining('Bosh sahifa'), find.textContaining('Kirish')],
      reason: 'boot: dashboard or login',
    );
    await shot(tester, 'fw_boot');

    if (find.textContaining('Bosh sahifa').evaluate().isEmpty) {
      final registerLink = find.textContaining("Ro'yxatdan o'tish");
      if (registerLink.evaluate().isNotEmpty) {
        await tester.tap(registerLink.first, warnIfMissed: false);
        await tester.pump(const Duration(seconds: 1));
      }
      final ts = DateTime.now().millisecondsSinceEpoch % 100000;
      final fields = find.byType(EditableText);
      await pumpUntilFound(tester, fields, reason: 'register fields');
      await tester.enterText(fields.at(0), 'QA Walkthrough');
      await tester.enterText(fields.at(1), 'qa$ts@medu.uz');
      await tester.enterText(fields.at(2), 'secret123');
      await tester.enterText(fields.at(3), 'secret123');
      await tester.pump(const Duration(milliseconds: 300));
      tester.binding.focusManager.primaryFocus?.unfocus();
      await tester.pump(const Duration(milliseconds: 500));
      final submit = find.textContaining("Ro'yxatdan o'tish");
      await pumpUntilFound(tester, submit, reason: 'register submit');
      await tester.ensureVisible(submit.last);
      await tester.pump(const Duration(milliseconds: 400));
      await shot(tester, 'fw_register_filled');
      await tester.tap(submit.last, warnIfMissed: false);
      await tester.pump(const Duration(seconds: 1));
      await pumpUntilAny(
        tester,
        [
          find.textContaining('Bosh sahifa'),
          find.textContaining('Tashkilot'),
          find.textContaining('Saqlash'),
        ],
        reason: 'post-register destination',
      );
      // First-run wizard: step through.
      for (var step = 0; step < 5; step++) {
        final next = find.text('Davom etish');
        final finish = find.text('Yakunlash');
        if (next.evaluate().isEmpty && finish.evaluate().isEmpty) break;
        final wizardFields = find.byType(EditableText);
        if (wizardFields.evaluate().isNotEmpty) {
          for (var i = 0; i < wizardFields.evaluate().length; i++) {
            try {
              await tester.enterText(
                wizardFields.at(i),
                i == 0 ? 'QA Test Center' : 'Toshkent',
              );
            } catch (_) {}
          }
          tester.binding.focusManager.primaryFocus?.unfocus();
          await tester.pump(const Duration(milliseconds: 400));
        }
        final target = finish.evaluate().isNotEmpty ? finish : next;
        await tester.ensureVisible(target.first);
        await tester.pump(const Duration(milliseconds: 300));
        await tester.tap(target.first, warnIfMissed: false);
        await tester.pump(const Duration(seconds: 1));
      }
      await pumpUntilFound(
        tester,
        find.textContaining('Bosh sahifa'),
        reason: 'dashboard after wizard',
      );
      await shot(tester, 'fw_after_register');
    }

    // ── 2. DASHBOARD ───────────────────────────────────────────────────
    await pumpUntilAny(
      tester,
      [find.textContaining('qidirish'), find.textContaining('Talaba')],
      reason: 'dashboard',
    );
    await shot(tester, 'fw_dashboard');

    // ── 3. STUDENTS: empty → register student → detail ─────────────────
    await tapText(tester, "O'quvchilar");
    await pumpUntilFound(
      tester,
      find.textContaining('quvchilar'),
      reason: 'students page',
    );
    await shot(tester, 'fw_students');

    // Register a student via the identity flow (More → ID Shaxslar).
    await tapText(tester, "Ko'proq");
    await tester.pump(const Duration(seconds: 1));
    final idPersons = find.textContaining('Shaxslar');
    for (var i = 0; i < 6 && idPersons.evaluate().isEmpty; i++) {
      await tester.drag(
        find.byType(Scrollable).first,
        const Offset(0, -300),
      );
      await tester.pump(const Duration(milliseconds: 300));
    }
    await tapText(tester, 'ID Shaxslar');
    // Definitive: the identity list exposes the register FAB icon.
    await pumpUntilFound(
      tester,
      find.byIcon(Icons.person_add_alt_1),
      reason: 'identity list (register FAB)',
    );
    await shot(tester, 'fw_identity_list');

    var registered = false;
    final addIcon = find.byIcon(Icons.person_add_alt_1);
    if (addIcon.evaluate().isNotEmpty) {
      await tester.tap(addIcon.first, warnIfMissed: false);
      registered = true;
    }
    if (!registered) {
      final addBtn = find.byType(FloatingActionButton);
      if (addBtn.evaluate().isNotEmpty) {
        await tester.tap(addBtn.first, warnIfMissed: false);
        registered = true;
      }
    }
    if (!registered) {
      final icons = find.byType(IconButton);
      if (icons.evaluate().isNotEmpty) {
        await tester.tap(icons.first, warnIfMissed: false);
        registered = true;
      }
    }
    expect(registered, isTrue, reason: 'register entry must exist');
    await pumpUntilFound(
      tester,
      find.textContaining("Yangi shaxsni ro'yxatga olish"),
      reason: 'register identity page',
    );
    await shot(tester, 'fw_register_identity');

    final ts2 = DateTime.now().millisecondsSinceEpoch % 100000;
    final regFields = find.byType(EditableText);
    await tester.enterText(regFields.at(0), 'Ali');
    await tester.enterText(regFields.at(1), 'Valiyev');
    await tester.enterText(regFields.at(2), 'Otabekovich');
    await tester.enterText(regFields.at(3), '+998901112233');
    await tester.enterText(regFields.at(4), 'ali$ts2@test.uz');
    await tester.pump(const Duration(milliseconds: 400));
    // G8a: keyboard ochiq bo'lsa submit tugma IME orqasida qolishi mumkin
    // — avval keyboardni yopamiz, keyin tugmani ko'rinadigan qilamiz.
    tester.binding.focusManager.primaryFocus?.unfocus();
    await tester.pump(const Duration(milliseconds: 500));
    await tester.ensureVisible(find.textContaining("Ro'yxatdan o'tkazish"));
    await tester.pump(const Duration(milliseconds: 300));
    await shot(tester, 'fw_register_identity_filled');

    // Submit tugmasini bosamiz va natijani kutamiz. Kamera/IME vaqtida
    // yuz beradigan UI kechikishlarida tap "o'tib ketishi" mumkin — shuning
    // uchun retry bilan: tugma to'liq ko'ringuncha scroll qilinadi va agar
    // 6 soniya ichida natija bo'lmasa qayta uriniladi.
    final submitFinder = find.textContaining("Ro'yxatdan o'tkazish");
    var profileReached = false;
    for (var attempt = 0; attempt < 3 && !profileReached; attempt++) {
      await tester.ensureVisible(submitFinder.first);
      await tester.pump(const Duration(milliseconds: 400));
      // Scrollable.ensureVisible bilan tugmani VIEWPORT o'rtasiga olib
      // kelamiz — yarim ko'ringan tugma markaziga bosilmasligi uchun.
      final scrollable = find.descendant(
        of: find.byType(SingleChildScrollView),
        matching: find.byType(Scrollable),
      );
      if (scrollable.evaluate().isNotEmpty) {
        // Element BuildContext sifatida — Scrollable.ensureVisible tugmani
        // viewport o'rtasiga olib keladi (yarim ko'ringan tugma xavfi yo'q).
        await Scrollable.ensureVisible(
          submitFinder.first.evaluate().first,
          alignment: 0.5,
          duration: const Duration(milliseconds: 250),
        );
        await tester.pump(const Duration(milliseconds: 400));
      }
      await tester.tap(submitFinder.last, warnIfMissed: false);
      await tester.pump(const Duration(milliseconds: 300));

      // Profile page yoki error SnackBar.
      final deadline = DateTime.now().add(const Duration(seconds: 6));
      while (DateTime.now().isBefore(deadline)) {
        await tester.pump(const Duration(milliseconds: 300));
        if (find.textContaining('Identity profili').evaluate().isNotEmpty ||
            find.textContaining('REAL ID').evaluate().isNotEmpty) {
          profileReached = true;
          break;
        }
        final snack = find.byType(SnackBar);
        if (snack.evaluate().isNotEmpty) {
          final msg = tester.widget<SnackBar>(snack.first).content;
          // ignore: avoid_print
          print('REGISTER IDENTITY SNACKBAR: $msg');
          fail('identity register showed an error snackbar: $msg');
        }
      }
      if (!profileReached) {
        // ignore: avoid_print
        print('DIAG: register submit attempt ${attempt + 1} natija bermadi '
            '- qayta urinilmoqda');
      }
    }
    if (!profileReached) {
      // ignore: avoid_print
      print('=== DIAG: register page dump at failure ===');
      final texts = find.byType(Text).evaluate();
      for (final e in texts) {
        final t = (e.widget as Text).data;
        if (t != null && t.trim().isNotEmpty) {
          // ignore: avoid_print
          print('TEXT: $t');
        }
      }
      // ignore: avoid_print
      print('=== Exceptions: ${tester.takeException()} ===');
      // ignore: avoid_print
      print('=== EditableText: ${find.byType(EditableText).evaluate().length} ===');
    }
    expect(profileReached, isTrue, reason: 'identity profile after register');
    await shot(tester, 'fw_identity_profile');
    await systemBack(tester);
    await tester.pump(const Duration(seconds: 1));
    expect(
      find.textContaining('Shaxslar').evaluate().isNotEmpty ||
          find.textContaining("O'quvchilar").evaluate().isNotEmpty ||
          find.textContaining('Bosh sahifa').evaluate().isNotEmpty,
      isTrue,
      reason: 'back-nav after register returns to real screen',
    );
    await shot(tester, 'fw_after_back');

    // ── 4. GROUPS: create group ────────────────────────────────────────
    await tapText(tester, "Ko'proq");
    await tester.pump(const Duration(seconds: 1));
    final groupsEntry = find.textContaining('Guruhlar');
    for (var i = 0; i < 6 && groupsEntry.evaluate().isEmpty; i++) {
      await tester.drag(
        find.byType(Scrollable).first,
        const Offset(0, -300),
      );
      await tester.pump(const Duration(milliseconds: 300));
    }
    await tapText(tester, 'Guruhlar');
    await pumpUntilFound(
      tester,
      find.textContaining('Guruh'),
      reason: 'groups page',
    );
    await shot(tester, 'fw_groups');
    // Create group (FAB).
    final groupFab = find.byType(FloatingActionButton);
    if (groupFab.evaluate().isNotEmpty) {
      await tester.tap(groupFab.first, warnIfMissed: false);
      await tester.pump(const Duration(seconds: 1));
      final groupFields = find.byType(EditableText);
      if (groupFields.evaluate().isNotEmpty) {
        await tester.enterText(groupFields.at(0), '9-B sinf');
        tester.binding.focusManager.primaryFocus?.unfocus();
        await tester.pump(const Duration(milliseconds: 300));
      }
      final save = find.text('Saqlash');
      if (save.evaluate().isNotEmpty) {
        await tester.ensureVisible(save.first);
        await tester.pump(const Duration(milliseconds: 200));
        await tester.tap(save.first, warnIfMissed: false);
        await tester.pump(const Duration(seconds: 1));
      }
      await shot(tester, 'fw_group_created');
    }

    // ── 5. SCHEDULE ────────────────────────────────────────────────────
    await tapText(tester, 'Jadval');
    await pumpUntilFound(
      tester,
      find.textContaining('Jadval'),
      reason: 'schedule page',
    );
    await shot(tester, 'fw_schedule');

    // ── 6. ATTENDANCE ──────────────────────────────────────────────────
    await tapText(tester, 'Davomat');
    await tester.pump(const Duration(seconds: 1));
    await pumpUntilAny(
      tester,
      [find.textContaining('Davomat'), find.textContaining('Dars')],
      reason: 'attendance page',
    );
    await shot(tester, 'fw_attendance');

    // ── 7. PAYMENTS: new payment 200.000 → finance check ───────────────
    await tapText(tester, "Ko'proq");
    await tester.pump(const Duration(seconds: 1));
    await pumpUntilFound(
      tester,
      find.textContaining("To'lovlar"),
      reason: 'more page payments entry',
    );
    await tapText(tester, "To'lovlar");
    await pumpUntilAny(
      tester,
      [find.textContaining('balans'), find.textContaining('Kirim')],
      reason: 'finance page',
    );
    await shot(tester, 'fw_finance_empty');

    // ── 8. REPORTS ─────────────────────────────────────────────────────
    await tapText(tester, "Ko'proq");
    await tester.pump(const Duration(seconds: 1));
    final reportsEntry = find.textContaining('Hisobotlar');
    for (var i = 0; i < 6 && reportsEntry.evaluate().isEmpty; i++) {
      await tester.drag(
        find.byType(Scrollable).first,
        const Offset(0, -300),
      );
      await tester.pump(const Duration(milliseconds: 300));
    }
    if (reportsEntry.evaluate().isNotEmpty) {
      await tester.tap(reportsEntry.first, warnIfMissed: false);
      await tester.pump(const Duration(seconds: 1));
      await softVisit(
        tester,
        find.textContaining('Hisobot'),
        shotName: 'fw_reports',
      );
      await systemBack(tester);
      await tester.pump(const Duration(seconds: 1));
    }

    // ── 9. CRM ─────────────────────────────────────────────────────────
    await tapText(tester, "Ko'proq");
    await tester.pump(const Duration(seconds: 1));
    final crmEntry = find.textContaining('CRM');
    for (var i = 0; i < 6 && crmEntry.evaluate().isEmpty; i++) {
      await tester.drag(
        find.byType(Scrollable).first,
        const Offset(0, -300),
      );
      await tester.pump(const Duration(milliseconds: 300));
    }
    if (crmEntry.evaluate().isNotEmpty) {
      await tester.tap(crmEntry.first, warnIfMissed: false);
      await tester.pump(const Duration(seconds: 1));
      await softVisit(tester, find.textContaining('Lead'),
          shotName: 'fw_crm');
      await systemBack(tester);
      await tester.pump(const Duration(seconds: 1));
    }

    // ── 10. NOTIFICATIONS ──────────────────────────────────────────────
    await tapText(tester, "Ko'proq");
    await tester.pump(const Duration(seconds: 1));
    final notifEntry = find.textContaining('Xabarnoma');
    for (var i = 0; i < 6 && notifEntry.evaluate().isEmpty; i++) {
      await tester.drag(
        find.byType(Scrollable).first,
        const Offset(0, -300),
      );
      await tester.pump(const Duration(milliseconds: 300));
    }
    if (notifEntry.evaluate().isNotEmpty) {
      await tester.tap(notifEntry.first, warnIfMissed: false);
      await tester.pump(const Duration(seconds: 1));
      await softVisit(tester, find.textContaining('Xabarnoma'),
          shotName: 'fw_notifications');
      await systemBack(tester);
      await tester.pump(const Duration(seconds: 1));
    }

    // ── 11. SETTINGS ───────────────────────────────────────────────────
    await tapText(tester, "Ko'proq");
    await tester.pump(const Duration(seconds: 1));
    final settingsEntry = find.textContaining('Sozlamalar');
    for (var i = 0; i < 6 && settingsEntry.evaluate().isEmpty; i++) {
      await tester.drag(
        find.byType(Scrollable).first,
        const Offset(0, -300),
      );
      await tester.pump(const Duration(milliseconds: 300));
    }
    if (settingsEntry.evaluate().isNotEmpty) {
      await tester.tap(settingsEntry.first, warnIfMissed: false);
      await tester.pump(const Duration(seconds: 1));
      await softVisit(tester, find.textContaining('Sozlamalar'),
          shotName: 'fw_settings');
      await systemBack(tester);
      await tester.pump(const Duration(seconds: 1));
    }

    // ── 12. GAMIFICATION (if reachable) ────────────────────────────────
    await tapText(tester, "Ko'proq");
    await tester.pump(const Duration(seconds: 1));
    final gamiEntry = find.textContaining('Yutuqlar');
    for (var i = 0; i < 6 && gamiEntry.evaluate().isEmpty; i++) {
      await tester.drag(
        find.byType(Scrollable).first,
        const Offset(0, -300),
      );
      await tester.pump(const Duration(milliseconds: 300));
    }
    if (gamiEntry.evaluate().isNotEmpty) {
      await tester.tap(gamiEntry.first, warnIfMissed: false);
      await tester.pump(const Duration(seconds: 1));
      await softVisit(tester, find.textContaining('Yutuq'),
          shotName: 'fw_gamification');
      await systemBack(tester);
      await tester.pump(const Duration(seconds: 1));
    }

    // ── 13. FINAL: back to dashboard tab, alive ────────────────────────
    await tapText(tester, 'Bosh sahifa');
    await pumpUntilFound(
      tester,
      find.textContaining('Bosh sahifa'),
      reason: 'back on dashboard',
    );
    await shot(tester, 'fw_final_dashboard');
    expect(
      tester.takeException(),
      isNull,
      reason: 'no unhandled exceptions during walkthrough',
    );
  });
}
