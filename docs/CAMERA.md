# M-Edu — Camera (Hikvision + qurilma kamerasi)

## Hikvision (RTSP/ISAPI/ONVIF)

`CameraStreamService` — Hikvision kameralari bilan ishlash:

- **RTSP stream** (media_kit orqali video ko'rsatish + kadr olish)
- **ISAPI** (snapshot, snapshot_failure → graceful)
- **ONVIF discovery** (tarmoqdagi kameralarni topish)
- Konfiguratsiya Sozlamalar sahifasida: IP, port, username, kanal, RTSP
  path. **Parol secure storage'da** (Isar'da emas).

`HikvisionCameraConfig` — `isValid()` tekshiruvi, `rtspUrl` qurilishi
(default path `/Streaming/Channels/101`, custom path qo'llab-quvvatlanadi).

## Failure handling (real-world)

| Scenario | Holat |
|---|---|
| camera online | to'liq ishlaydi |
| camera offline | UI holat ko'rsatadi, app buzilmaydi |
| wrong password / wrong IP | ISAPI/RTSP xato → xato yutiladi, UI xabar |
| RTSP timeout | timeout → disconnect → qayta urinish |
| network loss | stream uziladi → UI "kamera yo'q" holati |
| reconnect | `scanIntervalMs` bo'yicha qayta urinish |
| camera restart | keyingi skan sikli tiklaydi |
| multiple cameras | konfiguratsiya kanal bo'yicha |
| snapshot failure | kadr olib bo'lmasa → davomat belgilanmaydi |

Muhim qoidalar:

- **Kamera ishlamasa butun attendance system buzilmaydi** — manual va QR
  usullar to'liq ishlaydi.
- `CameraStreamService.open()` — bitta sessiya, `dispose`/resource cleanup
  to'g'ri bajariladi.
- Kamera paroli `AppLogger.redact` orqali log'dan avtomatik chiqariladi
  (rtsp://user:pass@ → rtsp://***@).

## Qurilma kamerasi (Android)

- `camera` plugin (androidx.camera), `mobile_scanner` (QR).
- Permissions: `Permission.camera` faqat Android/iOS'da so'raladi
  (desktop'da MissingPluginException yutiladi).
- `face_scan_page` — kadr olish + ML Kit pipeline (backpressure bor).

## Testlar

- `test/unit/hikvision_config_provider_test.dart` — konfiguratsiya
  (empty username → admin fallback, rtspUrl qurilishi, isValid).
- Live kamera testi real qurilmada (dev-only, `tool/dump_device_db_test.dart`
  diagnostika bilan).
