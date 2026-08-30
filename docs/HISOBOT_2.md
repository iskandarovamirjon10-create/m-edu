# 📋 M-EDU — 2-BOSQICH TUZATISHLAR HISOBOTI

## 🎯 Siz shikoyat qilgan 3 muammo — barchasi ildizidan tuzatildi

### 1. Qizil ekran: `keyReservation.contains(key)` assertion
**ROOT CAUSE:** Bottom Navigation'da joriy tab qayta bosilganda `goBranch(initialLocation: true)` chaqirilardi — bu go_router'da bir xil location'ga (masalan `/dashboard` → `/dashboard`) qayta `go()` degani. Transition paytida Navigator.pages'da bir xil pageKey'li **ikkita sahifa** paydo bo'lib, Flutter debug assertion (`_debugCheckDuplicatedPageKeys`) otilardi → **qizil ekran**.

**TUZATISH:** `main_shell_page.dart` — `goBranch(index)` (initialLocation:siz, restore rejimi). Endi bir xil location'ga qayta go() chaqirilmaydi.

### 2. Settings bo'limi ishlamayapti
**ROOT CAUSE:** `SettingsRecordSchema`, `UserRecordSchema`, `SubjectRecordSchema` Isar database schemas ro'yxatida (main.dart) **yo'q edi** — ular hech qachon Isar'ga ro'yxatdan o'tkazilmagan! Settings ochilganda `_db.settingsRecords` runtime'da xato berib, sahifa bo'sh/error ko'rsatardi. (Avvalgi skrinshot: 78KB bo'sh sahifa — buni aniqlagan edim.)

**TUZATISH:** `main.dart` — 3 ta schema ro'yxatga qo'shildi. Endi Settings to'liq ishlaydi: Til, Mavzu, Bildirishnomalar, Printer, Zaxira, Face ID — Hikvision kamera (IP/port/login/parol/chegaralar), Oylik hisobot (Telegram), Fanlar, Foydalanuvchilar, Dizayn.

### 3. Face ID kamera ishlamayapti
**ROOT CAUSE (ikki qism):**
- Settings xato bergani uchun `hikvisionConfigProvider` hech qachon konfiguratsiya qaytara olmasdi → FaceScan doim "Kamera sozlanmagan" holatida qolardi.
- FaceScan'dan `context.push('/settings')` — `/settings` shell branch ichidagi route! Unga push qilish go_router'da shell navigatorlarining ikkinchi nusxasini yaratib, keyReservation xatosini keltirishi mumkin edi.

**TUZATISH:**
- Settings fix (yuqorida) — kamera konfiguratsiyasi endi to'g'ri o'qiladi.
- `face_scan_page.dart` — `push('/settings')` → `go('/settings')`, `push('/attendance')` → `go('/attendance')` (shell branch'lariga to'g'ri o'tish + kamera resursi to'liq bo'shatiladi).

## ✅ Real qurilmada test natijalari (SM A276B)

| Test | Natija |
|---|---|
| App start | ✅ Dashboard ochildi, sessiya tiklandi |
| Tez scroll 20x (pastga/tepaga) | ✅ **0 xato, 0 overflow, 0 rang oqishi** |
| 6 tab tez almashtirish (18 marta) | ✅ **0 xato, 0 keyReservation, 0 crash** |
| Settings tab | ✅ **To'liq ishlaydi** (kontent 193KB — avval bo'sh edi) |
| Face ID sahifasi | ✅ Ochiladi, holat to'g'ri ko'rsatiladi |
| "Kamerani sozlash" → Settings | ✅ To'g'ri o'tadi |
| Back tugmasi | ✅ |
| App restart | ✅ Toza ochiladi |
| flutter analyze | ✅ **0 xato** |
| flutter test | ✅ **Barcha testlar o'tdi** |
| APK build | ✅ Muvaffaqiyatli |

## 🔧 O'zgartirilgan fayllar
1. `lib/main.dart` — 3 ta Isar schema qo'shildi (Settings ishlamasligi ildizi)
2. `lib/features/dashboard/presentation/pages/main_shell_page.dart` — goBranch restore rejimi (qizil ekran ildizi)
3. `lib/features/face_recognition/presentation/pages/face_scan_page.dart` — push→go (shell route'lariga to'g'ri navigatsiya)

## ⚠️ Eslatma
- Face ID haqiqiy kamera bilan ishlashi uchun Settings → Face ID bo'limida **Hikvision kamera IP, login, parol** kiritib "Kamera ulangan" yoqilishi kerak. Bu haqiqiy tashqi qurilma sozlamasi — unisiz app "Kamera sozlanmagan" degan to'g'ri holatni ko'rsatadi (bu xato emas, to'g'ri behavior).
