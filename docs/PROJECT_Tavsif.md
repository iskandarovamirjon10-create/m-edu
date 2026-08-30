📚 **M-EDU — PREMIUM TA'LIM BOSHQARUV TIZIMI**
════════════════════════════════════════

📍 **Umumiy ma'lumot**
• Loyiha nomi: M-Edu (Premium Education Management System)
• Versiya: 1.0.0+1
• Platformalar: Android, Windows, Linux (Web qisman)
• Hajmi: 223 ta .dart fayl (~63 000 qator kod)
• Rejim: Offline-first (lokal baza, "No Demo Data" siyosati)
• Tuzilgan sana: 2026-08-08

🛠 **Texnologik stack (Flutter 3.27 / Dart 3.6)**
• State: flutter_riverpod 2.6.1 (StateNotifier + FutureProvider)
• Routing: go_router 14.6.2
• Baza: Isar 3.1.3 (offline local DB, 15 ta sxema)
• Yuz tanish: google_mlkit_face_detection (Android) + tflite_flutter (desktop)
• Video: media_kit (Hikvision RTSP oqim)
• Kamera: camera 0.11.0, QR: mobile_scanner 6.0.5
• Xavfsizlik: flutter_secure_storage 9.2.4, local_auth 2.3.0
• Tarmoq: dio 5.7.0, connectivity_plus 7.0.0
• Grafikalar: fl_chart 0.71.0, shimmer 3.0.0
• UI: google_fonts, flutter_svg, animations, liquid glass dizayn
• Firebase (core/auth/firestore/storage) — e'lon qilingan, lekin ulangan EMAS

🏗 **Arxitektura: Feature-first Clean Architecture**
• presentation/ — Riverpod providerlar + sahifalar (go_router)
• application/ — Command/Query (CQRS uslubi)
• domain/ — Entity, Repository interfeysi, Value Object, Event
• infrastructure/ — Isar datasource, .g.dart modellar, repository impl, xizmatlar
• DI: Riverpod providerlar (ProviderScope.overrideWithValue)
• Event bus: ichki EventBus tizimi

📁 **Fayl tuzilishi**
• lib/core/ — auth, constants, database, di, error, event_bus, router, theme
• lib/features/ — 16 ta feature moduli
• lib/shared/design_system/ — Liquid Glass UI komponentlari
• lib/l10n/ — uz/ru/en tarjimalar (hozircha ulanmagan)

✨ **FEATURES (16 ta modul)**
─────────────────────────

1️⃣ **Auth** — Kirish / ro'yxatdan o'tish
   • Splash, Login, Register sahifalari
   • Sessiya flutter_secure_storage'da saqlanadi
   ⚠️ Hozircha MOCK — har qanday email + 6 belgidan uzun parol → admin

2️⃣ **Dashboard** — Asosiy panel
   • Pastki navigatsiya (bottom bar) bilan 6 bo'limli shell
   • Statistika kartalari, tezkor amallar, oylik ko'rsatkichlar

3️⃣ **Organization** — O'quv markazini sozlash
   • First Run Wizard (birinchi ishga tushirish ustasi)
   • Tashkilot, filial, kurs, xona sozlamalari

4️⃣ **Identity** — Yagona shaxs reyestri
   • Shaxs ID generatori (M-EDU-2026-XXXXXX formatida)
   • Real ID tekshiruvi, telefon raqami value-object
   • QR kod (qrSeed), raqamli ID karta, status boshqaruvi
   • Dublikatlarni aniqlash va birlashtirish (merge)
   • Faoliyat tarixi (audit timeline)

5️⃣ **Students** — O'quvchilar
   • Ro'yxatga olish, guruhga biriktirish, transfer
   • Ota-ona ma'lumotlari (Telegram ID bilan)
   • To'lov holati, davomat foizi (attendancePercentage)

6️⃣ **Teachers** — O'qituvchilar
   • Ro'yxatga olish, ixtisoslik, ish haqi
   • Guruhlarga biriktirish, haftalik yuklama (maxWeeklyHours)

7️⃣ **Groups** — Guruhlar
   • Guruh yaratish (o'quv yili, sig'im, kunlar, vaqt)
   • Oylik to'lov (monthlyFee), xona biriktirish

8️⃣ **Attendance** — Davomat
   • 3 usul: Face / QR / qo'lda belgilash
   • Kuniga bir marta + usul bo'yicha (15s takrorlash bloki)
   • Audit-log (AttendanceActivityRecorder)

9️⃣ **Payments** — To'lovlar (Moliya)
   • To'lov qabul qilish (chegirma, jarima, resit raqami)
   • Qarzlar (Debt) — muddati, eslatma, qolgan summa
   • Xarajatlar (Expense) — turlari, hisobot
   • Finance sahifasi — oylik statistika, grafiklar

🔟 **Scheduling** — Dars jadvali
   • Hafta kunlari bo'yicha darslar
   • Xonalar (Rooms) — sig'im, qulayliklar, status
   • Guruh + fan + xona birikmasi

1️⃣1️⃣ **Reports** — Hisobotlar
   • O'quvchi statistikasi (Student Stats)
   • Qarz hisoboti (Debt Report)
   • Oylik davomat hisoboti
   • Daromad hisoboti (Revenue) — grafiklar bilan

1️⃣2️⃣ **Face Recognition** — Yuzni tanish (eng muhim qism)
   • Hikvision kamera: RTSP oqim (media_kit) + ISAPI snapshot fallback
   • Android/iOS/macOS: ML Kit FaceDetector (accurate)
   • Windows/Linux: TFLite MediaPipe FaceMesh (468 landmark)
   • 21-o'lchamli geometrik imzo (FaceSignatureBuilder)
   • Kosinus o'xshashlik matcher: 0.92 / noaniq 0.88
   • Enroll: 5 namuna → o'rtacha imzo, yaw/pitch filtri (22°/20°)
   • FaceScan: avtomatik davomat belgilash

1️⃣3️⃣ **Notifications** — Bildirishnomalar
   • Telegram xabarlari (telegram_service)
   • Oylik hisobot avtomatik yuborish
   • To'lov eslatmalari (reminders)
   • Telegram kontaktlarini sinxronlash

1️⃣4️⃣ **Settings** — Sozlamalar
   • Hikvision kamera sozlamalari (IP, port, kanal, test ulanish)
   • Match threshold sliderlari (0.5–1.0 / 0.3–1.0)
   • Fanlar (subjects) boshqaruvi
   • Foydalanuvchilar boshqaruvi

1️⃣5️⃣ **CRM** — Bo'sh karkas (reja qilingan, amalga oshirilmagan)

1️⃣6️⃣ **Finance** — Bo'sh karkas (moliya moduli payments'da)

🗺 **Routing (go_router) — 25+ yo'nalish**
• /splash, /login, /register, /setup
• Shell (bottom bar): /dashboard, /students, /attendance, /schedule, /finance, /settings
• /students/:identityId, /teachers, /groups
• /payments/debts, /payments/new
• /finance/payments, /finance/expense/new
• /face-scan, /face-enroll/:identityId
• /schedule/rooms
• /reports (+ /students, /debts, /monthly, /revenue)
• /notifications, /identity (+ /register, /scan, /:identityId)

🗄 **Isar bazasi — 15 ta sxema**
Identity, IdentityActivity, SequenceCounter, Organization,
Student, Teacher, Group, Payment, Debt, Expense,
Schedule, Room, Notification, Face, Attendance

🔍 **AUDIT XULOSASI (2026-08-08)**
─────────────────────────────
Jami topilgan muammolar: 26 ta
• 🔴 CRITICAL: 5 ta
• 🟠 HIGH: 6 ta
• 🟡 MEDIUM: 9 ta
• 🟢 LOW: 6 ta
• Production readiness: ~25%

🔴 **CRITICAL muammolar:**
• C-01 — TFLite asset yo'li xato ('assets/' prefiksi tushib qolgan) → desktop'da yuz tanish ishlamaydi
• C-02 — Desktop natif kutubxona (libtensorflowlite_c) repo'da yo'q
• C-03 — Auth 100% mock (hech qanday haqiqiy tekshiruv yo'q)
• C-04 — Ma'lumotlar sinxronizatsiyasi umuman yo'q (Windows ↔ Android alohida bazalar)
• C-05 — Release build debug keystore bilan imzolanadi

🟠 **HIGH muammolar:**
• H-01 — ML Kit (Android) va FaceMesh (Windows) imzolari geometrik mos emas
• H-02 — Thresholdlar (0.92/0.88) kalibrlanmagan
• H-03 — Yuz ma'lumotlari Isar'da shifrlanmagan
• H-05 — Enroll vaqtida yuz konsistensiyasi tekshirilmaydi
• H-06 — Hikvision paroli plaintext saqlanadi

✅ **Shu seansda tuzatilgan:**
• go_router'da duplicate 'finance' route o'chirildi (ilova endi ishga tushadi)
• flutter analyze — 0 xato, telefon'da muvaffaqiyatli ishga tushdi

📦 **Qo'llaniladigan yondashuvlar**
• CQRS: Command (yozish) / Query (o'qish) ajratilgan
• Offline-first: barcha biznes ma'lumotlar lokal Isar'da
• No Demo Data: baza bo'sh ochiladi
• Liquid Glass UI: shaffof, aurora fonli zamonaviy dizayn
• MaterialApp.router + iOS 27 temasi (light/dark)

🏁 **Kelajak rejalari (tavsiya etilgan)**
• Haqiqiy autentifikatsiya (Firebase Auth yoki backend)
• Ma'lumotlar sinxronizatsiyasi qatlami
• Yagona TFLite FaceMesh pipeline (ikkala platformada)
• Yuz imzolarini shifrlash
• Real kamera testlari bilan threshold kalibrlash
• CRM va Finance modullarini to'ldirish
