# M-Edu — Muhit va Setup

## Talablar

- Flutter 3.27.0 stable (Dart 3.6.0) — `flutter --version`
- Android: compileSdk 36, minSdk 23, NDK 27.0.12077973
- Windows: CMake + Visual Studio (Flutter desktop)

## Tekshiruv

```bash
flutter doctor -v
flutter pub get
flutter analyze            # 0 xato / 0 warning bo'lishi shart
flutter test               # barcha testlar PASS
```

## Dev / Production rejimlar

M-Edu single codebase — farqlar runtime'da:

| Aspekt | Development | Production |
|---|---|---|
| Firebase | `FIREBASE_CONFIG_PATH=/abs/path.json` bilan | qurilmadagi `m_edu_firebase.json` |
| Log darajasi | `--dart-define=LOG_LEVEL=debug` | default `info` |
| Sync | Firestore emulator yoki sozlanmagan (offline) | haqiqiy Firestore |
| Face diagnostika | `--dart-define=FACE_DIAGNOSE=true` | o'chirilgan (default) |

## Android debug build

```bash
flutter run --debug
```

## Release build

```bash
# Android — key.properties shart (yo'q bo'lsa build ataylab FAIL)
bash scripts/generate_release_keystore.sh
flutter build apk --release

# Windows
flutter build windows
```

## Test ma'lumot generatori (dev)

```bash
# 1000 o'quvchi — alohida katalogga (production DB'ga tegmaydi)
M_EDU_SEED_COUNT=1000 M_EDU_SEED_DIR=/tmp/m_edu_seed_1000 \
  flutter test tool/seed_data_test.dart

# Benchmark (build/benchmark.json)
M_EDU_SEED_COUNT=1000 M_EDU_SEED_BENCHMARK=1 M_EDU_SEED_DIR=/tmp/m_edu_seed_1000 \
  flutter test tool/seed_data_test.dart

# Face threshold kalibrlash (real korpus bilan)
M_EDU_CALIBRATION_DIR=test_data/calibration \
  flutter test test/integration/face_calibration_live_test.dart
```

## Web scope

**Web — production scope'dan chiqarilgan** (hujjatlashtirilgan qaror):

- `dart:ffi` → `tflite_flutter` blokeri hal qilindi (shartli-eksport shim:
  web'da `FaceNoOutcome` stub, UI "unsupported" holatini ko'rsatadi, graceful).
- Qolgan bloker: **Isar generated schema** `CollectionSchema(id: <64-bit
  hash>)` konstantalari dart2js'da kompilyatsiya bo'lmaydi (JS raqamlari
  2^53 aniqlikda). Bu Isar 3.x upstream cheklovi
  (isar/isar #686, #759, #977, #1255, #1277).
- `.g.dart` fayllarni qo'lda o'zgartirish taqiqlangan (regeneratsiya
  native'da collection ID'ni o'zgartirib, mavjud bazalarni buzadi).
- Web'ni to'liq qo'llab-quvvatlash = persistence qatlamini port qilish
  (drift/sqflite_web) — alohida loyiha.
- `web/` katalogi olib tashlandi (forensic audit, 2026-08): noto'g'ri
  target'ni yashirin qoldirish o'rniga aniq olib tashlandi. Web kerak
  bo'lsa `flutter create --platforms=web .` bilan qayta tiklash mumkin
  (build hali ham yuqoridagi Isar blokeri tufayli ishlamaydi).

## Atrof-muhit o'zgaruvchilari

| O'zgaruvchi | Maqsad |
|---|---|
| `FIREBASE_CONFIG_PATH` | Firebase config fayli yo'li (runtime) |
| `LOG_LEVEL` | `debug|info|warning|error|critical` |
| `FACE_DIAGNOSE` | Face pipeline diagnostikasi (dev) |
| `M_EDU_SEED_COUNT/DIR/BENCHMARK/CHECK` | Seed generator |
| `M_EDU_CALIBRATION_DIR` | Face kalibrlash korpusi yo'li |
| `M_EDU_SCORES_SUFFIX` | Kalibrlash holdout fayl suffiksi |
