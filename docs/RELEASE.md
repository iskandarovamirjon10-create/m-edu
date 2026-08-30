# M-Edu — Release

## Quality gate (har release'dan oldin)

```bash
flutter clean
flutter pub get
flutter analyze                 # 0 xato / 0 warning
flutter test                    # barcha testlar PASS
flutter test --coverage
flutter build apk --release
flutter build windows
```

## Android release

- **applicationId**: `com.medu.m_edu` (android/app/build.gradle).
- **version**: `pubspec.yaml` — `version: 1.0.0+1` (versionName+versionCode).
- **minSdk 23** (camera 0.11), **compileSdk 36**, **NDK 27** (tflite/media_kit).
- **Signing**: `android/key.properties` (gitignore'da) — release build
  key'siz **ataylab FAIL** bo'ladi (debug keystore fallback YO'Q):

  ```bash
  bash scripts/generate_release_keystore.sh
  ```

- **Permissions** (AndroidManifest): camera, notification, internet.
  `Permission.storage` runtime so'rovi Android 13+ da qo'llanmaydi.
- **ProGuard/R8**: Flutter default (shrinkReleaseResources bilan), native
  lib'lar (tflite/isar/media_kit) uchun keep qoidalari paketlarda.

## Windows release

- `flutter build windows` → `build/windows/x64/runner/Release/` da exe.
- **TFLite**: `windows/CMakeLists.txt` — `blobs/libtensorflowlite_c.dll`
  bo'lmasa WARNING (runtime'da Face ID desktop'da ishlamaydi, app buzilmaydi).
  Qarang: `scripts/setup_tflite_native.sh` + `blobs/README.md`.
- **User data**: app-support papkasiga yoziladi (`getApplicationSupportDirectory`),
  executable papkasiga YOZILMAYDI (Windows: `%APPDATA%`).
- Firewall: birinchi ishga tushishda RTSP/network ruxsat so'ralishi mumkin —
  rad etilsa ham app ishlaydi (kamera holati ko'rsatiladi).

## Versioning

- `pubspec.yaml` version — semver.
- `backupSchemaVersion` — kolleksiya o'zgarganda oshiriladi.
- DB migratsiya — additiv, test bilan.

## Release checklist (definition of done)

- [ ] `flutter analyze` clean
- [ ] barcha testlar pass
- [ ] `flutter build apk --release` pass (key.properties bilan)
- [ ] `flutter build windows` pass
- [ ] Firebase rules/indexes deploy qilingan (kerak bo'lsa)
- [ ] `m_edu_firebase.json` qurilmada (sync uchun)
- [ ] Secrets source'da yo'q (git grep API_KEY/TOKEN/PASSWORD)
- [ ] Backup/restore smoke test o'tgan
- [ ] Offline rejim (Firebase yo'q) app to'liq ishlaydi
