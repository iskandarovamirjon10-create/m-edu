// M-EDU LIVE DEVICE QA — integration test suite.
//
// Runs the REAL app (main.dart, real Isar DB on device, real providers)
// on the REAL Android device and drives it like a user:
//   boot → (register if needed) → dashboard → students → student detail →
//   search → finance → rapid tab switching → BACK-NAV REGRESSION (BUG-001).
//
// Run:  flutter drive --driver=test_driver/integration_test.dart \
//          --target=integration_test/live_qa_test.dart -d <device-id>
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:m_edu/main.dart' as app;

/// Pumps frames until [finder] matches or [timeout] elapses.
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

/// Simulates the Android system back button (go_router popRoute).
Future<void> systemBack(WidgetTester tester) async {
  await tester.binding.defaultBinaryMessenger.handlePlatformMessage(
    'flutter/navigation',
    const JSONMethodCodec().encodeMethodCall(
      MethodCall('popRoute'),
    ),
    (_) {},
  );
  await tester.pump(const Duration(milliseconds: 600));
}

/// Snap a screenshot (saved by the driver to screenshots_android_test/).
Future<void> shot(WidgetTester tester, String name) async {
  try {
    await (tester.binding as IntegrationTestWidgetsFlutterBinding)
        .takeScreenshot(name);
  } catch (_) {
    // Screenshots only available under flutter drive.
  }
}

/// Pumps until ANY of the finders matches.
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

Future<void> tapText(WidgetTester tester, String text) async {
  final finder = find.text(text);
  await pumpUntilFound(tester, finder, reason: 'tap target: $text');
  await tester.tap(finder.first, warnIfMissed: false);
  await tester.pump(const Duration(milliseconds: 800));
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('LIVE QA: boot → main screens → data → back-nav regression',
      (tester) async {
    // ── 1. BOOT the real app ───────────────────────────────────────────
    unawaited(app.main());
    await tester.pump(const Duration(seconds: 2));

    // Wait for either the dashboard (authenticated) or the login page.
    final dashboardFinder = find.textContaining('Bosh sahifa');
    final deadline = DateTime.now().add(const Duration(seconds: 20));
    var onDashboard = false;
    while (DateTime.now().isBefore(deadline)) {
      await tester.pump(const Duration(milliseconds: 300));
      if (dashboardFinder.evaluate().isNotEmpty) {
        onDashboard = true;
        break;
      }
      if (find.textContaining('Kirish').evaluate().isNotEmpty ||
          find.textContaining('Yangi hisob').evaluate().isNotEmpty) {
        break; // login/register page
      }
    }
    await shot(tester, 'it_boot');

    // ── 2. If unauthenticated → register a fresh account ───────────────
    if (!onDashboard) {
      // Navigate to register if on login.
      final registerLink = find.textContaining("Ro'yxatdan o'tish");
      if (registerLink.evaluate().isNotEmpty) {
        await tester.tap(registerLink.first, warnIfMissed: false);
        await tester.pump(const Duration(seconds: 1));
      }
      final ts = DateTime.now().millisecondsSinceEpoch % 100000;
      // Name field (first EditText on register page).
      final fields = find.byType(EditableText);
      await pumpUntilFound(tester, fields, reason: 'register fields');
      await tester.enterText(fields.at(0), 'Test Admin');
      await tester.enterText(fields.at(1), 'admin$ts@medu.uz');
      await tester.enterText(fields.at(2), 'secret123');
      await tester.enterText(fields.at(3), 'secret123');
      await tester.pump(const Duration(milliseconds: 300));
      await shot(tester, 'it_register_filled');
      // Dismiss the keyboard and scroll the submit button into view
      // (it sits below the fold when the IME is open).
      tester.binding.focusManager.primaryFocus?.unfocus();
      await tester.pump(const Duration(milliseconds: 500));
      // NOTE: the AUTH register button reads "Ro'yxatdan o'tish" (same as
      // the login link) — the "...o'tkazish" label is the IDENTITY form.
      final submit = find.textContaining("Ro'yxatdan o'tish");
      await pumpUntilFound(tester, submit, reason: 'register submit button');
      await tester.ensureVisible(submit.last);
      await tester.pump(const Duration(milliseconds: 400));
      await shot(tester, 'it_register_filled_scrolled');
      await tester.tap(submit.last, warnIfMissed: false);
      await tester.pump(const Duration(seconds: 1));
      // Registration → setup wizard or dashboard.
      await pumpUntilAny(
        tester,
        [
          find.textContaining('Bosh sahifa'),
          find.textContaining('Tashkilot'),
          find.textContaining('Saqlash'),
        ],
        reason: 'post-register destination',
      );
      // First-run organization wizard: fill fields and step through.
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
                i == 0 ? 'Test Education Center' : 'Toshkent',
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
        reason: 'dashboard after register + wizard',
      );
      await shot(tester, 'it_after_register');
    }

    // ── 3. DASHBOARD: search field present ─────────────────────────────
    await pumpUntilAny(
      tester,
      [
        find.textContaining('qidirish'),
        find.textContaining('Talaba'),
      ],
      reason: 'dashboard search',
    );
    await shot(tester, 'it_dashboard');

    // ── 4. STUDENTS TAB ────────────────────────────────────────────────
    await tapText(tester, "O'quvchilar");
    await pumpUntilFound(
      tester,
      find.textContaining('quvchilar'),
      reason: 'students page',
    );
    await shot(tester, 'it_students');

    // ── 5. RAPID TAB SWITCHING (stress) ────────────────────────────────
    for (var i = 0; i < 4; i++) {
      for (final label in ['Davomat', 'Jadval', "Ko'proq", "O'quvchilar"]) {
        final f = find.text(label);
        if (f.evaluate().isNotEmpty) {
          await tester.tap(f.first, warnIfMissed: false);
        }
        await tester.pump(const Duration(milliseconds: 150));
      }
    }
    // App must still be alive and interactive.
    await pumpUntilFound(
      tester,
      find.textContaining('quvchilar'),
      reason: 'alive after rapid tabs',
    );
    await shot(tester, 'it_after_rapid_tabs');

    // ── 6. STUDENT DETAIL (data projection check) ──────────────────────
    final studentCard = find.textContaining('M-EDU-2026-000001');
    if (studentCard.evaluate().isNotEmpty) {
      await tester.tap(studentCard.first, warnIfMissed: false);
      await tester.pump(const Duration(seconds: 1));
      await shot(tester, 'it_student_detail');
    }

    // ── 7. FINANCE (data projection check) ─────────────────────────────
    await tapText(tester, "Ko'proq");
    await tester.pump(const Duration(seconds: 1));
    await pumpUntilFound(
      tester,
      find.textContaining("To'lovlar"),
      reason: 'more page',
    );
    await tapText(tester, 'To\'lovlar');
    await pumpUntilAny(
      tester,
      [
        find.textContaining('balans'),
        find.textContaining('Kirim'),
      ],
      reason: 'finance page',
    );
    await shot(tester, 'it_finance');
    // The payment of 200.000 must be visible in finance.
    expect(
      find.textContaining('200.000').evaluate().isNotEmpty,
      isTrue,
      reason: '200.000 so\'m payment must be reflected in finance',
    );

    // ── 8. BACK-NAV REGRESSION (BUG-001): after REGISTRATION, back must
    //    return to a real screen — NOT leave the app dead.
    //    (Navigate to register → submit → press system back.)
    //    Fixed via pushReplacement in register_identity_page.
    // Pop back from the finance page to the More page first.
    await systemBack(tester);
    await tester.pump(const Duration(seconds: 1));
    await pumpUntilFound(
      tester,
      find.textContaining("To'lovlar"),
      reason: 'more page (2)',
    );
    // Scroll the More page down to find ID Shaxslar → register entry.
    // Simpler deterministic path: use the students tab's register FAB.
    await tapText(tester, "O'quvchilar");
    await tester.pump(const Duration(seconds: 1));
    // Identity register is reachable from More → ID Shaxslar; the students
    // page has an add button at top-right (semantics empty). Use More route:
    await tapText(tester, "Ko'proq");
    await tester.pump(const Duration(seconds: 1));
    // Scroll down the More list until 'ID Shaxslar' is visible.
    final idPersons = find.textContaining('Shaxslar');
    for (var i = 0; i < 6 && idPersons.evaluate().isEmpty; i++) {
      await tester.drag(
        find.byType(SingleChildScrollView).first,
        const Offset(0, -300),
      );
      await tester.pump(const Duration(milliseconds: 300));
    }
    await tapText(tester, 'ID Shaxslar');
    await pumpUntilAny(
      tester,
      [
        find.textContaining("ro'yxatga olish"),
        find.textContaining('Shaxslar'),
      ],
      reason: 'identity list',
    );
    await shot(tester, 'it_identity_list');

    // Register a NEW student via the real UI.
    var registered = false;
    final addBtn = find.byTooltip('Qo\'shish');
    if (addBtn.evaluate().isNotEmpty) {
      await tester.tap(addBtn.first, warnIfMissed: false);
      registered = true;
    } else {
      final addIcon = find.byIcon(Icons.person_add_rounded);
      if (addIcon.evaluate().isNotEmpty) {
        await tester.tap(addIcon.first, warnIfMissed: false);
        registered = true;
      }
    }
    if (!registered) {
      // Last resort: tap the first IconButton in the app bar.
      final icons = find.byType(IconButton);
      if (icons.evaluate().isNotEmpty) {
        await tester.tap(icons.first, warnIfMissed: false);
        registered = true;
      }
    }
    expect(registered, isTrue, reason: 'register entry point must be found');
    await pumpUntilFound(
      tester,
      find.textContaining("Yangi shaxsni ro'yxatga olish"),
      reason: 'register identity page',
    );
    await shot(tester, 'it_register_identity');

    // Fill the form (role O'quvchi is default) and submit.
    final ts2 = DateTime.now().millisecondsSinceEpoch % 100000;
    final regFields = find.byType(EditableText);
    await tester.enterText(regFields.at(0), 'Regression');
    await tester.enterText(regFields.at(1), 'Testov');
    await tester.enterText(regFields.at(2), 'Petrovich');
    await tester.enterText(regFields.at(3), '+998901112233');
    await tester.enterText(regFields.at(4), 'reg$ts2@test.uz');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.ensureVisible(find.textContaining("Ro'yxatdan o'tkazish"));
    await tester.pump(const Duration(milliseconds: 300));
    await shot(tester, 'it_register_identity_filled');

    // Submit retry bilan: tugma to'liq ko'ringuncha scroll + agar 6 soniya
    // ichida natija bo'lmasa qayta urinish (IME/kamera UI kechikishlari).
    final submitFinder = find.textContaining("Ro'yxatdan o'tkazish");
    var profileReached = false;
    for (var attempt = 0; attempt < 3 && !profileReached; attempt++) {
      await tester.ensureVisible(submitFinder.first);
      await tester.pump(const Duration(milliseconds: 400));
      await Scrollable.ensureVisible(
        submitFinder.first.evaluate().first,
        alignment: 0.5,
        duration: const Duration(milliseconds: 250),
      );
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(submitFinder.last, warnIfMissed: false);
      await tester.pump(const Duration(milliseconds: 300));

      final deadline = DateTime.now().add(const Duration(seconds: 6));
      while (DateTime.now().isBefore(deadline)) {
        await tester.pump(const Duration(milliseconds: 300));
        if (find.textContaining('Identity profili').evaluate().isNotEmpty ||
            find.textContaining('REAL ID').evaluate().isNotEmpty) {
          profileReached = true;
          break;
        }
      }
    }

    // Wait for the identity profile page (post-registration destination).
    await pumpUntilAny(
      tester,
      [
        find.textContaining('Identity profili'),
        find.textContaining('REAL ID'),
      ],
      reason: 'identity profile after register',
    );
    await shot(tester, 'it_post_register_profile');

    // BUG-001 regression: system back MUST return to a real previous
    // screen (identity list), not leave the app with a dead stack.
    await systemBack(tester);
    await tester.pump(const Duration(seconds: 1));
    final alive = find.textContaining('Shaxslar').evaluate().isNotEmpty ||
        find.textContaining("O'quvchilar").evaluate().isNotEmpty ||
        find.textContaining('Bosh sahifa').evaluate().isNotEmpty;
    expect(alive, isTrue,
        reason: 'BUG-001: after registration, back must return to a real '
            'screen (not exit the app / dead stack)');
    await shot(tester, 'it_after_back_regression');
  });
}
