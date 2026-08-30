# M-EDU — MASTER HUJJAT (Ipidan Ignasigacha)

### To'liq mahsulot tavsifi: arxitektura → dizayn → har bir ekran → Face ID ishlash mexanizmi → roadmap

> Manba: Amirjon, 2026-08-17. Bu hujjat — butun loyiha bo'yicha yagona
> "source of truth". Oldingi 3 ta hujjat (M-EDU_v5_Product_Spec.md,
> M-EDU_100_Product_Ready_Spec.md, M-EDU_Liquid_Glass_Color_Tokens.md)
> bilan birga to'liq to'plamni tashkil qiladi.

---

# QISM 0 — VIZYON

M-EDU — xususiy o'quv markazlari uchun offline-first, Liquid Glass dizaynli, Face ID/QR/RFID identifikatsiyaga ega, 3 alohida ilovadan (Admin, Teacher, Student) iborat to'liq Enterprise Management ekotizimi. Maqsad — Moodle/PowerSchool/Fedena darajasidagi funksionallikni, lekin premium consumer-app sifatidagi UX bilan berish.

---

# QISM 1 — ARXITEKTURA (qisqacha, to'liq tafsilot avvalgi hujjatlarda)

Clean Architecture + DDD + CQRS + Event-Driven, Flutter/Riverpod/GoRouter/Isar, offline-first sync, 300-400 qatorlik fayl limiti, biznes-nomlash (RegisterStudent va h.k.), zero-demo-data qoidasi.

---

# QISM 2 — TO'LIQ EKRAN XARITASI (Screen Map)

## 2.1 M-EDU Admin/Enterprise ilovasi

### A. Kirish oqimi
1. Splash Screen — logo, Liquid Glass shimmer fon, 800ms
2. Login Screen — pastda batafsil
3. Biometric/PIN qulflash (ilova qayta ochilganda, agar yoqilgan bo'lsa)
4. Onboarding (faqat birinchi marta) — 4 slayd: Xush kelibsiz, Identity tizimi, Offline-first, Boshlash

### B. Asosiy navigatsiya (Windows: chap sidebar, Android: bottom nav + drawer)
1. Home/Dashboard
2. Studentlar (ro'yxat → profil → tahrirlash)
3. O'qituvchilar (ro'yxat → profil → jadval)
4. Guruhlar (ro'yxat → guruh detali → a'zolar)
5. Jadval (haftalik/oylik view, xona view)
6. Davomat (kunlik/dars bo'yicha, tarix)
7. To'lovlar (kirim, qarzdorlar, kvitansiya)
8. Hisobotlar (pastda batafsil)
9. CRM/Leads
10. Sertifikatlar
11. Inventar
12. Bildirishnomalar markazi
13. Global Qidiruv (overlay, istalgan joydan)
14. Sozlamalar (foydalanuvchilar, rollar, filiallar, printer, backup, til)
15. Identity/Face Recognition boshqaruvi (enrollment, kamera holati)

### C. Modal/Overlay ekranlar
- Yangi student qo'shish (multi-step form)
- To'lov qabul qilish (bottom sheet)
- Davomat tez belgilash (swipe-based)
- Bulk action tasdiqlash
- Export sozlamalari

## 2.2 M-EDU Teachers ilovasi
1. Login (o'qituvchi credential bilan)
2. Bugungi darslarim (home)
3. Mening guruhlarim
4. Davomat belgilash (dars boshida, Face ID yoki qo'lda)
5. Baholar/Grades kiritish
6. Jadvalim
7. Xabarlar (admin/ota-onalarga)
8. Profil/Sozlamalar

## 2.3 M-EDU Student ilovasi (student + ota-ona)
1. Login
2. Home — bugungi dars, davomat holati, to'lov holati
3. Jadvalim
4. Baholarim/Progress
5. To'lovlar tarixi + onlayn to'lov
6. Sertifikatlarim
7. Xabarlar
8. Profil

---

# QISM 3 — LOGIN SCREEN (to'liq spec)

Dizayn: Variant C — VisionOS-uslubi, kartasiz, elementlar fazoda suzadi.

Tarkib (yuqoridan pastga):
1. Fon: `gradient.hero_bg` (#EEF1FF → #FAFAFC, 180°), ustida juda xira, sekin harakatlanuvchi blur "bulutlar" (parallax, 20s loop, deyarli sezilmaydi)
2. Markazda: M-EDU logotipi — floating holatda, `shadow.floating` bilan, sekin "breathing" animatsiya (scale 1.0↔1.02, 3s)
3. Email/username maydoni — kartasiz, faqat pastki chiziq (underline), fokusda `brand.primary` rangga o'tadi + yengil glow
4. Parol maydoni — xuddi shunday, ko'z ikonkasi bilan ko'rsatish/yashirish
5. "Kirish" tugmasi — `gradient.premium` fon, bosilganda scale 0.96 + haptik
6. "Face ID bilan kirish" — alternativ tugma (agar qurilma qo'llab-quvvatlasa), kamera ikonka bilan
7. Pastda: "Parolni unutdingizmi?" link
8. Xato holat: input tagida qizil matn, shake animatsiya (150ms, 2 marta)
9. Loading holat: "Kirish" tugmasi ichida spinner emas — tugma o'zi pulsating holatga o'tadi

Texnik oqim:
1. User email+parol kiritadi → validatsiya (client-side, real-time)
2. Submit → backend/local auth tekshiruvi (offline bo'lsa — local cache'dagi oxirgi session bilan tekshirish, keyin sync bo'lganda serverga tasdiqlash)
3. Muvaffaqiyatli → rolga qarab tegishli dashboard'ga yo'naltirish (fade+slide transition, 300ms)
4. Muvaffaqiyatsiz → aniq xato xabari ("Email topilmadi" / "Parol xato" — umumiy "Login failed" emas)

---

# QISM 4 — HOME/DASHBOARD SCREEN (Admin, to'liq spec)

Layout (Windows — grid, Android — vertical scroll):

1. Top bar: kutubxona qidiruv (Cmd+K trigger), bildirishnoma bell, profil avatar
2. "Bugungi diqqat" bloki (eng yuqorida, eng muhim) — floating card:
   - Bugun to'lov muddati tugaydigan studentlar soni (bosilsa filtrlangan ro'yxat)
   - Davomat hali belgilanmagan guruhlar
   - Kamera offline bo'lsa — ogohlantirish
3. KPI kartalar qatori (4 ta, count-up animatsiya bilan):
   - Jami faol studentlar
   - Bugungi daromad
   - Qarzdorlik summasi
   - Bugungi davomat foizi (progress ring bilan)
4. Grafik bloki: Oylik daromad trendi (line chart, chizilish animatsiyasi)
5. Guruhlar holati: Kanban-uslubidagi mini-ko'rinish (to'lgan/yarim/bo'sh guruhlar)
6. So'nggi faoliyat feed: real-time event log (kim nima qildi) — event-driven arxitekturadan to'g'ridan-to'g'ri
7. Tezkor harakatlar FAB: ro'yxatga olish / to'lov / davomat / xabar

Rol bo'yicha farq:
- Director — barcha filiallar bo'yicha umumlashtirilgan
- Manager — faqat o'z filiali
- Teacher (agar admin panelga kirsa) — faqat o'z guruhlari

---

# QISM 5 — FACE ID: TO'LIQ TEXNIK ISHLASH MEXANIZMI (ipidan ignasigacha)

## 5.1 Enrollment (ro'yxatdan o'tkazish) bosqichi

1. Admin/Teacher student profilida "Face ID qo'shish" tugmasini bosadi
2. Kamera oynasi ochiladi (frontal yoki devor kamerasi), UI'da oval yo'naltiruvchi kontur ko'rsatiladi
3. Tizim 5 ta burchakdan rasm talab qiladi: to'g'ridan, chapga 15°, o'ngga 15°, yuqoriga biroz, pastga biroz
4. Har bir kadr uchun sifat tekshiruvi (real-time):
   - Yorug'lik yetarlimi (histogram tahlili)
   - Yuz to'liq frame ichidami
   - Fokus keskinmi (blur detection)
   - Agar sifat past bo'lsa — UI darhol "Yorug'likni yaxshilang" kabi feedback beradi
5. 5 ta sifatli kadr olingach — face embedding (raqamli vektor, ~128-512 o'lchamli) hisoblanadi (on-device model, masalan MobileFaceNet yoki shunga o'xshash yengil model)
6. Embedding lokal bazaga (Isar) shifrlangan holda saqlanadi, xom rasm saqlanmaydi (faqat vektor — privacy uchun muhim, xom rasmlar faqat vaqtincha keshda, keyin o'chiriladi)
7. Agar Cloud Sync yoqilgan bo'lsa — embedding (rasm emas) serverga shifrlangan holda yuboriladi

## 5.2 Real-vaqtdagi tanish (recognition) jarayoni

1. Kamera (Hikvision, devor kamerasi) doimiy video oqim beradi (RTSP)
2. Tizim har freym'da yuz detection qiladi (yengil model, real-time)
3. Yuz aniqlansa — liveness/anti-spoofing tekshiruvi:
   - Ko'z pirpiratishni kutish (blink detection) YOKI
   - Bosh biroz burilishini so'rash (agar shubhali holat, masalan rasm/video orqali firibgarlik urinishi aniqlansa)
   - Bu bosqich rad etilsa — "Jonli tekshiruv muvaffaqiyatsiz" xabari, qayta urinish
4. Liveness tasdiqlangach — yuzdan embedding hisoblanadi
5. Bu embedding lokal bazadagi barcha saqlangan embeddinglar bilan taqqoslanadi (cosine similarity yoki Euclidean distance)
   - Katta bazalarda (1000+ student) — indekslash (masalan approximate nearest neighbor, FAISS-uslubidagi yengil yechim) tezlikni ta'minlaydi
6. Eng yaqin moslik topilsa va threshold'dan yuqori bo'lsa (masalan >0.85 similarity) — tanildi deb belgilanadi, <2 soniya ichida
7. Natija:
   - Muvaffaqiyatli → yashil animatsiya (`camera.success` rangi), student ismi ekranga chiqadi, avtomatik davomat belgilanadi, ota-onaga push/SMS ketadi, audit event yoziladi
   - Muvaffaqiyatsiz/topilmadi → qizil (`camera.failed`), fallback: QR kod skanerlash yoki admin tomonidan qo'lda tasdiqlash oynasi (kamera snapshot bilan)

## 5.3 Performance va resurs boshqaruvi
- Model on-device, internet talab qilmaydi
- Past quvvatli qurilmalarda freym tahlil chastotasi avtomatik kamayadi (battery/RAM saqlash uchun)
- Kamera aktiv bo'lmagan vaqtda (masalan tungi soatlar) avtomatik standby rejimga o'tadi

## 5.4 Xavfsizlik va maxfiylik
- Xom yuz rasmlari saqlanmaydi, faqat matematik vektor
- Embedding baza shifrlangan (encryption at rest)
- Har bir tanish urinishi audit log'ga yoziladi (kim, qachon, qaysi kamera)
- Ota-ona/student roziligisiz Face ID yoqilmaydi (consent flow)

---

# QISM 6 — HISOBOTLAR MODULI (to'liq spec)

## 6.1 Hisobot turlari
1. Moliyaviy: Daromad (kunlik/haftalik/oylik/yillik), qarzdorlar ro'yxati, chegirmalar tahlili, filial bo'yicha taqqoslash
2. Davomat: Student/guruh bo'yicha davomat foizi, eng ko'p qoldirganlar, trend grafigi
3. Akademik: Baholar taqsimoti, guruh o'rtacha ko'rsatkichi, progress vaqt bo'yicha
4. Operatsion: Xona bandligi, o'qituvchi ish yuklamasi, guruh to'lganlik foizi
5. CRM: Lead conversion rate, manba bo'yicha tahlil (qayerdan kelgan mijozlar)

## 6.2 Har bir hisobot uchun umumiy imkoniyatlar
- Sana oralig'i filtri (haqiqiy ishlaydigan, avvalgi audit'da buzuq deb topilgan — tuzatilishi shart)
- Filial/guruh/o'qituvchi bo'yicha filtrlash
- Excel/PDF export
- Saqlangan hisobotlar (saved reports) — haqiqiy persistensiya bilan: filtr sozlamalarini nom bilan saqlash, keyin bir bosishda qayta ochish
- Rejalashtirilgan hisobotlar: har hafta/oy avtomatik email/telegram orqali yuborish

## 6.3 Vizualizatsiya
- Chiziqli grafik (trend), bar chart (taqqoslash), donut chart (taqsimot)
- Har bir grafik interaktiv: bosilganda batafsil ma'lumot tooltip'da
- Animatsiyalar B-qismda (Product Ready hujjatida) belgilangan qoidalarga mos

---

# QISM 7 — QOLGAN ASOSIY EKRANLAR (qisqacha spec)

### Student profili
- Tepada: avatar (Face ID rasm emas, alohida profil rasmi) + asosiy ma'lumot + Identity Card preview (QR bilan)
- Tab'lar: Umumiy ma'lumot / Davomat tarixi / To'lovlar / Baholar / Hujjatlar
- Har bir tab lazy-load (faqat ochilganda yuklanadi, boshlang'ich load tezligini saqlash uchun)

### To'lov qabul qilish
- Bottom sheet: summa kiritish (calculator-uslubidagi keypad), to'lov usuli (naqd/karta/o'tkazma), avtomatik kvitansiya generatsiyasi
- Muvaffaqiyatli to'lovda — `gradient.success_glow` fon bilan to'liq ekranli tasdiqlash animatsiyasi (checkmark path-drawing)

### Jadval (Schedule)
- Haftalik grid view (Windows) / kunlik list view (Android)
- Xona bandligi rang bilan kodlangan (bo'sh/band/konflikt)
- Drag-and-drop bilan dars ko'chirish (Windows), konflikt bo'lsa avtomatik ogohlantirish

### Guruh detali
- A'zolar ro'yxati (avatar grid)
- Davomat statistikasi mini-grafik
- To'lov holati xulosa
- Guruh jadvali

---

# QISM 8 — ROADMAP (bosqichma-bosqich, DeepSeek agent bilan)

## Faza 0 — Tozalash va Fundament (1-2 hafta)
- Uncommitted 9,100 qatorni tekshirish, commit qilish
- Xavfsizlik tuzatishlari: parol xeshlash, auth fail-closed, keystore
- Test qamrovini kengaytirish (critical flow'lar uchun)

## Faza 1 — Ma'lumot Modeli Mustahkamligi (2-3 hafta)
- Lesson Instance modeli va migratsiya
- Saved reports haqiqiy persistensiya
- Revenue filter tuzatish
- Sync conflict resolution to'liq test qilish

## Faza 2 — Dizayn Tizimi Implementatsiyasi (2-3 hafta)
- `design_tokens.dart` — barcha rang/blur/shadow/spacing tokenlari
- Login, Home/Dashboard pixel-perfect qurilishi
- Skeleton loading, mikro-interaksiyalar bazaviy komponentlari

## Faza 3 — Face ID Real Integratsiya (3-4 hafta)
- Enrollment oqimi to'liq
- Hikvision RTSP integratsiyasi
- Liveness detection
- Recognition + fallback oqimlari
- Xavfsizlik/maxfiylik (encryption, consent flow)

## Faza 4 — Admin Comfort va Qolgan Modullar (3-4 hafta)
- Command palette, bulk operations, smart filters
- Hisobotlar moduli to'liq (barcha turlari + export + scheduled)
- CRM, Sertifikat, Inventar modullari

## Faza 5 — 3 Ilova Ajratish va Polish (2-3 hafta)
- Teacher va Student ilovalarini alohida build qilish
- Haptik, dark mode tayyorgarligi, localization
- Onboarding, empty states, premium detallar

## Faza 6 — Pre-Launch (1-2 hafta)
- Crash reporting, performance monitoring ulanishi
- Stress test (katta ma'lumot hajmi, offline/online sync)
- Beta test 1 real o'quv markazida

Umumiy taxminiy vaqt: ~14-19 hafta (agentdan foydalanish tezligiga qarab qisqarishi mumkin, lekin har bosqich tugagach commit+test majburiy).

---

# QISM 9 — ISHLATISH QOIDASI (agent bilan ishlashda)

1. Har safar bitta Faza ichidagi bitta bo'lim bo'yicha aniq prompt bering (masalan "faqat Login screen, faqat shu tokenlar bilan")
2. Har natijadan keyin: `flutter analyze` + `flutter test` + commit
3. Katta parallel o'zgarishlarga yo'l qo'ymang — aynan shu 9,100 qatorlik uncommitted holat buning oqibati
4. Dizayn ekranlari — avval rasm/mockup solishtirilib tasdiqlangach kod

---

*Bu hujjat — sizning butun loyihangiz bo'yicha yagona "source of truth". Oldingi 3 ta hujjat (M-EDU_v5_Product_Spec.md, M-EDU_100_Product_Ready_Spec.md, M-EDU_Liquid_Glass_Color_Tokens.md) bilan birga to'liq to'plamni tashkil qiladi.*
