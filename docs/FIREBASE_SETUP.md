# M-Edu — Firebase Integration

## Arxitektura: runtime secure config

Firebase client konfiguratsiyasi **source code'da emas**. Ilova ishga
tushganda `FirebaseBootstrap.initialize()` quyidagilarni qiladi:

1. `--dart-define=FIREBASE_CONFIG_PATH=/abs/path.json` bo'lsa — o'sha fayl;
2. aks holda qurilma app-support papkasidagi `m_edu_firebase.json`;
3. fayl yo'q / noto'g'ri bo'lsa → Firebase ishga tushmaydi →
   `isFirebaseConfigured=false` → **sync engine o'chirilgan**, app
   offline-first ishlashda davom etadi (crash yo'q, mock yo'q).

`m_edu_firebase.json` formati:

```json
{
  "apiKey": "...",
  "appId": "...",
  "projectId": "...",
  "messagingSenderId": "...",
  "storageBucket": "...",
  "authDomain": "..."
}
```

## O'rnatish (bir marta)

1. Firebase konsolda loyiha yarat (masalan `m-edu-prod`).
2. Android app qo'shish: package `com.medu.m_edu` (android/app/build.gradle).
   Web/Windows app qo'shish shart emas (Firestore faqat backend).
3. Firestore'ni yoqib, ma'lumotlarni yozish uchun **service account** bilan
   server SDK (Cloud Functions yoki admin SDK) kerak — chunki rules bo'yicha
   `sync/` yozuvlarini faqat server yozadi (client to'g'ridan-to'g'ri
   yozolmaydi).
4. Konfiguratsiyani qurilmaga joylash:
   - Android: `adb push m_edu_firebase.json /data/local/tmp/` →
     `run-as com.medu.m_edu cp /data/local/tmp/m_edu_firebase.json files/`
   - Windows: `%APPDATA%\<app-support>/m_edu_firebase.json`

## Security Rules

`config/firestore.rules` — server tomonida RBAC (UI'dagi `if (isAdmin)` —
security EMAS):

- **fail-closed**: autentifikatsiyasiz / noma'lum rol → hech narsaga ruxsat yo'q.
- Rol custom claims orqali: `admin.setCustomUserClaims(uid, { role: 'admin' })`.
- `sync/` — read: manager+, write: **serverOnly** (client yozmaydi).
- `users/` — faqat super_admin.
- `payments/` — read: manager+ yoki teacher (financeView), write: manager+.
- `attendance/` — teacher belgilay oladi, delete: admin+.
- `audit_logs/` — server yozadi, admin+ o'qiydi.
- **Biometrik/face data — cloud'da HECH QACHON** (default deny, match yo'q).

Rules'ni tekshiruvchi test: `test/unit/firestore_rules_test.dart` (rules
faylini mirror qiluvchi model bilan negativ matritsa — emulatorsiz).

Deploy:

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
# yoki emulatorda:
firebase emulators:start --only firestore
```

## Indexes

`config/firestore.indexes.json` — sync query'lar uchun kompozit indekslar
(`sync/{type}/items` collectionGroup bo'yicha: status+createdAt,
version+updatedAt, updatedByDevice+updatedAt).

## Sync data model (Firestore)

```
sync/{entityType}/items/{entityId}
  { data: {...payload}, version: int, updatedByDevice: str, updatedAt: timestamp }
```

Conflict strategiyasi: **versiya + server timestamp (LWW)**. Client versiyasi
remote'dan eski bo'lsa — `conflict` qaytariladi (jimgina data loss yo'q),
SyncEngine yozuvni `conflict` holatiga qo'yadi.

## Kredensiallar

- Firebase API kalitlari `m_edu_firebase.json`'da (qurilmada) — **git'ga
  kirmaydi** (fayl `.gitignore` emas, lekin source'da ham yo'q; faylni
  git'ga qo'shmang).
- Rules rol claims'ini o'rnatuvchi admin SDK service account — developer
  muhitida, git'ga kirmaydi.
- Placeholder kalitlar (YOUR_API_KEY) source'dan olib tashlandi — hech
  qanday fake/demo kalit mavjud emas.
