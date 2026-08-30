# M-EDU — Liquid Glass Design System v3.1 — To'liq Rang Palitrasi va Tushuntirish

> Manba: Amirjon, 2026-08-17. Bu fayl — Liquid Glass tokenlarining yagona
> manbai. Kodda hardcoded rang yozilmaydi — faqat `AppColors` /
> `app_tokens.dart` / `module_colors.dart` tokenlari ishlatiladi.

---

## 0. ENG MUHIM TUSHUNTIRISH: Liquid Glass vs Glassmorphism

Bu ikkisi bir xil narsa emas — ko'p odam adashtiradi. Farqi:

### Glassmorphism (2020-2021, eski trend)
- **Nima**: Shisha effekti — blur + shaffoflik + oq/och border + soft shadow
- **Texnik asosi**: Statik `backdrop-filter: blur()` + `background: rgba(255,255,255,0.1)` + 1px yorug' border
- **Xarakteri**: Deyarli har doim bir xil ko'rinadi — qanday kontent orqasida bo'lishidan qat'iy nazar, blur darajasi va shaffoflik statik
- **Muammosi**: Ko'p ilovada "generic" ko'rinadi, chunki hamma bir xil formula ishlatadi (blur 20px + opacity 10%)
- **Misol**: 2021-yillardagi ko'plab dashboard shablonlar, Windows 11'ning ilk Mica/Acrylic

### Liquid Glass (Apple, 2025 — iOS 26/27 bilan tanishtirilgan)
- **Nima**: Shisha emas — suyuqlik fizikasiga ega material. U yorug'likni sindiradi, orqa fonga qarab dinamik reaksiya beradi
- **Texnik asosi**:
  - Real-time refraction (sinish) — orqadagi kontent egiladi/buziladi, shunchaki xiralashmaydi
  - Specular highlight — material chekkalarida "yorug'lik chizig'i" harakat qiladi (scroll qilganda yoki elementni siljitganda)
  - Adaptive blur — kontekstga qarab blur darajasi va rang ohangi o'zgaradi (och fonda boshqacha, to'q fonda boshqacha)
  - Depth va layering — elementlar haqiqiy fizik qatlamlarda "suzadi", soyalar dinamik hisoblanadi
- **Xarakteri**: Har bir holatda (scroll, harakat, orqa fon o'zgarishi) biroz boshqacha ko'rinadi — "jonli" material
- **Muammosi**: Real vaqtda hisoblash qimmat (GPU-intensive), shuning uchun performance byudjeti kerak

### M-EDU uchun amaliy xulosa

Liquid Glass'ni asos qilib, lekin Flutter'da **paketsiz, BackdropFilter bilan real vaqtda taqlid qilib** quramiz:
- Statik blur o'rniga — scroll pozitsiyasi/harakatga bog'liq **dinamik blur qiymati** (masalan `ImageFilter.blur(sigmaX: 8 + scrollOffset*0.02)`)
- Specular highlight — gradient overlay, engil harakat bilan (touch pozitsiyasiga reaksiya)
- Glassmorphism'dan farqli o'laroq **hech qanday element statik/bir xil blur qiymatga ega bo'lmaydi** — kontekstga qarab moslashadi

---

## 1. RANG PALITRASI — TO'LIQ TOKEN TIZIMI

### 1.1 Baza Neytral Ranglar (Light Theme — asosiy)

| Token | Hex | Foydalanish |
|---|---|---|
| neutral.0 | #FFFFFF | Asosiy fon, kartalar |
| neutral.10 | #FAFAFC | Ikkinchi darajali fon (app background) |
| neutral.20 | #F2F2F7 | Ajratuvchi fon (sections) |
| neutral.50 | #E5E5EA | Border, divider |
| neutral.100 | #C7C7CC | Disabled elementlar |
| neutral.300 | #8E8E93 | Ikkinchi darajali matn |
| neutral.500 | #636366 | O'rtacha matn |
| neutral.700 | #3A3A3C | Asosiy matn (light rejimda) |
| neutral.900 | #1C1C1E | Sarlavhalar, eng to'q matn |

### 1.2 Glass Material Ranglari (Liquid Glass qatlami uchun)

| Token | Qiymat | Foydalanish |
|---|---|---|
| glass.surface | rgba(255,255,255,0.55) | Asosiy card fon (blur ustida) |
| glass.surface.elevated | rgba(255,255,255,0.72) | Modal/bottom sheet |
| glass.surface.floating | rgba(255,255,255,0.85) | FAB, floating panel |
| glass.border | rgba(255,255,255,0.9) inner + rgba(0,0,0,0.04) outer | Ikki qatlamli border (Liquid Glass'ga xos) |
| glass.specular | linear-gradient(135deg, rgba(255,255,255,0.6), transparent 60%) | Yorug'lik chizig'i overlay |
| glass.shadow | rgba(28,28,30,0.08) blur 24px, y-offset 8px | Floating elementlar soyasi |

### 1.3 Accent — Brend Asosiy Rang

| Token | Hex | Foydalanish |
|---|---|---|
| brand.primary | #4A6CF7 | Asosiy CTA, faol holatlar, link |
| brand.primary.hover | #3D5CE0 | Hover/pressed |
| brand.primary.light | #EEF1FF | Faol elementlar orqa foni (masalan tanlangan tab) |
| brand.gradient | linear-gradient(135deg, #4A6CF7 0%, #7C4DFF 100%) | Premium elementlar (masalan Identity Card) |

### 1.4 Modul Accent Ranglari (har bir modul o'z rangi bilan)

| Modul | Token | Hex | Izoh |
|---|---|---|---|
| Student | module.student | #4A6CF7 (ko'k) | Asosiy brend rangi bilan bir xil (eng markaziy modul) |
| Teacher | module.teacher | #00B37E (zumrad yashil) | |
| Attendance | module.attendance | #FF9500 (to'q sariq) | |
| Payment | module.payment | #34C759 (yashil) | Moliyaviy — pul rangi |
| Payment (qarzdorlik) | module.payment.debt | #FF3B30 (qizil) | Salbiy holat |
| Schedule | module.schedule | #AF52DE (binafsha) | |
| Reports | module.reports | #5AC8FA (och ko'k) | |
| CRM/Leads | module.crm | #FF6482 (pushti-qizil) | |
| Certificates | module.certificates | #FFD60A (oltin sariq) | Premium/yutuq hissi |
| Grades | module.grades | #30D5C8 (firuza) | |
| Inventory | module.inventory | #8E8E93 (neytral kulrang) | |
| Notifications | module.notifications | #FF9F0A | |

### 1.5 Semantik Holat Ranglari

| Token | Hex | Foydalanish |
|---|---|---|
| state.success | #34C759 | Muvaffaqiyat |
| state.success.bg | #E9FBEF | Success card fon |
| state.warning | #FF9500 | Ogohlantirish |
| state.warning.bg | #FFF4E5 | Warning card fon |
| state.error | #FF3B30 | Xato |
| state.error.bg | #FFEBEA | Error card fon |
| state.info | #5AC8FA | Ma'lumot |
| state.info.bg | #EAF8FF | Info card fon |

### 1.6 Face Recognition / Kamera UI Maxsus Ranglari

| Token | Hex | Foydalanish |
|---|---|---|
| camera.scanning | #4A6CF7 (pulsating) | Yuz skanerlash animatsiyasi doira rangi |
| camera.success | #34C759 | Tanish muvaffaqiyatli |
| camera.failed | #FF3B30 | Tanish muvaffaqiyatsiz |
| camera.liveness_check | #FFD60A | Jonlilik tekshiruvi jarayonida (ko'z pirpiratish so'ralganda) |

### 1.7 Dark Mode Palitrasi (tayyorgarlik, hozircha ishlatilmaydi lekin token darajasida tayyor)

| Token | Hex | Izoh |
|---|---|---|
| neutral.dark.0 | #1C1C1E | Asosiy fon |
| neutral.dark.10 | #2C2C2E | Karta fon |
| neutral.dark.text | #F2F2F7 | Asosiy matn |
| glass.dark.surface | rgba(28,28,30,0.6) | Dark rejimdagi glass material |
| glass.dark.specular | linear-gradient(135deg, rgba(255,255,255,0.15), transparent 60%) | Dark rejimda ancha xira specular |

---

## 2. GRADIENT KUTUBXONASI

| Nomi | Qiymat | Foydalanish |
|---|---|---|
| gradient.premium | #4A6CF7 → #7C4DFF (135°) | Identity Card, Premium badge |
| gradient.success_glow | #34C759 → #30D5C8 (135°) | To'lov muvaffaqiyat ekrani fon |
| gradient.warm_alert | #FF9500 → #FF3B30 (135°) | Kritik qarzdorlik banner |
| gradient.glass_sheen | rgba(255,255,255,0.8) → transparent (120°) | Har bir glass sirt ustidagi yorug'lik chizig'i |
| gradient.hero_bg | #EEF1FF → #FAFAFC (180°) | Login/onboarding fon |

---

## 3. SOYA (SHADOW) TIZIMI — 3 DARAJALI DEPTH

| Daraja | Token | Qiymat |
|---|---|---|
| Surface (flat card) | shadow.surface | 0px 1px 2px rgba(28,28,30,0.04) |
| Elevated (modal, dropdown) | shadow.elevated | 0px 8px 24px rgba(28,28,30,0.08) |
| Floating (FAB, VisionOS-style panel) | shadow.floating | 0px 16px 40px rgba(28,28,30,0.12) + pastki 0px 2px 8px rgba(74,108,247,0.15) (brend rang bilan yengil glow) |

---

## 4. BLUR VA MATERIAL QIYMATLARI

| Kontekst | Blur (sigma) | Opacity |
|---|---|---|
| Bottom nav / app bar | 12px | 0.7 |
| Card (statik holat) | 8px | 0.55 |
| Modal/Bottom sheet | 20px | 0.72 |
| Floating panel (VisionOS uslubi) | 24px | 0.85 |
| Scroll-reaktiv (dinamik, Liquid Glass o'ziga xos) | 6px → 16px (scroll tezligiga qarab) | 0.5 → 0.65 |

---

## 5. SPACING VA RADIUS TOKENLARI

| Token | Qiymat |
|---|---|
| radius.sm | 8px (kichik tugmalar, badge) |
| radius.md | 16px (kartalar) |
| radius.lg | 24px (modal, bottom sheet) |
| radius.full | 999px (pill tugmalar, avatar) |
| spacing.xs | 4px |
| spacing.sm | 8px |
| spacing.md | 16px |
| spacing.lg | 24px |
| spacing.xl | 32px |

---

## 6. QISQACHA — NEGA BU DARAJADA ANIQ BO'LISHI KERAK

Agentga "liquid glass dizayn qil" deb aytish — noaniq, u o'zicha talqin qiladi va natija tasodifiy chiqadi. Lekin yuqoridagi jadval bilan har bir rangni, blur qiymatini, shadow'ni token sifatida berish orqali:
- Agent har safar bir xil natija chiqaradi (consistency)
- Kod review qilish oson (token nomiga qarab tekshiriladi)
- Kelajakda dark mode yoki rebrand — faqat token qiymatlarini o'zgartirish, kodni qayta yozmaslik kerak

---

*Keyingi qadam: shu token jadvalini `design_tokens.dart` fayliga aylantirib, agentga "faqat shu tokenlardan foydalan, hardcoded rang yozma" qoidasi bilan birga berish tavsiya etiladi.*
