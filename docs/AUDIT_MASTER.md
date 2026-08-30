# M-EDU — AUDIT_MASTER (PRODUCTION HARDENING V5.0)

**Loyiha:** M-Edu (Premium Education Management System)
**Audit sanasi:** 2026-08-10
**Audit turi:** Forensic / read-only (hech qanday production kod o'zgartirilmadi)
**Audit metodi:** kod o'qish + `flutter analyze` + `flutter test` + grep-based forensics
**Umumiy holat:** OLDINGI AUDIT (2026-08-08, AUDIT.md) dagi 5 ta CRITICAL — barchasi kodda TUZATILGAN. Yangi audit: P0 = 0, P1 = 7, P2 = 14, P3 = 5.

---

## 0. BASELINE VERIFICATION (STATICALLY VERIFIED)

| Ko'rsatkich | Qiymat | Manba |
|---|---|---|
| Flutter | 3.27.0 stable | `flutter --version` |
| Dart | 3.6.0 | `dart --version` |
| lib/.dart fayllar | 259 | `find lib -name '*.dart'` |
| Qatorlar (non-generated) | ~44 166 (lib+test) | `wc -l` |
| Test fayllar | 28 ta | `find test` |
| Testlar | 141 ta — **HAMMASI PASS** | `flutter test` |
| Static analysis | **0 xato / 0 warning** | `flutter analyze` |
| Isar koleksiyalar | 19 ta | `lib/core/database` + `main.dart` |
| Git repo | YO'Q edi → **shu sessiyada yaratildi** (snapshot) | `git status` |
| Android | compileSdk 36, minSdk 23, AGP 8.9.1, Kotlin 2.1.0 | `android/app/build.gradle` |
| Natif kutubxona (Linux) | `blobs/libtensorflowlite_c-linux.so` MAVJUD | `ls blobs/` |
| Windows CMake tflite qoidasi | MAVJUD (DLL bo'lmasa WARNING) | `windows/CMakeLists.txt` |
| Lokal patch | `third_party/media_kit_video` (pubspec override) | `pubspec.yaml` |

**Eslatma:** hozirgi holat `AUDIT.md` (2026-08-08) dagi C-01…C-05, H-01/H-05/H-06 lardan ancha oldinga ketgan — HISOBOT_2/3 da qayd etilgan bosqichlar bajarilgan. Ushbu hujjat **yangi** holatni aks ettiradi.

---

## 1. PROJECT INVENTORY

```
lib/
├── main.dart                      — kirish nuqtasi, DB ochish, permissions, ProviderScope
├── app/
│   ├── event_sync.dart            — Event→Riverpod version ko'prigi (C-03 fix) + 3 projector
│   └── vibration_sync.dart        — hodisada haptic (5-bosqich)
├── core/
│   ├── auth/       session_manager, local_auth_store, biometric_service, firebase_config(dead)
│   ├── constants/  app_constants (placeholder kalitlar — xavfsiz)
│   ├── database/   app_database.dart (Isar.open)
│   ├── di/         core_providers (appDatabaseProvider, eventBusProvider)
│   ├── error/      failures.dart (sealed Failure — typed)
│   ├── event_bus/  event_bus.dart, event_projector.dart
│   ├── router/     app_router.dart (auth guard + StatefulShellRoute)
│   ├── security/   permissions.dart (RBAC: Permissions.require)
│   ├── services/   app_haptics.dart
│   ├── theme/      app_theme.dart (391 qator — iOS27/glass tokenlar)
│   ├── network/    BO'SH (sync layer yo'q)
│   └── extensions/ BO'SH
├── features/       attendance, audit, auth, crm(bo'sh), dashboard, face_recognition,
│                   finance(bo'sh), groups, identity, notifications, organization,
│                   payments, reports, scheduling, settings, students, teachers
├── l10n/           app_uz/ru/en.arb — ULANMAGAN
└── shared/         design_system/liquid (glass container/button/textfield/aurora)
test/               28 fayl: unit(21), widget(6), features/auth(1), helpers/fake_repositories
assets/             models/(2 tflite), icons/m_edu_icon.jpg
android/            compileSdk 36, release keystore key.properties'dan, debug fallback bor
windows/            CMake + tflite DLL rule
blobs/              libtensorflowlite_c-linux.so + README
third_party/        media_kit_video (lokal patch)
```

**Har bir katalogning vazifasi:** core = qatlamlararo umumiy; features = Clean Architecture (presentation/application/domain/infrastructure); app = composition root; shared = design system.

---

## 2. ARCHITECTURE MAP

- **Pattern:** Feature-first Clean Architecture + CQRS-uslub (Command/Query sinflari) + Repository Pattern + Event-Driven (EventBus) + Riverpod DI + GoRouter.
- **Qatlamlar:** presentation (sahifalar+providerlar) → application (Command/Query/Service) → domain (Entity, VO, Repository interfeysi, Event) → infrastructure (Isar datasource, model, repo impl, tashqi xizmatlar).
- **State:** `flutter_riverpod ^2.6.1` — StateNotifier (auth), FutureProvider (list/detail), `StateProvider<int>` version counters (invalidation asosidagi refresh).
- **Routing:** `GoRouter` StatefulShellRoute.indexedStack — 7 branch (5 ko'rinadigan + finance + settings yashirin), auth redirect guard, 404 errorBuilder.
- **Events:** in-memory broadcast `EventBus` + `EventSyncCoordinator` (barcha domain event → version bump) + 3 read-model projector (StudentEnrollment, TeacherEnrollment, StudentPayment).
- **DB:** Isar 3.1.0, 19 koleksiya, `AppDatabase.open(schemas: [...])`, additive migration (Attendance V2).
- **Xavfsizlik:** secure storage (sessiya, hisoblar, kamera paroli, TG token, face encryption key), AES-256-GCM face signature encryption.
- **Tanqid:** `core/network/` bo'sh (sync yo'q — adolatli, fake ham yo'q); `crm/` va `finance/` bo'sh karkas; `firebase_config.dart` — dead code (0 import).

---

## 3. DATABASE MAP (19 koleksiya — Isar)

| Koleksiya | Asosiy maydonlar | Izoh |
|---|---|---|
| identityRecords | identityId(realId M-EDU-…), firstName, lastName, role, status, phone, email, qrSeed, syncVersion, pendingSync | Unique index identityId |
| identityActivityRecords | identityId, action, method, timestamp | Audit-activity |
| sequenceCounters | key, value | realId generator (multi-device xavfi — §39) |
| organizationRecords | organizationId, name, plan, createdAt | First-run wizard |
| studentRecords | studentNumber, groupId, groupName, parent*, studentStatus, transferStatus, paymentStatus, totalPaid | Denormalized groupName |
| teacherRecords | teacherId, assignedGroupIds, weeklyHours, maxWeeklyHours | |
| groupRecords | groupId, name, capacity, currentSize, teacherIds | currentSize = denormalized counter (spec §8 duplicate-SOT xavfi) |
| paymentRecords | paymentId, amount, discount, lateFee, paidAmount, status, receiptNumber, billingPeriod | |
| debtRecords | debtId, studentIdentityId, remainingAmount, dueDate | |
| expenseRecords | expenseId, amount, category, date | |
| scheduleRecords | scheduleId, groupId, teacherId, roomId, dayOfWeek, startTime, endTime, specificDate, startDate, endDate | **TEMPLATE-ONLY — Lesson Instance YO'Q** |
| roomRecords | roomId, name, capacity | |
| notificationRecords | notificationId, type, body, channel, deliveryState, delivered | |
| faceRecords | identityId (unique), signature (List<double>, **encrypted**), sampleCount, source | AES-GCM |
| attendanceRecords (V2) | identityId, timestamp, attendanceDate, checkInAt, checkOutAt, status, method, isLegacyMerged, mergedIntoId | **DAY-based** (student+date), NOT lesson-based |
| settingsRecords | language, theme, hikvision*, scanIntervalMs, match/ambiguousThreshold, sendMonthlyReport… | Parol/token = NULL (secure storage'da) |
| userRecords | userId, identityId, email, role, isActive | RBAC list — **auth bilan ulanganmi tekshirish kerak** |
| subjectRecords | subjectId, name, code, color | |
| auditLogRecords | actorId, action, targetId, timestamp, details | Audit log |

**Migration holati:** Attendance V2 (additiv, idempotent, backup+verify+report) — statik o'qilgan. Old DB/fresh install behavior — `STATICALLY VERIFIED` (runtimeda emas).

---

## 4. FEATURE MATRIX

| Feature | Holat | Dalil |
|---|---|---|
| Auth (offline) | **REAL** | LocalAuthStore (hash), sessiya validatsiyasi, biometrik kirish, auth guard |
| Organization setup | **REAL** | FirstRunWizard + command + test |
| Students (register/duplicate/transfer/archive) | **REAL** | Commands + DuplicatesQuery + Transfer TOCTOU + tests |
| Groups | **REAL** | Create/Update/Members/Capacity + tests |
| Teachers | **REAL** | List/detail/enroll projector |
| Schedule (template) | **REAL (qisman)** | Conflict checks (room/teacher); **lesson instance yo'q** |
| Attendance | **REAL (qisman)** | V2 check-in/check-out, DB-idempotent, merge plan; **day-based, lesson-based EMAS** |
| Payments/Finance | **REAL** | Payment/Debt/Expense/Discount/LateFee; refund/write-off tekshirish kerak |
| Reports | **PARTIAL** | Stats real; **saved reports FAKE**; **revenue date range IGNORED** |
| Dashboard | **REAL** | Live EventSync kartalar, real DB stats |
| Telegram | **REAL** | Bot API haqiqiy; "sent" faqat API ok; auto-trigger spec §34 ga zid |
| Face ID (Android) | **REAL (qisman)** | ML Kit pipeline, AES-GCM, konsistensiya; threshold kalibrlanmagan, liveness yo'q |
| Face ID (Desktop) | **PARTIAL** | C-01/C-02 fixed; Linux .so bor; **DEVICE VERIFIED EMAS** |
| Camera (Hikvision) | **REAL (qisman)** | RTSP+ISAPI+ONVIF discovery+snapshot; reconnect yo'q |
| QR | **REAL (qisman)** | Skaner→identity→davomat; **plaintext realId, signed emas** |
| Backup/Restore | **REAL (qisman)** | Full 19-koleksiya export+verify+safety snapshot; **import atomic emas** |
| Audit log | **REAL** | auditLogRecords + activity recorder |
| RBAC | **REAL (qisman)** | Permissions.require command'larda (finance/settings); **barcha hisoblar admin** |
| Offline-first | **REAL** | Butun app lokal DB asosida |
| Sync (multi-device) | **NOT IMPLEMENTED** | Adolatli — fake yo'q, interface ham yo'q |
| Printer | **NOT IMPLEMENTED** | Faqat settings'da printerName maydoni |
| Face liveness | **NOT IMPLEMENTED** | Spoof deteksiyasi yo'q (UI "liveness not configured" ko'rsatishi kerak) |
| Push/SMS bildirishnoma | **NOT IMPLEMENTED** | Faqat settings flaglari |
| L10n (uz/ru/en) | **NOT WIRED** | arb fayllar bor, AppLocalizations ishlatilmaydi |

---

## 5. ROUTE MAP (app_router.dart — to'liq)

**Ommaviy:** `/splash`, `/login`, `/register`
**Shell (7 branch):** `/dashboard`(0), `/students`(1), `/attendance`(2), `/schedule`(3), `/more`(4), `/finance`(5-yashirin), `/settings`(6-yashirin)
**Boshqa:** `/setup`, `/payments/debts`, `/finance/payments`, `/payments/new`, `/finance/expense/new`, `/students/:identityId`, `/teachers`, `/groups`, `/groups/create`, `/groups/:groupId`, `/groups/:groupId/edit`, `/groups/:groupId/add-students`, `/face-scan`, `/face-enroll/:identityId`, `/schedule/rooms`, `/reports`, `/reports/students`, `/reports/debts`, `/reports/monthly`, `/reports/revenue`, `/notifications`, `/identity`, `/identity/register`, `/identity/scan`, `/identity/:identityId`
**Error:** 404 sahifa + Bosh sahifaga tugma.
**Kuzatuv:** auth guard ishlaydi; `/settings` endi marshrutda (eski audit xatosi tuzatilgan). Orphan route topilmadi.

---

## 6. EVENT MAP (EventBus — in-memory broadcast)

**Emited events:** IdentityRegistered / IdentityStatusChanged / IdentityMerged · StudentRegistered / StudentUpdated / StudentStatusChanged / StudentTransferred · AttendanceMarked · PaymentReceived / DebtCreated / ExpenseCreated · GroupCreated / GroupUpdated / GroupMemberAdded / GroupMemberRemoved · TeacherRegistered / TeacherStatusChanged / TeacherAssignedToGroup · ScheduleCreated / RoomCreated · NotificationCreated / PaymentReminderSent · OrganizationSetupCompleted

**Consumers:**
- `EventSyncCoordinator` — har bir event → tegishli `*ListVersionProvider` bump (UI avtomatik refresh)
- `StudentEnrollmentProjector` — IdentityRegistered → Student create
- `TeacherEnrollmentProjector` — IdentityRegistered → Teacher create
- `StudentPaymentProjector` — PaymentReceived → Student.paymentStatus/totalPaid update
- `VibrationCoordinator` — event → haptic

**Bo'shliq (spec §15):** Transactional Outbox YO'Q — event in-memory; app qayta ishga tushsa eventlar yo'qoladi. Hozirgi dizayn buni yumshoq qiladi (barcha read-model DB'dan re-derive qilinadi, event faqat "invalidate" signali), lekin spec talabi bajarilmagan.

---

## 7. PROVIDER MAP (Riverpod)

- **core:** `appDatabaseProvider`, `eventBusProvider`
- **auth:** `authControllerProvider`, `authStateNotifier`(router), `currentUserProvider`, `actorRoleProvider`, `biometricLoginAvailableProvider` (autoDispose)
- **students:** `studentListProvider`, `studentDetailProvider`, `studentListVersionProvider`, `registerStudentCommandProvider`…
- **identity:** `identityListProvider`, `identityDetailProvider(family)`, `identityDuplicatesQueryProvider`, `mergeIdentityCommandProvider`, `identityListVersionProvider`
- **attendance:** `attendanceVersionProvider`, `attendanceListProvider`, `studentAttendanceStatsProvider(family)`, `recordAttendanceCommandProvider`
- **payments:** `paymentListProvider`, `debtListProvider`, `paymentListVersionProvider`, `receivePaymentCommandProvider` (RBAC bog'langan)
- **groups/teachers/schedule/notifications/organization/settings/face:** shunga o'xshash list+version+command triadi
- **Kuzatuv:** version-bump pattern to'g'ri; targeted invalidation (`studentAttendanceStatsProvider(identityId)`) qo'llanilgan.

---

## 8. SECURITY AUDIT

| Yo'nalish | Holat | Dalil |
|---|---|---|
| Real secrets kodda | ✅ YO'Q (faqat `YOUR_API_KEY` placeholder) | app_constants.dart |
| key.properties / .jks / .keystore | ✅ gitignore'da | .gitignore |
| Kamera paroli / TG token | ✅ secure storage'da (Isar'dan migratsiya qilingan) | secure_settings_store + settings_repository_impl |
| Face signature at-rest | ✅ AES-256-GCM, kalit secure storage'da | face_encryption_service |
| Auth guard | ✅ Router redirect | app_router.dart |
| Auth (offline) | ⚠️ SHA-256, 1 iteratsiya, salt=email | local_auth_store.dart — spec §32 (Argon2id) bajarilmagan |
| RBAC fail-closed | ❌ **noma'lum rol → admin** (fail-OPEN) | auth_providers.dart:340 |
| RBAC amalda | ⚠️ barcha hisoblar `admin`; Permissions dekorativ | auth_providers login/register |
| Release signing | ⚠️ key.properties bo'lmasa debug keystore (spec §50: FAIL build bo'lishi kerak) | build.gradle |
| Isar at-rest | ⚠️ shifrlanmagan (face'dan tashqari barcha data) | app_database.dart |
| QR | ⚠️ plaintext realId (`M-EDU-…`), imzosiz | identity_scan_page |
| allowBackup | ⚠️ manifestda ko'rsatilmagan (default true) | AndroidManifest.xml |
| Login rate limiting | ⚠️ yo'q | local_auth_store |
| Sessiya muddati/revocation | ⚠️ yo'q (offline local — qabul qilinadigan tradeoff) | session_manager |
| Logs | ✅ parol/token log qilinmaydi | — |

---

## 9. PERFORMANCE RISK MAP

| Risk | Manba | Daraja |
|---|---|---|
| 2183 qatorli settings_page (bitta build daraxti) | settings_page.dart | P2 |
| dashboard_widgets 1084 / dashboard_page 836 | dashboard/ | P2 |
| student_detail 1013 / identity_detail 855 / group_detail 849 | — | P2 |
| face_scan_page: har kadrda setState, serial grab→analyze, backpressure yo'q | face_scan_page.dart | P2 |
| CameraStreamService: open() bir marta, reconnect yo'q, dispose hech qachon | camera_stream_service.dart | P2 |
| Face matching: O(N) brute force, izolyatsiya yo'q (UI thread) | face_matcher | P2 |
| `Permission.storage` so'rovi (Android 13+ eskirgan) | main.dart | P3 |
| Real device profillash (60FPS, memory) | — | P2 (sinov yo'q) |

---

## 10. UX/SCREEN MAP (asosiy)

| Screen | Purpose | Primary action |
|---|---|---|
| Splash/Login/Register | Kirish | Login |
| FirstRunWizard | Tashkilot sozlash | Setup |
| Dashboard | TODAY + ATTENTION + QUICK ACTIONS + OVERVIEW | +O'quvchi / Davomat / To'lov |
| StudentsList / StudentDetail | O'quvchilar | Yangi o'quvchi / Profil bo'limlari |
| IdentityList / Detail / Scan | Universal ID | QR skaner |
| TeachersList | O'qituvchilar | — |
| GroupsList / Detail / Create / AddStudents | Guruhlar | Guruh yaratish |
| AttendancePage | Bugungi davomat | Belgilash |
| SchedulePage / RoomsList | Jadval | Jadval yaratish |
| FinancePage / Payments / Debts / NewPayment / NewExpense | Moliya | To'lov qabul qilish |
| Reports + 4 report sahifa | Hisobotlar | Hisobot ochish |
| FaceScan / FaceEnroll | Face ID | Skan / enroll |
| Notifications | Bildirishnomalar | — |
| MorePage (hub) | Bo'limlar hub | Navigatsiya |
| SettingsPage | Sozlamalar (2183 qator — bo'lish kerak) | — |

**Kuzatuv:** MorePage kategoriyalarga bo'linganmi — tekshirish kerak (spec §55). Settings bo'limlarga bo'linmagan (giant widget).

---

## 11. FAKE / PARTIAL FEATURE MAP (eng muhim)

| # | Feature | Holat | Dalil (file:line) |
|---|---|---|---|
| 1 | **Saved Reports** | **FAKE** | `saveReport` → return report (yozmaydi); `fetchSavedReports` → `return []` — report_repository_impl.dart:290-295 |
| 2 | **Revenue date range** | **PARTIAL/FAKE** | `getRevenueStats({startDate,endDate})` parametrlari ishlatilmaydi — har doim oyga qarab — report_repository_impl.dart:100 |
| 3 | **Lesson instances** | **NOT IMPLEMENTED** | scheduleRecords = template; LessonInstance model umuman yo'q (grep 0 havola) |
| 4 | **Lesson-based attendance** | **NOT IMPLEMENTED** | AttendanceRecord — studentId+date+checkIn/out; darsga bog'liq emas; 2 dars/kun → 1 yozuv |
| 5 | **Printer** | **NOT IMPLEMENTED** | Faqat settings printerName; xizmat yo'q |
| 6 | **Sync / multi-device** | **NOT IMPLEMENTED** | core/network bo'sh (fake yo'q — to'g'ri) |
| 7 | **Face liveness** | **NOT IMPLEMENTED** | UI "liveness not configured" ko'rsatishi kerak — tekshirish kerak |
| 8 | **Push/SMS** | **NOT IMPLEMENTED** | faqat flaglar |
| 9 | **L10n** | **NOT WIRED** | arb fayllar ULANMAGAN |
| 10 | **Monthly auto-report** | **PARTIAL** | MonthlyReportAutoSender — sahifa ochilganda yuboradi (spec §34: real scheduler emas) |
| 11 | **Firebase** | **NOT WIRED (dead code)** | firebase_config.dart 0 import; placeholder kalitlar |
| 12 | **Desktop Face ID** | **PARTIAL** | C-01/C-02 fixed, .so bor; **DEVICE VERIFIED EMAS** |

---

## 12. ISSUE LIST (P0/P1/P2/P3)

### P0 — 0 ta (oldingi auditdagi 5 ta critical tuzatilgan)

### P1 (production functionality / security / a11y)

**P1-01 | DATA | revenue report date range ishlamaydi**
- FILE: `lib/features/reports/infrastructure/repositories_impl/report_repository_impl.dart:100`
- CURRENT: `getRevenueStats({startDate, endDate})` parametrlari butunlay e'tiborsiz; doim `monthStart..monthEnd` (oyning 1-sanasi) ishlatiladi.
- EXPECTED: startDate/endDate haqiqiy ishlatilsin, `[startInclusive, endExclusive)`.
- ROOT CAUSE: query yozilganda paramlar qo'shilgan, lekin filtrga ulanmagan.
- IMPACT: Biznes — filtrlangan daromad hisoboti noto'g'ri. Texnik — P1.
- FIX: paramlarni filtrga ulash; default oy=01..(keyingi oy) saqlab.
- TEST: RevenueReport date-range unit test (start/end chegaralari).
- REGRESSION RISK: past (sof query).

**P1-02 | FAKE | saved reports**
- FILE: report_repository_impl.dart:290-295
- CURRENT: `saveReport` yozmaydi (return report), `fetchSavedReports` → `[]`.
- EXPECTED: real persistence (Isar collection) yoki UI'da "Coming soon" (spec §14).
- FIX: qo'shimcha Isar koleksiya + CRUD, yoki feature'ni UI'da rostini ko'rsatish.

**P1-03 | ARCH | Lesson Instance / lesson-based attendance yo'q (spec §10-11)**
- FILE: scheduling (schedule_record), attendance (attendance_record, record_attendance_command)
- CURRENT: schedule = template; attendance = student+date (kuniga 1 primary).
- EXPECTED: Group → Schedule Template → Lesson Instance (groupId, subjectId, teacherId, roomId, date, start, end, status) → Attendance(lessonInstanceId). 2 dars/kun → 2 alohida yozuv.
- ROOT CAUSE: boshlang'ich model soddalashtirilgan.
- FIX: LessonInstance koleksiyasi + generator (template'dan) + attendance'ga lessonInstanceId (additive) + migration. Bu eng katta o'zgarish — alohida changeset.
- REGRESSION RISK: O'RTA — additive migration, eski davomat saqlanadi.

**P1-04 | SEC | fail-open rol default**
- FILE: auth_providers.dart:340 (`actorRoleProvider`)
- CURRENT: sessiyada rol bo'lmasa/noma'lum bo'lsa → `UserRole.admin`.
- EXPECTED: FAIL CLOSED — noaniq rol → minimal rol yoki blok.
- FIX: noma'lum rol → `UserRole.unknown`/`staff` (eng past) va `Permissions.require` uni rad etsin.
- SECURITY IMPACT: noma'lum rol admin sifatida ishlaydi.

**P1-05 | SEC | parol hashing (spec §32)**
- FILE: local_auth_store.dart (`hashPassword`)
- CURRENT: `sha256('$email:$password')` — 1 iteratsiya, salt=email (kuchsiz), tez (brute-force oson).
- EXPECTED: Argon2id (yoki PBKDF2 ≥100k iteratsiya, alohida random salt, salt saqlanadi).
- FIX: `cryptography` paketi Argon2id (mavjud) yoki PBKDF2; mavjud hash'larni migratsiya (login'da re-hash).
- REGRESSION RISK: O'RTA — mavjud hisoblar migratsiyasi kerak; test bilan.

**P1-06 | SEC | release build debug keystore fallback (spec §50)**
- FILE: android/app/build.gradle (buildTypes.release)
- CURRENT: key.properties bo'lmasa `signingConfigs.debug` bilan quriladi (jim).
- EXPECTED: missing signing key → **FAIL BUILD**.
- FIX: key.properties yo'q bo'lsa release build'ni `throw`/error; README'da key yaratish yo'riqnomasi.

**P1-07 | A11Y | accessibility o'chirilgan (spec §24)**
- FILE: main.dart:152
- CURRENT: `TextScaler.noScaling` + `boldText: false` — dynamic text scaling va system bold butunlay o'chirilgan.
- EXPECTED: o'lchovni o'chirmaslik; xavfsiz max scale bilan cheklash yoki tabiiy qoldirish.
- FIX: `TextScaler.noScaling` ni olib tashlash; layout overflowni sinash (test/widget).

### P2 (quality / UX / performance / architecture)

**P2-01** Isar at-rest shifrlanmagan (face'dan tashqari) — `app_database.dart` — Isar `encrypt:` kalit secure storage'dan.
**P2-02** Backup restore atomic emas — `database_backup_service.dart` — clear txn, importlar alohida; yagona writeTxn'ga o'tkazish yoki stage+verify+commit.
**P2-03** QR plaintext realId, imzosiz — `identity_scan_page.dart` — signed token (version+subject+signature+expiry) yoki hech bo'lmaganda random opaque token.
**P2-04** Outbox/durable event yo'q (spec §15) — in-memory EventBus — hozirgi DB-re-derive dizayni yumshoq; hujjatlashtirilgan tradeoff.
**P2-05** Face matcher threshold 0.92/0.88 kalibrlanmagan; margin mavjud (yaxshi); real corpus testi yo'q.
**P2-06** CameraStreamService reconnect/dispose yo'q.
**P2-07** face_scan_page setState-per-frame + serial pipeline.
**P2-08** Giant widgets (settings 2183, dashboard_widgets 1084, student_detail 1013, identity_detail 855, group_detail 849, dashboard 836, finance 702).
**P2-09** MonthlyReportAutoSender sahifa-ochilish trigger (spec §34 zid) — real scheduler/worker kerak.
**P2-10** allowBackup aniq emas (default true) — manifestga `android:allowBackup="false"` (yoki dataExtractionRules).
**P2-11** RBAC amalda bitta rol (admin) — UserRecord auth bilan ulanmagan; rol tayinlash UI yo'q.
**P2-12** Login rate limiting yo'q.
**P2-13** Desktop Face ID — DEVICE VERIFIED emas (faqat statik).
**P2-14** Real device performance profillash yo'q.

### P3 (polish)
**P3-01** README stock template — yangilash kerak.
**P3-02** `firebase_config.dart` dead code — o'chirish yoki ulash.
**P3-03** `crm/`, `finance/` bo'sh karkas kataloglar.
**P3-04** l10n ulash (uz/ru/en).
**P3-05** `Permission.storage` so'rovi eskirgan (Android 13+).

---

## 13. PROPOSED EXECUTION PLAN (spec §69 tartibida, build doim yashil)

| Faza | Mavzu | Tarkib |
|---|---|---|
| 0 | Snapshot | ✅ **BAJARILDI** — git init + baseline commit + `production-hardening` branch |
| 1 | Runtime/Isar/build | ✅ **VERIFIED** — analyze 0, 141 test PASS, debug APK mavjud |
| 2 | Architecture/DB integrity | P1-01, P1-02 (reports), P2-02 (atomic restore), P2-04 (outbox hujjati) |
| 3 | Auth/RBAC/security | P1-04, P1-05, P1-06, P2-11, P2-12 |
| 4 | Student/Group/Teacher | currentSize SOT, groupName sinxronligi (verified) — audit tekshiruvi |
| 5 | Schedule/Lesson engine | **P1-03** — LessonInstance + generator + migration (eng katta changeset) |
| 6 | Attendance | lesson-based davomat (P1-03 davomi), 2-dars/kun yozuvi |
| 7 | Finance | refund/reversal/write-off audit, P1-01 |
| 8 | Event/Outbox | P2-04 |
| 9 | Backup/Offline | P2-02 |
| 10 | Sync architecture | interface-larni tayyorlash (fake EMAS) |
| 11-12 | Camera/Face | P2-06, P2-07, liveness UI rostini ko'rsatish, P2-05 kalibrlash yo'riqnomasi |
| 13 | Telegram/Printer/Notify | P2-09 (real scheduler yo'q — UI'da rostini), Printer P1-05'ga o'xshash (NOT IMPLEMENTED) |
| 14-15 | Navigation/UX | P2-08 (settings bo'lish), More kategoriyalar, Settings bo'limlar |
| 16-17 | Performance/A11y | P1-07, P2-14 |
| 18 | Tests | har faza testi + integration_test yaratish |
| 19 | Release hardening | P1-06, key.properties yo'riqnomasi, P2-10 |

**Har faza:** CHANGE PLAN → small changeset → `flutter analyze` + `flutter test` → VERIFY → keyingi faza.

---

## 14. UMUMIY XULOSA

- **P0:** yo'q. **P1:** 7 ta. **P2:** 14 ta. **P3:** 5 ta.
- Eng katta bo'shliq (spec §10-11): **Lesson Instance va lesson-based attendance yo'q** — 2-dars/kun bir yozuvga tushadi.
- Eng katta FAKE: **Saved reports** va **revenue date-range** (report_repository_impl).
- Xavfsizlik: fail-open rol default + SHA-256 parol + debug-keystore fallback — uchala P1.
- OLDINGI AUDIT bilan solishtirganda: loyiha sezilarli darajada mustahkamlangan (auth real, event-sync, backup real, face encryption real).

---

## 15. WEB BUILD — ARXITEKTURA QARORI (2026-08-16, production-hardening)

### Holat: `flutter build web` — **RELEASE PASS EMAS** (compile bloklangan)

### Nima tuzatildi (shu sessiyada)

Auditda qayd etilgan `dart:ffi` → `tflite_flutter` → web build buzilishi **arxitekturaviy**
hal qilindi:

- `tflite_face_vision_engine.dart` endi **shartli-eksport shim**:
  `export 'tflite_face_vision_engine_stub.dart' if (dart.library.io) 'tflite_face_vision_engine_io.dart';`
- Native platformalar (Android/Windows/Linux/iOS/macOS) — real `TFLiteFaceVisionEngine`
  (io), **o'zgarishsiz** ishlaydi.
- Web — `tflite_flutter`/`dart:ffi` **umuman kompilyatsiya qilinmaydi**, stub yuklanadi
  (`analyze` → `NoFaceOutcome`, `isSupportedOnPlatform=false` → UI "unsupported" holat
  ko'rsatadi, feature graceful disable).
- `faceVisionEngineProvider` web'da stub dvigatelni yaratadi (ML Kit emas).

Natija: `dart:ffi` xatolari **yo'q qilindi** — kompilyatsiya endi keyingi blokerga boradi.

### Qolgan bloker (tashqi, upstream): Isar generated schema ID

`flutter build web` (dart2js) 88 ta xato bilan to'xtaydi — barchasi **Isar `*.g.dart`
fayllardagi `CollectionSchema(id: <64-bit hash>)` konstanta literallari**:

```
Error: The integer literal 3264724351450497341 can't be represented exactly in JavaScript.
```

- JavaScript raqamlari 2^53 aniqlikda — Isar generatori collection ID'ni 64-bit hash
  sifatida chiqaradi (25 ta koleksiyaning har birida).
- Bu **Isar 3.x ning hujjatlashtirilgan upstream cheklovi** (isar/isar #686, #759, #977,
  #1255, #1277; dart-lang/sdk #50385). Isar'ning o'z `isar_web.dart` bor, lekin generated
  schema'lar dart2js'da kompilyatsiya bo'lmaydi.
- `.g.dart` fayllarni qo'lda o'zgartirish **taqiqlangan** (regeneratsiya qilinadi va
  native'da collection ID o'zgarsa mavjud bazalar **ma'lumot yo'qotadi**).

### Qaror

**Web — production scope'dan chiqarilgan** (task §31 ruxsat beradi). Sabab: app offline-first
yadrosi Isar'ga (25 koleksiya) tayanadi; Isar generated schema'lar web'da kompilyatsiya
bo'lmaydi. Web'ni to'liq qo'llab-quvvatlash persistence qatlamini almashtirishni talab qiladi
(har bir datasource uchun web implementatsiya — butun DB qatlamini qayta yozish), bu
production-ready offline-first yadro uchun yuqori xavf va sessiya hajmidan ancha katta.

### Platforma matritsasi

| Feature | Android | Windows | Web |
|---|---|---|---|
| Auth / Students / Attendance / Payments / Grades / Reports / Offline | PASS | PASS | compile: `dart:ffi` tuzatildi; to'liq build Isar blokeri tufayli bloklangan |
| Face Recognition | PASS | PASS | graceful (stub, `isSupportedOnPlatform=false`) |
| Telegram / Camera | PASS | PASS | graceful (xato yutiladi, UI holat ko'rsatadi) |
| Firebase | yo'q (offline-first, creds yo'q) | yo'q | — |

### Web'ni to'liq qo'llab-quvvatlash uchun (kelajakda)

Isar'ning web-safe versiyasi (collection ID < 2^53) yoki boshqa web DB (drift/sqflite_web)
bilan persistence qatlamini port qilish. Face engine endi tayyor — `tflite_flutter` import
zanjiri web'da toza.
