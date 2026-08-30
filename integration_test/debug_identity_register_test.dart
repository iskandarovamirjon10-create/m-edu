// DIAGNOSTIC — reproduces the identity-register flow that failed in the
// full walkthrough and dumps screen state on failure.
import 'dart:async';

import 'package:flutter/material.dart';
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

void dumpVisibleTexts(WidgetTester tester, String label) {
  // ignore: avoid_print
  print('=== VISIBLE TEXTS [$label] ===');
  final texts = find.byType(Text).evaluate();
  for (final e in texts) {
    final t = (e.widget as Text).data;
    if (t != null && t.trim().isNotEmpty) {
      // ignore: avoid_print
      print('TEXT: $t');
    }
  }
  final btns = find.byType(ElevatedButton).evaluate();
  // ignore: avoid_print
  print('=== ElevatedButton count: ${btns.length} ===');
  final spinners = find.byType(CircularProgressIndicator).evaluate();
  // ignore: avoid_print
  print('=== CircularProgressIndicator count: ${spinners.length} ===');
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('DIAG: identity register flow', (tester) async {
    unawaited(app.main());
    await tester.pump(const Duration(seconds: 2));
    await pumpUntilAny(
      tester,
      [
        find.textContaining('Bosh sahifa'),
        find.textContaining('Kirish'),
        find.textContaining('Yangi hisob'),
      ],
      reason: 'boot',
    );
    dumpVisibleTexts(tester, 'boot');

    // Register an account if needed.
    if (find.textContaining('Bosh sahifa').evaluate().isEmpty) {
      final registerLink = find.textContaining("Ro'yxatdan o'tish");
      if (registerLink.evaluate().isNotEmpty) {
        await tester.tap(registerLink.first, warnIfMissed: false);
        await tester.pump(const Duration(seconds: 1));
      }
      final ts = DateTime.now().millisecondsSinceEpoch % 100000;
      final fields = find.byType(EditableText);
      await pumpUntilFound(tester, fields, reason: 'register fields');
      await tester.enterText(fields.at(0), 'QA Debug');
      await tester.enterText(fields.at(1), 'debug$ts@medu.uz');
      await tester.enterText(fields.at(2), 'secret123');
      await tester.enterText(fields.at(3), 'secret123');
      await tester.pump(const Duration(milliseconds: 300));
      tester.binding.focusManager.primaryFocus?.unfocus();
      await tester.pump(const Duration(milliseconds: 500));
      final submit = find.textContaining("Ro'yxatdan o'tish");
      await pumpUntilFound(tester, submit, reason: 'register submit');
      await tester.ensureVisible(submit.last);
      await tester.pump(const Duration(milliseconds: 400));
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
                i == 0 ? 'QA Debug Center' : 'Toshkent',
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
    }

    // Navigate to ID Shaxslar.
    await tapTo(tester, "Ko'proq");
    await tester.pump(const Duration(seconds: 1));
    final idPersons = find.textContaining('Shaxslar');
    for (var i = 0; i < 6 && idPersons.evaluate().isEmpty; i++) {
      await tester.drag(
        find.byType(Scrollable).first,
        const Offset(0, -300),
      );
      await tester.pump(const Duration(milliseconds: 300));
    }
    await tapTo(tester, 'ID Shaxslar');
    await pumpUntilFound(
      tester,
      find.byIcon(Icons.person_add_alt_1),
      reason: 'identity list FAB',
    );
    dumpVisibleTexts(tester, 'identity-list');

    await tester.tap(find.byIcon(Icons.person_add_alt_1).first,
        warnIfMissed: false);
    await tester.pump(const Duration(seconds: 1));
    await pumpUntilFound(
      tester,
      find.textContaining("Yangi shaxsni ro'yxatga olish"),
      reason: 'register identity page',
    );
    dumpVisibleTexts(tester, 'register-page');

    final ts2 = DateTime.now().millisecondsSinceEpoch % 100000;
    final regFields = find.byType(EditableText);
    // ignore: avoid_print
    print('=== EditableText count: ${regFields.evaluate().length} ===');
    await tester.enterText(regFields.at(0), 'Ali');
    await tester.enterText(regFields.at(1), 'Valiyev');
    await tester.enterText(regFields.at(2), 'Otabekovich');
    await tester.enterText(regFields.at(3), '+998901112233');
    await tester.enterText(regFields.at(4), 'ali$ts2@test.uz');
    await tester.pump(const Duration(milliseconds: 400));
    tester.binding.focusManager.primaryFocus?.unfocus();
    await tester.pump(const Duration(milliseconds: 500));
    final submitBtn = find.textContaining("Ro'yxatdan o'tkazish");
    // ignore: avoid_print
    print('=== submit matches: ${submitBtn.evaluate().length} ===');
    await tester.ensureVisible(submitBtn.first);
    await tester.pump(const Duration(milliseconds: 300));
    dumpVisibleTexts(tester, 'filled-before-tap');

    await tester.tap(submitBtn.last, warnIfMissed: false);
    await tester.pump(const Duration(milliseconds: 500));
    dumpVisibleTexts(tester, 'after-tap-500ms');

    final deadline = DateTime.now().add(const Duration(seconds: 12));
    var profileReached = false;
    while (DateTime.now().isBefore(deadline)) {
      await tester.pump(const Duration(milliseconds: 300));
      if (find.textContaining('Identity profili').evaluate().isNotEmpty ||
          find.textContaining('REAL ID').evaluate().isNotEmpty) {
        profileReached = true;
        break;
      }
    }
    dumpVisibleTexts(tester, profileReached ? 'profile-reached' : 'TIMEOUT');
    if (!profileReached) {
      final snack = find.byType(SnackBar);
      // ignore: avoid_print
      print('=== SnackBars: ${snack.evaluate().length} ===');
      // ignore: avoid_print
      print('=== Exceptions: ${tester.takeException()} ===');
    }
    expect(profileReached, isTrue, reason: 'profile after identity register');
  });
}

Future<void> tapTo(WidgetTester tester, String text) async {
  final finder = find.text(text);
  await pumpUntilFound(tester, finder, reason: 'tap target: $text');
  await tester.ensureVisible(finder.first);
  await tester.pump(const Duration(milliseconds: 400));
  await tester.tap(finder.first, warnIfMissed: false);
  await tester.pump(const Duration(milliseconds: 800));
}
