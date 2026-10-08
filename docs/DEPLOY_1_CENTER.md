# M-EDU — Bitta o'quv markaz uchun deploy qo'llanma

> Maqsad: **bitta markaz**, ruхsat/lokal xavfsiz arxitektura, minimal narx.
> Bu qo'llanma kod holatiga mos (commit `ab500c4` va undan oldin):
> PostgreSQL 16, Redis 7, NestJS API, Vite web, docker-compose va Dockerfile tayyor.

## 1. Asosiy qaror: server QAYERDA?

M-EDUning o'ziga xos xususiyati — kamera/face pipeline. Kameralar markazning
ichki tarmog'ida (masalan `192.168.1.x`). Production `config.validate`:
`ALLOW_LOCAL_CAMERAS=true` **majburiy taqiqlangan** (SSRF). Demak API ham
markazning ichki tarmog'ida turishadi.

| Variant | Narx | Kameralar | Qachon |
|---|---|---|---|
| **A. Markazdagi PC/NUC + Cloudflare Tunnel** | **0$/oy** | ✅ 100% | Asosiy tavsiya |
| **B. VPS (2-4 GB) + ZeroTier/Tailscale** | ~$5-8/oy | ✅ tunnel орqali | kuchliroq VPS (kameralar tunnel orqali) uchun |
| **C. VPS, kamerasiz** (faqat CRM/foizlar) | ~$4-6/oy | ❌ | Kamera hozircha kerak emas |

## 2. Variant A — 0$/oy (markazdagi mashina + tunnel)

### Texnik ta'lab (markazdagi mashina)
- Windows 10/11 yoki Linux, 4+ GB RAM (face model + API + PG + Redis yetarli)
- Docker Desktop (Windows) yoki docker + docker-compose plugin (Linux)
- Kameralar bilan bir xil LAN'da

### Qadamlar
```bash
# 1. .env ni tayyorlash (namuna: .env.example tamom)
cp .env.example .env
# NODE_ENV, DATABASE_URL, JWT_SECRET, BIOMETRIC_ENCRYPTION_KEY,
# CAMERA_ENCRYPTION_KEY, FACE_*_MODEL_PATH, CORS_ORIGIN, NEXT_PUBLIC_APP_URL,
# SMTP_PASSWORD, GEMINI_API_KEY, TELEGRAM_* ... real qiymatlar bilan

# 2. Lokal test: DB+API+web compose orqali
docker compose up -d db redis
docker compose run --rm migration     # prisma migrate deploy
docker compose up -d api web
# tekshirish: http://localhost:3001/api/health -> {"status":"ok"}

# 3. Internetga chiqish — Cloudflare Tunnel (bepul, HTTPS)
#    cloudflared token link (Zero Trust > Networks > Tunnels) oling:
cloudflared tunnel --url http://localhost:3001
# => https://<random>.trycloudflare.com  (vaqtinchalik)
# Yoki doimiy tunnel: DNS record -> https://medu.sizning-domayn.uz

# 4. Frontendni tunnel orqali serve qilish
#    nginx allaqachon web:80 -> api:3000 proxy qiladi (apps/web/nginx.conf).
#    VITE_API_URL=/api qilib qurilgan dist yetarli.
```

### Bepul "doimiy" HTTPS (tavsiya)
- Free domain: `duckdns.org` (bepul `*.duckdns.org`) yoki arzon `.uz`
- Cloudflare Tunnel **doimiy** record: `medu.<domain>` → tunnel
- Google OAuth callback: `https://medu.<domain>/api/auth/google/callback`
- Telegram webhook: `https://medu.<domain>/api/webhooks/telegram`

## 3. Variant C — VPS (kamerasiz, faqat boshqaruv moduli)

- **Hetzner CAX11** (~€3.8/oy, 2vCPU/4GB) yoki DigitalOcean $6 basic
- 4 GB RAM: kamerasiz bo'lsa yetarli (face model yuklanmaydi)
- `docker compose` ni repo'dan ko'chirib, SSL (Caddy yoki certbot) o'rnatib,
  VITE_API_URL=https://api-hosting.uz/api

## 4. Bitta markaz uchun oylik byudjet

| Xizmat | Narx | Izoh |
|---|---|---|
| Infrastrutura (Variant A) | 0$ | elektr + internet |
| Frontend/HTTPS | 0$ | Cloudflare Tunnel + duckdns |
| PostgreSQL + Redis | 0$ | docker'da |
| Google OAuth | 0$ | Google Console |
| Telegram bot | 0$ | @BotFather |
| Gemini AI | 0$ (free tier) | RPD cheklangan |
| Email (SMTP) | 0$ tier (Resend/Brevo 100-300/kun) | parol-reset |
| **SMS** | **~0.02-0.06$ / xabar** | Eskiz/PlayMobile — yagona real xarajat |

## 5. Xavfsizlik choralari
- `NODE_ENV=production` + barcha secretlar `.env`da (≥32 belgi)
- `CORS_ORIGIN` = frontendning tunldan ko'rinadigan URL (masalan https://medu.sizningdomen.uz)
- DB backup har kuni: emas, balki
  `docker exec db pg_dump medu > backup-$(date).sql` + arxiv
- VMware/HTTPS majburiy (OAuth + Secure cookie uchun)

## 6. Tekshiruv ro'yxati (birinchi soat)

- [ ] `/api/health` → `{"status":"ok","database":"up"}`
- [ ] `/api/readiness` → 200
- [ ] Web: login sahifasi ochilyapti; bog'langan yo'l `https://medu.<domain>/login`
- [ ] `VITE_API_URL` xatosiz; `/api/...` proxylar ishlamoqda
- [ ] Google OAuth callback keldi
- [ ] Telegram webhook `setWebhook` yozildi (bot ga yozish bilan sinaladi)
- [ ] Face: kamera qo'shildi, jonli stream ko'rinadi
- [ ] SMS: bitta haqiqiy raqamga test SMS yuborildi
- [ ] Parol-reset email keldi

## 7. Chegara cheklovlari (nima bepul EMAS)

- SMS — har bir xabar hisoblanadi (chastotani kamaytirish uchun
  `SMS_PROVIDER` bilan faqat muhim xabarlarni yo'naltirib)
- Gemini free tier — kuniga token limiti (chat/so'rov hajmini kerak bo'lsa o'chirib qo'yish mumkin)
- Free tunnel (trycloudflare) — vaqtinchalik; doimiy tunnel uchun Zero Trust
  token kerak (bepul).

---

**Yakuniy tavsiya:** Variant A = 0$/oy, barcha funktsiyalar (kamara + face)
mahalliy LANda ishlaydi, tashqariga HTTPS orqali tunnel. Yagona real pul —
SMS (o'quv markazning xabar hajmidan kelib, oyiga ~$2-8).
