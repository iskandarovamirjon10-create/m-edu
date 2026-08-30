import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/face_recognition/presentation/widgets/recognition_status_cards.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';

/// Spec §36 (PRIVACY): UI'da raw biometric/texnik matching ma'lumotlari —
/// confidence foizi, embedding, vektor — ko'rsatilmaydi. Faqat biznes
/// holat: Ro'yxatdan o'tgan / Aniqlandi / Aniqlanmadi / Faol.
///
/// FaceScanIdentityCard tanib olingan shaxsni ko'rsatadi — lekin
/// "Ishonch darajasi: 97%" kabi texnik detal yo'q bo'lishi shart.
void main() {
  Identity identity(String id, String first, String last) => Identity(
        identityId: id,
        firstName: first,
        lastName: last,
        role: IdentityRole.student,
        status: IdentityStatus.active,
        qrSeed: 'seed-$id',
        createdAt: DateTime(2026, 1, 1),
      );

  Widget wrap(Widget child) =>
      MaterialApp(home: Scaffold(body: SingleChildScrollView(child: child)));

  testWidgets(
      "tanib olingan shaxs kartasi — confidence foizi ko'rsatilmaydi (maxfiylik)",
      (tester) async {
    await tester.pumpWidget(wrap(FaceScanIdentityCard(
      identity: identity('M-EDU-2026-000001', 'Azizbek', 'Karimov'),
      confidence: 0.97, // yuqori texnik qiymat — LEKIN UI'da yashirilishi shart
    )));
    await tester.pumpAndSettle();

    // Shaxs ma'lumotlari ko'rinadi.
    expect(find.text('Azizbek Karimov'), findsOneWidget);

    // Hech qanday % / confidence / embedding ma'lumoti yo'q.
    expect(find.textContaining('%'), findsNothing);
    expect(find.textContaining('Ishonch'), findsNothing);
    expect(find.textContaining('confidence'), findsNothing);
    expect(find.textContaining('0.97'), findsNothing);

    // Faqat biznes holat: yuz mos keldi.
    expect(find.text('Yuz mos keldi'), findsOneWidget);
  });

  testWidgets(
      "tasdiqlash jarayoni — kadr progressi ko'rinadi, foiz yo'q",
      (tester) async {
    await tester.pumpWidget(wrap(FaceScanIdentityCard(
      identity: identity('M-EDU-2026-000001', 'Azizbek', 'Karimov'),
      confidence: 0.9,
      confirmation: (3, 5),
    )));
    await tester.pumpAndSettle();

    // Barqarorlik tekshiruvi progressi — business state (ko'rsatiladi).
    expect(find.text('Barqarorlik tekshiruvi: 3/5 kadr'), findsOneWidget);
    // Foizli ishonch detalini yashirish.
    expect(find.textContaining('%'), findsNothing);
  });

  testWidgets("noaniq moslik — avtomatik yozuv yo'q, sabab aniq ko'rsatiladi",
      (tester) async {
    await tester.pumpWidget(wrap(FaceScanIdentityCard(
      identity: identity('M-EDU-2026-000001', 'Azizbek', 'Karimov'),
      confidence: 0.55,
      ambiguous: true,
    )));
    await tester.pumpAndSettle();

    expect(find.text('Noaniq moslik — yuzni to\'g\'riroq ko\'rsating'),
        findsOneWidget);
    expect(find.textContaining('%'), findsNothing);
  });
}
