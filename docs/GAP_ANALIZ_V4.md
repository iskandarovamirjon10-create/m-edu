# M-EDU — PRODUCT BIBLE v4.0 GAP-TAHLIL (MOSLIK HISOBOTI)

**Hujjat maqsadi:** Product Bible v4.0 ("Liquid Glass Design System — iOS 27 Spatial Minimalist & Enterprise Education OS") dagi har bir talabning joriy kod holatini dalillar bilan aniqlash: nima REAL, nima QISMAN, nima SKAFOLD, nima YO'Q.

**Tekshiruv usuli:** kod o'qish + grep-based forensics (2026-08-12). Har bir holat fayl yo'li bilan tasdiqlangan.

---

## 0. UMUMIY HOLAT

| Ko'rsatkich | Qiymat |
|---|---|
| Kod bazasi | `lib/` — **338 ta .dart fayl**, ~**70 000** qator (generated fayllarsiz) |
| Testlar | **59 ta fayl, 389 ta test — HAMMASI PASS** |
| Static analysis | `flutter analyze` — **0 xato** |
| Isar koleksiyalari | **23 ta** (identity, student, teacher, group, payment, debt, expense, schedule, room, grade, attendance, attendance_session, face, notification, audit, report, settings, user, subject, qr_nonce, sequence, organization, identity_activity) |
| Git | `production-hardening` branch'i — baseline + 7 mavzuli commit (2026-08-10…12) |
| Platformalar | Android + Windows Desktop (Linux qisman); iOS/Web — rejada |
| **Umumiy v4.0 mosligi** | **≈ 55–60%** (asosiy operatsion yadro REAL; innovation feature'lar va kengaytmalar YO'Q) |

**Holat legendi:**
- ✅ **REAL** — production darajasida ishlaydi, test bilan tasdiqlangan
- 🟡 **QISMAN** — asosiy qismi bor, lekin muhim qismi yo'q (izohda ko'rsatilgan)
- 🧩 **SKAFOLD** — kod yozilgan va testlangan, lekin ishlovchi zanjirga ulangan EMAS
- ❌ **YO'Q** — kodda umuman mavjud emas

---

## 1. HOLAT XARITASI (tezkor jadval)

| # | v4.0 talabi | Holat | Izoh |
|---|---|---|---|
| 1.1 | Liquid Glass dizayn tizimi | ✅ REAL | `shared/design_system/liquid` + `crystal` + `glass_card` |
| 1.5 | BackdropFilter (blur) | 🟡 QISMAN | Faqat `crystal_glass_surface`/`glass_card`; liquid container'da performance uchun olib tashlangan |
| 1.6 | Haptics / vibratsiya | ✅ REAL | `AppHaptics` + `VibrationCoordinator` (sozlamadan o'chiriladi) |
| 1.6 | Audio sezgi (click/chime) | ❌ YO'Q | Faqat haptics — tovush yo'q |
| 1.3 | Monospace raqamlar | ✅ REAL | JetBrains Mono + `tabularFigures` (`crystal_typography.dart`) |
| 1.8 | Qorong'i rejim | ✅ REAL | iOS27DarkTheme + saqlanadigan themeMode |
| 2.1 | Smart Dashboard | ✅ REAL | TodayOverview/Schedule/ActivityFeed/AlertCenter, jonli EventSync |
| 2.1 | **Voice-to-Action** | ❌ YO'Q | Ovozli buyruq umuman yo'q |
| 2.1 | **Kanban CRM** | 🧩 SKAFOLD | Lead yadrosi (domain/application) bor; **Isar persistence va UI yo'q** |
| 2.2 | Student 360° | ✅ REAL | Profil, timeline, davomat%, to'lov holati |
| 2.2 | Hujjatlar arxivi | 🟡 QISMAN | `photoPath` bor; hujjat yuklash/sertifikat arxivi yo'q |
| 2.3 | O'qituvchilar | ✅ REAL | Ro'yxat, ixtisoslik, guruhlar, ish haqi |
| 2.4 | Jadval + xonalar | ✅ REAL | Conflict tekshiruvi + LessonInstance engine |
| 2.4 | **Smart Scheduling Assistant** | ❌ YO'Q | Optimal vaqt taklifi yo'q |
| 2.5 | Hikvision + Face ID | 🟡 QISMAN | RTSP/ISAPI/ONVIF real; **liveness, mass-scan, reconnect, kalibrlash yo'q** |
| 2.6 | To'lovlar/Moliya | ✅ REAL | Naqd/karta, chegirma, jarima, qarz, xarajat, chek |
| 2.6 | **Click/Payme integratsiyasi** | ❌ YO'Q | Kelajakda (v4.0 da ham "kelajakda") |
| 2.7 | Telegram bildirishnoma | ✅ REAL | Bot API haqiqiy |
| 2.7 | **SMS** | 🟡 QISMAN | `SmsService` + notifications sahifasida ulangan; gateway sozlamalari shart |
| 2.7 | **Push-bildirishnoma** | ❌ YO'Q | firebase_messaging yo'q |
| 2.8 | Hisobotlar | ✅ REAL | Saved reports real, revenue date-range real |
| 2.8 | **Excel/PDF eksport** | ❌ YO'Q | `reportsExport` permission bor, feature yo'q |
| 2.9 | Global qidiruv | ✅ REAL | `_GlobalSearchSheet` (dashboard) |
| 2.10 | Sozlamalar | ✅ REAL | Hikvision, threshold, fanlar, foydalanuvchilar, backup |
| 2.11 | **Inventar** | ❌ YO'Q | Faqat xarajat turi "Kanselyariya" ikonkasi |
| 2.11 | **Sertifikat generatori** | ❌ YO'Q | — |
| 2.11 | **Multi-Branch** | ❌ YO'Q | Faqat `branchName` maydoni; wizard "keyinroq" deb yozadi |
| 3.1 | Event Bus | ✅ REAL | In-memory broadcast + 3 read-model projector |
| 3.1 | **Transactional Outbox** | ❌ YO'Q | Hujjatlashtirilgan tradeoff |
| 4.2 | Clean Arch / DDD / CQRS | ✅ REAL | Feature-first, biznes-til command'lar |
| 4.3 | Offline-first (Isar) | ✅ REAL | 23 koleksiya, "No Demo Data" siyosati |
| 4.3 | **Offline Mutation Queue** | 🟡 QISMAN | `pendingSync` endi har yozuvda set qilinadi, lekin **consumer (sync engine) yo'q** |
| 4.4 | **Cloud Sync (multi-device)** | ❌ YO'Q | `lib/core/network/` bo'sh; `connectivity_plus` deklaratsiyalangan, ishlatilmaydi |
| 5.1 | **Mass-Scan (guruhli davomat)** | ❌ YO'Q | Bir kadrda ko'p yuz oqimi yo'q |
| 5.2 | **AI Churn Predictor** | ❌ YO'Q | Davomat+to'lov ma'lumotlari BOR (data ready), model yo'q |
| 5.3 | **Telegram Mini App** | ❌ YO'Q | Webview/mini-app yo'q |
| 5.4 | **Sertifikat generatori** | ❌ YO'Q | — |
| 5.5 | **Voice Report Summary** | ❌ YO'Q | — |
| 6 | RBAC | ✅ REAL | Granular, fail-closed, route guard + command guard |
| 6 | Audit log | ✅ REAL | `auditLogRecords` + activity recorder |
| 6 | Yuz vektorlari xavfsizligi | ✅ REAL | AES-256-GCM, faqat mahalliy, vektor ko'rinishida |
| 6 | Backup | ✅ REAL | Shifrlangan envelople, schema-version tekshiruvi |
| 8 | 7 rol iyerarxiyasi | ✅ REAL | 1-hisob superAdmin; keyingi hisoblar unknown (fail-closed) |
| 9 | M-EDU Teachers app | ❌ YO'Q | Alohida ilova yo'q |
| 9 | M-EDU Student app | ❌ YO'Q | Alohida ilova yo'q |
| — | **Qo'shimcha: Grades (baholar)** | ✅ REAL | v4.0 dan tashqari qo'shilgan |
| — | **Qo'shimcha: Gamification** | ✅ REAL | v4.0 dan tashqari qo'shilgan |

---

## 2. §1 — VIZUAL IDENTIFIKATSIYA VA DIZAYN TIZIMI (The Skin)

| v4.0 talabi | Holat | Dalil / izoh |
|---|---|---|
| Liquid Glass (Crystal Air) | ✅ REAL | `lib/shared/design_system/liquid/` (glass_container, glass_button, glass_text_field, aurora), `crystal/` (13 komponent), `glass_card.dart` |
| Semantic rang tokenlari | ✅ REAL | `AppTheme`: primary, accent(success), error, warning, info, auroraGold, separator, textPrimary/Secondary/Tertiary, cardDark (`app_theme.dart`) |
| Tipografiya: Inter + monospace | ✅ REAL | GoogleFonts Inter asosiy; **JetBrains Mono + `FontFeature.tabularFigures`** — raqamlar sakramaydi (`crystal_typography.dart`) |
| 8pt grid + radius shkalasi | 🟡 QISMAN | Asosan 8 ga bo'linadigan spacing/radius (16/24/32…); ba'zi 4pt qiymatlar (12/20/28) ham uchraydi — qat'iy emas |
| BackdropFilter (3 blur qatlam qoidasi) | 🟡 QISMAN | `BackdropFilter` faqat `crystal_glass_surface.dart` va `glass_card.dart` da. **`liquid_glass_container` real-time blur'ni performance uchun olib tashlagan** (izohda hujjatlashtirilgan) — bu Graceful Degradation ga mos, lekin v4.0 dagi "shisha" hissi qisman |
| Micro-interactions (spring/hover) | ✅ REAL | `crystal_motion.dart`, AnimatedScale hover (1.03), `AppHaptics.tap()` |
| Kontekstli haptics | ✅ REAL | `VibrationCoordinator`: event→kuch xaritasi, throttle, sozlamadan o'chirish |
| Audio sezgi | ❌ YO'Q | `core/services` da tovush yo'q (faqat haptics) |
| Qorong'i rejim | ✅ REAL | `AppTheme.iOS27DarkTheme` + `AppSettings.themeMode` (MaterialApp'ga ulangan) |
| Graceful Degradation | 🟡 QISMAN | **Dizayn darajasida**: og'ir blur'lar olib tashlangan (flat glass). **Avtomatik qurilma unumdorligini aniqlash yo'q** |

---

## 3. §2 — FUNKSIONAL MODULLAR (The Muscle)

### 2.1 Ovozli CRM va Smart Dashboard
- **Smart Dashboard — ✅ REAL.** `dashboard_page.dart` + 4 ta yangi jonli widget: `dashboard_today_overview.dart`, `dashboard_today_schedule.dart` (LessonInstance asosida), `dashboard_activity_feed.dart`, `home_alert_center.dart`. Barchasi EventSync version provider'larini watch qiladi — refresh tugmasi yo'q.
- **Voice-to-Action — ❌ YO'Q.** `speech_to_text` / ovozli buyruq handler yo'q (grep: 0 natija).
- **Kanban CRM — 🧩 SKAFOLD.** `lib/features/crm/`:
  - ✅ Bor: `Lead`, `LeadActivity`, `LeadScore` (value object), `LeadScoreCalculator`, `LeadIdGenerator`, `CaptureLeadCommand`, `AdvanceLeadStageCommand`, `LeadEvents`, `LeadRepository` interfeysi + **unit testlar**.
  - ❌ Yo'q: Isar persistence (`LeadRecord`), providerlar, presentation (Kanban sahifa, drag&drop), marshrut. Command'lar hech qayerdan chaqirilmaydi (dead-skill emas — Faza 3 boshlanishi).

### 2.2 Student 360°
- **✅ REAL.** `student_detail_page.dart` (1013+ qator): identity, guruhlar, davomat%, to'lov holati, transfer dialogi. `activity_timeline_widget.dart` — Instagram-lenta uslubidagi xronologik faoliyat. Identity merge/duplicate aniqlash real.
- **🟡 Hujjatlar arxivi** (pasport nusxasi, shartnoma): `photoPath` maydoni bor, lekin hujjatlar moduli/sertifikat arxivi yo'q.

### 2.3 O'qituvchilar
- **✅ REAL.** `teachers_list_page.dart`, `register_teacher_command`, `assign_teacher_to_group_command`, haftalik yuklama (`maxWeeklyHours`), ish haqi maydoni. Oylik ish haqi avtomatik hisobi — tekshirilmagan (faqat saqlanadi).

### 2.4 Guruhlar va Jadval
- **✅ REAL + kengaytirilgan.** `schedule_page.dart`, xonalar (`rooms_list_page.dart`), conflict tekshiruvi (xona/o'qituvchi bandligi — `schedule_conflict_test`). **LessonInstance engine (P1-03) endi REAL**: `lesson_instance_service.dart` jadval shablonidan deterministik `LESSON-{scheduleId}-{yyyyMMdd}` hisoblaydi; `add_lesson_sheet.dart` UI.
- **❌ Smart Scheduling Assistant** — optimal vaqt taklifi yo'q.

### 2.5 Hikvision Kamera va Face ID
- **🟡 QISMAN (yadro REAL, xavfsizlik qismlari yo'q).**
  - ✅ RTSP oqim (`media_kit` + `CameraStreamService`), ISAPI snapshot fallback, ONVIF discovery, ML Kit FaceDetector (Android), TFLite FaceMesh (desktop), 21-o'lchamli geometrik imzo, cosine matcher (0.92/0.88), AES-256-GCM shifrlangan imzolar, 5-namuna enroll, yaw/pitch filtri.
  - ❌ **Liveness/Anti-Spoofing** — umuman yo'q (faqat audit hujjatlarida "not implemented").
  - ❌ **Mass-Scan** (bir kadrda ko'p yuz) — yo'q.
  - ❌ **Reconnect** — `camera_stream_service.dart` da yo'q (P2-06 ochiq).
  - ⚠️ Threshold'lar (0.92/0.88) real korpus bilan kalibrlanmagan (P2-05).
  - ⚠️ Desktop Face ID — faqat statik tekshirilgan, qurilmada tasdiqlanmagan.
  - ⚠️ H-01: ML Kit (Android) ↔ FaceMesh (desktop) imzolari geometrik mosligi hali yagona pipeline'ga keltirilmagan.

### 2.6 To'lovlar va Moliya
- **✅ REAL.** `payment_records/debt_records/expense_records`, chegirma + jarima + resit raqami, qarzlar va eslatma (Telegram), oylik hisobotlar, `finance_page.dart` grafiklar bilan. Click/Payme — v4.0 da ham "kelajakda" deb belgilangan, **❌ yo'q**.

### 2.7 Bildirishnomalar
- **✅ Telegram real** (`telegram_service.dart`): xabarlar, oylik hisobot, qarz eslatmalari, kontakt sinxronlash.
- **🟡 SMS** — `sms_service.dart` + `notifications_page` da ulangan (yuborish UI bor); SMS gateway sozlamalari/SMS provider yo'q.
- **❌ Push** — `firebase_messaging` yo'q.
- 🟡 Avtomatik trigger'lar: oylik hisobot hali **sahifa ochilganda** yuboriladi (P2-09: real scheduler yo'q).

### 2.8 Hisobotlar
- **✅ REAL (P1-01/P1-02 tuzatildi).** `report_record.dart` Isar koleksiyasi — `saveReport`/`fetchSavedReports` endi real; revenue `startDate/endDate` haqiqiy qo'llaniladi; `delete_report_command`.
- **❌ Excel/PDF eksport** — `reportsExport` permission bor, lekin eksport xizmati yo'q (faqat backup `exportJson`).

### 2.9 Global Qidiruv
- **✅ REAL.** `_GlobalSearchSheet` (`dashboard_page.dart:339`) — o'quvchi, to'lov, faoliyat bo'yicha real-time qidiruv, kategoriyalar.

### 2.10 Sozlamalar
- **✅ REAL.** Hikvision sozlamalari (test ulanish), match threshold sliderlari, fanlar, foydalanuvchilar, backup, til/mavzu, tebranish. Settings sahifasi bo'limlarga bo'lindi (`camera_settings_section.dart`, `monthly_report_section.dart`).

### 2.11 CRM/Leads, Inventar, Sertifikatlar, Multi-Branch
- **CRM — 🧩 SKAFOLD** (yuqoriga qarang).
- **Inventar — ❌.** Faqat xarajat turi sifatida "Kanselyariya" (`new_expense_page.dart`).
- **Sertifikatlar generatori — ❌.** (Faqat APK imzolash sertifikati haqida audit yozuvi bor.)
- **Multi-Branch — ❌.** Organization'da bitta `branchName`; `first_run_wizard_page.dart` da: *"Ko'p filialli tizim keyinroq qo'llab-quvvatlanadi"*.

---

## 4. §3 — ASINXRON MA'LUMOTLAR OQIMI (The Nervous System)

| v4.0 talabi | Holat | Izoh |
|---|---|---|
| Event Bus (modullar faqat event orqali muloqot qiladi) | ✅ REAL | `core/event_bus/` — in-memory broadcast; 20+ hodisa; 3 projector (StudentEnrollment, TeacherEnrollment, StudentPayment) |
| Live UI (refresh yo'q) | ✅ REAL | `EventSyncCoordinator` har event → tegishli `*ListVersionProvider` bump — faqat aniq widget rebuild bo'ladi |
| **Transactional Outbox / durable event** | ❌ YO'Q | Eventlar in-memory — app qayta ishga tushsa yo'qoladi. Dizayn buni yumshatadi (barcha read-model DB'dan re-derive qilinadi), lekin v4.0 talabi bajarilmagan (hujjatlashtirilgan tradeoff) |

---

## 5. §4 — ARXITEKTURA VA OFFLINE-FIRST (The Brain & Bones)

| v4.0 talabi | Holat | Izoh |
|---|---|---|
| Clean Architecture + DDD + CQRS | ✅ REAL | Feature-first: presentation/application/domain/infrastructure; biznes-til nomlar (`RegisterStudent`, `TransferStudent`, `ArchiveStudent`…); Repository Pattern; Riverpod DI |
| Isar offline-first | ✅ REAL | 23 koleksiya, barcha biznes amallar lokal; "No Demo Data" siyosati |
| **Offline Mutation Queue** | 🟡 QISMAN | `pendingSync=true` endi **har bir yozuvda set qilinadi** (repos barchasi yozadi) — lekin bu bayroqni o'qib, serverga yuboradigan **sync engine yo'q** |
| Conflict-Resolution | ❌ YO'Q | Sync yo'q bo'lgani uchun yo'q |
| Graceful Degradation | 🟡 QISMAN | Dizayn darajasida (og'ir blur olib tashlangan); avtomatik qurilma aniqlash yo'q |
| Isar at-rest shifrlash | 🟡 QISMAN | Faqat face imzolari AES-GCM; qolgan barcha ma'lumot plaintext |

---

## 6. §5 — INNOVATSION FEATURE'LAR (The Edge)

| Feature | Holat | Izoh |
|---|---|---|
| **Mass-Scan (guruhli davomat)** | ❌ | Kamera oqimi bitta yuz oqimi — ko'p yuzli kadr tahlili yo'q |
| **AI Churn Predictor** | ❌ | **Data tayyor**: davomat stats (`attendance_statistics_service`), qarzlar (`debt_records`), to'lov tarixi bor — faqat model/qiymat kerak |
| **Telegram Mini App** | ❌ | Ota-onalar uchun webview/mini-app yo'q |
| **Smart Scheduling Assistant** | ❌ | Conflict tekshiruvi bor, optimal vaqt taklifi yo'q |
| **Sertifikat Generatori** | ❌ | PDF generator yo'q (QR-verification bilan birga) |
| **Voice Report Summary** | ❌ | — |

**v4.0 dan tashqari qo'shilganlar (bonus):** Grades (baholar moduli — ✅ to'liq: add/delete/queries, `/grades` marshrut), Gamification (✅ ball/daraja/yutuqlar, `/gamification`, financeView gated), Signed QR (✅ Ed25519), Attendance sessions (✅).

---

## 7. §6 — XAVFSIZLIK VA RUXSATLAR (The Immune System)

| v4.0 talabi | Holat | Izoh |
|---|---|---|
| **RBAC** | ✅ REAL | Granular rol×permission matritsasi (`permissions.dart`); **fail-closed** (unknown rol = hech narsa); route guard (`state.fullPath` asosida) + command ichida `Permissions.require` — UI darajasiga tayanmaydi |
| **Audit Log** | ✅ REAL | `auditLogRecords` — kim/qachon/nima; audit tarixi User profilda ham ko'rinadi |
| **Biometrik ma'lumot xavfsizligi** | ✅ REAL | Yuz imzolari AES-256-GCM, kalit secure storage'da; vektor faqat mahalliy |
| **Backup** | ✅ REAL | Shifrlangan envelople + schema-version + verify; Create/RestoreBackupCommand'lar (RBAC: backupCreate/backupRestore) |
| Parol xavfsizligi | ✅ REAL | **Argon2id** (OWASP: 19 MiB / 2 iteratsiya / 1 parallel), legacy SHA-256 login'da avtomatik migratsiya |
| QR xavfsizligi | ✅ REAL | **Ed25519 imzo + nonce replay himoyasi** + 24 soat amal muddati (`signed_qr_service.dart`) |
| Release imzolash | ✅ REAL | Kalit bo'lmasa build FAIL (P1-06) |

**Ochiq xavfsizlik kamchiliklari:** Isar at-rest qolgan ma'lumotlar shifrlanmagan (P2-01); login rate-limiting yo'q (P2-12); `allowBackup` endi data_extraction_rules bilan boshqariladi (✅).

---

## 8. §8 — ROLLAR VA FOYDALANUVCHI EKOTIZIMI

- ✅ **Barcha 7 rol enum'da bor**: superAdmin, director, admin, manager, teacher, staff, student, parent (+unknown).
- ✅ **Fail-closed boshlanish**: birinchi hisob → `super_admin` (egasi); keyingi ro'yxatdan o'tgan hisoblar → `unknown` (hech qanday ruxsat yo'q) — rol faqat User Management orqali tayinlanadi (`user_management_page.dart`).
- ✅ Rol o'zgartirish/faollashtirish/to'xtatish/arxivlash/o'chirish + audit — real.
- ⚠️ Director va Admin amalda bir xil daraja (users boshqaruvi faqat superAdmin).

---

## 9. §9 — ILOVALAR OILASI (App Family)

| Ilova | Holat |
|---|---|
| M-EDU (Admin/Enterprise) | ✅ REAL — yagona mavjud ilova (Android + Windows) |
| **M-EDU Teachers** | ❌ YO'Q — alohida ilova yo'q; o'qituvchi faqat admin ilovasidagi rolli kirish bilan |
| **M-EDU Student / Parent** | ❌ YO'Q — alohida ilova yo'q; Telegram Mini App ham yo'q |

---

## 10. §10 — RIVOJLANISH XARITASI (Roadmap) STATUSI

| Faza | Holat | Izoh |
|---|---|---|
| **Faza 1 — Universal Identity System** | ✅ **TUGADI** | Identity reyestri, Face enroll, Signed QR, merge, activity timeline, duplikat aniqlash |
| **Faza 2 — Asosiy operatsion modullar** | 🟡 **~85%** | Davomat V3 (lesson-based) ✅, jadval ✅, to'lovlar ✅, hisobotlar ✅. Qolgan: Excel/PDF eksport, printer, push |
| **Faza 3 — CRM va kengaytmalar** | 🧩 **boshlangan** | CRM lead yadrosi (skafold). Sertifikatlar/Inventar — yo'q |
| **Faza 4 — Multi-Branch va Cloud Sync** | ❌ | Sync engine, outbox, multi-branch, REST API — yo'q |
| **Faza 5 — Platforma kengayishi (iOS/Web)** | ❌ | Faqat Android/Windows |

---

## 11. §12 — MUVAFFAQIYAT MEZONLARI (Success Metrics) HOLATI

| Metrika | Holat |
|---|---|
| Davomat vaqtini 90% qisqartirish (kamera) | 🟡 Face ID real va ishlaydi, lekin **liveness + threshold kalibrlash + device verification** tugallanmaguncha "ma'lum" emas |
| 0% crash / hech qachon freeze | 🟡 Og'ir joylar tuzatilgan (autoDispose kamera, lazy grids, RepaintBoundary); **real profillash yo'q** |
| Offline rejimda 100% amallar | ✅ Lokal Isar'da barcha asosiy amallar ishlaydi; **lekin multi-device sync yo'qligi sababli ma'lumot "yo'qolmaydi" faqat bitta qurilmada** |
| Ekran yuklanishi ≤ 0.1s | 🟡 Isar tez; o'lchov/benchmark yo'q |
| Qarzdorlik va churn -20% (AI) | ❌ Churn Predictor yo'q |

---

## 12. TAVSIYA ETILGAN KEYINGI QADAMLAR (priority tartibida)

| # | Qadam | Nega hozir | Hajmi |
|---|---|---|---|
| 1 | **CRM Kanban to'liq**: `LeadRecord` (Isar) + `leadRepositoryProvider` + Kanban sahifa (drag&drop bosqichlar) | Yadro va testlar tayyor; permission'lar bor (`crmLeadsView/Create/Edit`) — faqat persistence+UI kerak. v4.0 Faza 3 | O'rta |
| 2 | **Hisobotlar eksporti**: Excel (CSV — oddiy) + PDF (pdf package) | `reportsExport` permission tayyor; eksport bo'lmasa v4.0 2.8 to'liq emas | Kichik |
| 3 | **Face ID: Liveness + threshold kalibrlash** | 2.5-bo'limning eng katta xavfsizlik bo'shlig'i; spoof hozir mumkin | O'rta-katta |
| 4 | **AI Churn Predictor** | Data tayyor (davomat%, qarzlar, to'lov kechikishlari); oddiy statistik model + Dashboard'da qizil badge | Kichik-o'rta |
| 5 | **Sertifikat Generatori** (PDF + QR verification) | Faza 3 talabi; QR texnologiyasi endi bor (signed QR) | O'rta |
| 6 | **Sync qatlami (Faza 4):** `pendingSync` consumer + outbox + REST | Eng katta arxitektura bo'shlig'i; `core/network/` bo'sh | Katta |
| 7 | **Telegram Mini App / Parent kanali** | Ota-onalar uchun eng arzon yetkazish kanali (bot bor) | O'rta |
| 8 | **Multi-Branch, Inventar, Voice-to-Action** | Faza 4/5 doirasida | Katta |

---

## 13. DALILLAR INDEKSI (asosiy fayllar)

| So'rov | Fayl |
|---|---|
| Dashboard jonli widgetlar | `lib/features/dashboard/presentation/widgets/dashboard_today_overview.dart`, `dashboard_today_schedule.dart`, `dashboard_activity_feed.dart`, `home_alert_center.dart` |
| Global qidiruv | `lib/features/dashboard/presentation/pages/dashboard_page.dart` (`_GlobalSearchSheet`) |
| CRM skafold | `lib/features/crm/domain/entities/lead.dart`, `application/commands/capture_lead_command.dart`, `advance_lead_stage_command.dart` |
| Lesson engine | `lib/features/scheduling/domain/entities/lesson_instance.dart`, `application/services/lesson_instance_service.dart` |
| Davomat V3 | `lib/features/attendance/application/commands/mark_attendance_status_command.dart`, `application/services/attendance_session_service.dart` |
| Signed QR | `lib/features/identity/domain/services/signed_qr_codec.dart`, `infrastructure/services/signed_qr_service.dart` |
| RBAC | `lib/core/security/permissions.dart`, `lib/core/router/app_router.dart` (route guard), `access_denied_page.dart` |
| Argon2id | `lib/core/auth/local_auth_store.dart` |
| Face pipeline | `lib/features/face_recognition/infrastructure/services/camera_stream_service.dart`, `face_encryption_service.dart`, `presentation/pages/face_scan_page.dart` |
| Hikvision | `lib/features/face_recognition/...` RTSP+ISAPI (settings'da IP/port/kanal) |
| Hisobotlar | `lib/features/reports/infrastructure/models/report_record.dart`, `repositories_impl/report_repository_impl.dart` |
| Monospace tipografiya | `lib/shared/design_system/crystal/crystal_typography.dart` (JetBrains Mono, tabularFigures) |
| Blur (cheklangan) | `lib/shared/design_system/crystal/crystal_glass_surface.dart`, `liquid/liquid_glass_container.dart` (izoh) |
| Printer — yo'q | `lib/features/settings/presentation/pages/settings_page.dart` ("Qo'llab-quvvatlanmaydi") |
| Multi-branch — yo'q | `lib/features/organization/presentation/pages/first_run_wizard_page.dart` ("keyinroq") |
| Sync — yo'q | `lib/core/network/` (bo'sh); `pendingSync` flag'lari `*/infrastructure/models/*_record.dart` da |
| Testlar | `test/` — 59 fayl, 389 test |

---

*Ushbu hujjat Product Bible v4.0 bilan joriy kod holatini solishtirish uchun yozilgan. Har qanday "YO'Q" yozuvi yangi talab emas — v4.0 bo'limlaridagi rejalashtirilgan qismlarning hozircha amalga oshmaganini bildiradi. (2026-08-12, `production-hardening` branch'i)*
