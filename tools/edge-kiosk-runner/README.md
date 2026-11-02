# 🚀 M-EDU V2 — Local Edge Face ID & Turnstile Kiosk Runner

Ushbu lokal drayver o‘quv markaz binosidagi **reception kompyuteri yoki arzon mini-PC (Intel N100 / Raspberry Pi 5 / Windows)** da ishga tushirish uchun mo‘ljallangan.

---

## 🎯 Bu Nima Uchun Kerak? (Arxitektura Afzalligi)

1. **Markaziy Serverni Yuklamaslik:**
   - 20 ta o‘quv markazi o‘z kameralarining og‘ir 1080p video oqimini internet orqali bitta serverga yuborsa, server CPU/RAM to‘lib qoladi.
   - **Edge Runner** videoni markazning o‘zidagi lokal kompyuterda qayta ishlaydi va M-EDU bulutli serveriga faqat **yengil JSON xabar va 512-baytli vektor** yuboradi.
   - Bu server yukini **99% ga kamaytiradi**!

2. **Offline Barqarorlik (Internet Uzilsa Ham Ishlash):**
   - Agar o‘quv markazda svet o‘chmasa-yu, Wi-Fi yoki internet 2 soatga uzilib qolsa, o‘quvchilar bemalol turniketdan o‘taveradi.
   - Barcha o‘tish vaqtlari millisekundigacha lokal `offline-events.jsonl` fayliga muhrlanadi.
   - Internet qaytishi bilan barcha davomat M-EDU ga **avtomatik sinxronlanadi**.

3. **Turniket va Relé Boshqaruvi:**
   - USB-Relay yoki COM-Port orqali turniketning jismoniy temir to‘sig‘ini (shtanga) ochish signalini uzatadi.
   - **5 soniyalik anti-duplicate** mexanizmi bitta o‘quvchi ketma-ket bir necha marta belgilanishining oldini oladi.

---

## 🛠️ O‘rnatish va Ishga Tushirish (3 Qadam)

### 1. Fayllarni Ko‘chirish
Lokal kompyuterda (Node.js 20+ o‘rnatilgan bo‘lishi kerak):
```bash
cd tools/edge-kiosk-runner
npm install
```

### 2. Sozlash (Environment yoki CLI orqali)
```bash
node edge-runner.mjs \
  --server "https://api.medu.uz" \
  --secret "terminal_secret_prod_2026" \
  --org "org-markaz-id" \
  --gate "Turniket #1 (Asosiy Kirish)"
```

### 3. Test Qilish (Dry-Run rejimi)
```bash
npm run test:ping
```

---

## ⚙️ Apparat Bilan Moslik
- **IP Kameralar:** Hikvision, Dahua, Uniview (RTSP stream orqali).
- **USB Kameralar:** Istalgan 1080p Full-HD 60fps vebkamera.
- **Turniketlar:** Perco, ZKTeco, Hikvision Face Kiosk, Carddispenser releylari.
