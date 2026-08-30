# M-Edu — Troubleshooting

## Build muammolari

### `flutter build apk --release` FAIL: "Release signing kaliti topilmadi"

`android/key.properties` yo'q. Yaratish:

```bash
bash scripts/generate_release_keystore.sh
```

Bu **ataylab** — debug keystore bilan production release taqiqlangan.

### `flutter build windows` — tflite DLL warning

`blobs/libtensorflowlite_c.dll` yo'q. Face ID desktop'da ishlamaydi, app
buzilmaydi. Qarang: `scripts/setup_tflite_native.sh`, `blobs/README.md`.

### Android: "VideoOutput is not abstract" (media_kit)

Ma'lum: media_kit_video 2.0.1 Flutter 3.27 Android embedding bilan mos
emas. Lokal patch ishlatiladi (`pubspec.yaml` override →
`third_party/media_kit_video/`). Yangi reliz chiqqanda override'ni olib
tashlab, paketni yangilang.

### Isar `*.g.dart` regeneratsiya

Model o'zgartirilganda:

```bash
dart run build_runner build --delete-conflicting-outputs
```

`flutter pub get` dan keyin. Qo'lda `.g.dart` tahrirlash taqiqlangan.

## Runtime muammolari

### Sync ishlamayapti (cloud'ga yozilmayapti)

1. `m_edu_firebase.json` qurilmada bormi? (app-support papkasi)
2. Log: "Firebase: konfiguratsiya topilmadi — cloud sync o'chirilgan".
3. `config/firestore.rules` deploy qilinganmi? `sync/` write serverOnly —
   client to'g'ridan-to'g'ri yozolmaydi (server SDK kerak).
4. Custom claims: `admin.setCustomUserClaims(uid, {role: '...'})` —
   `isConfigured` uchun emas, rules uchun.

### Face ID "unknown" qaytaryapti

1. Yuz enroll qilinganmi? (`faceRecords` — `tool/dump_device_db_test.dart`)
2. Yuz sifati pastmi (blur/kichik/burchak)? Quality gate davomatni
   belgilamaydi.
3. Threshold noaniq zonadami? Kalibrlash: `tool/calibrate_face_thresholds.dart`.
4. Desktop'da tflite DLL borligini tekshiring.

### Kamera ko'rinmayapti (Hikvision)

1. IP/port/username to'g'ri? (`isValid()` tekshiradi)
2. Parol secure storage'da — qayta kiritish kerak bo'lishi mumkin
   (settings migratsiyasidan keyin).
3. RTSP path: default `/Streaming/Channels/101` — custom bo'lsa o'rnating.
4. Kamera offline bo'lsa UI holat ko'rsatadi — attendance manual/QR bilan
   ishlayveradi (by design).

### Login: "Hisob nofaol"

`userRecords.isActive=false` — super_admin boshqa hisobdan qayta
faollashtirishi kerak. Oxirgi super_admin o'chirilmaydi/deaktivatsiya
qilinmaydi (guard).

## Ma'lumot

### Backup restore: "yangiroq schema bilan yaratilgan"

Backup yangi versiyada qilingan, eski versiyada ochilyapti. Ilovani
yangilang. Eski backup'lar yangi versiyada restore bo'ladi (downgrade-safe).

### "Zaxira tekshiruvdan o'tmadi"

Fayl buzilgan (checksum). Faylni qayta yarating / manbani tekshiring.
Restore oldidan joriy holat avtomatik zaxiralangan — xavfsiz.

## Face kalibrlash

- Korpus bo'lmasa: "NOT BENCHMARKED" — bu xato EMAS, korpus yig'ish kerak
  (`test_data/calibration/`, rozilik + pseudonymous).
- `validate-corpus --strict` bilan tekshiring.
