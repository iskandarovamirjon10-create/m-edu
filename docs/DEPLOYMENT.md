# Deployment, Backup & Migration Runbook

This runbook covers production deployment, database migrations, backups and
rollback for the M-EDU monorepo. It is the operational companion to
`docs/V2_ARCHITECTURE.md`.

## 1. Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 20+ | API and web build |
| PostgreSQL 16 | Primary datastore (canonical — compose, CI and embedded test DB all use 16) |
| Redis 7+ | BullMQ queues, rate-limit storage, distributed locks |
| Docker / Compose | Reference stack (`docker-compose.yml`) |

Required environment variables (API):

```
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/medu
REDIS_URL=redis://host:6379
JWT_SECRET=<32+ chars>
PORT=3000
```

Production refuses to boot without `JWT_SECRET` (≥32 chars) and a reachable
Redis (`REDIS_ENABLED` must not be `false` in production).

## 2. Build & deploy

```bash
# install
npm ci

# quality gates (run these — do not skip)
npm run typecheck
npm run lint
npm run test

# build
npm run build          # turbo build: api + web

# database — ALWAYS deploy migrations before rolling the new API
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

# start (example: pm2)
pm2 start ecosystem.config.js --env production
```

Web image build (apps/web/Dockerfile):

```bash
docker build -t medu-web \
  --build-arg VITE_API_URL=https://api.example.com/api \
  apps/web
```

`VITE_API_URL` is baked at build time. If the API lives on the same origin
behind nginx (`/api/...`), leave it empty so the client defaults to `/api`.

## 3. Migrations

### Rules

1. **Never edit an already-applied migration.** Prisma records a checksum;
   changing the file makes `migrate status` report drift and can break deploys.
2. **Only forward migrations.** To change schema, create a new folder under
   `apps/api/prisma/migrations/<timestamp>_<name>/migration.sql`.
3. **One migration lock file** lives at `apps/api/prisma/migrations/migration_lock.toml`.
   Nested copies inside migration folders are invalid and must not exist.

### Deploy a migration

```bash
# inspect what will run (no changes)
npx prisma migrate status --schema apps/api/prisma/schema.prisma
npx prisma migrate diff \
  --from-schema-datasource apps/api/prisma/schema.prisma \
  --to-schema-datamodel apps/api/prisma/schema.prisma

# apply
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

### Recover from a failed migration

```bash
# mark the failed migration as rolled back (does not undo SQL already applied)
npx prisma migrate resolve --rolled-back <migration_name> --schema apps/api/prisma/schema.prisma

# fix forward with a NEW migration, then:
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

If history is irreconcilable on a **non-production** database only:

```bash
npx prisma migrate reset --schema apps/api/prisma/schema.prisma
```

Never run `migrate reset` against production.

## 4. Backup

### Nightly logical backup (pg_dump)

```bash
#!/usr/bin/env bash
set -euo pipefail
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT=/backups/medu-${STAMP}.sql.gz
pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip -9 > "$OUT"
# retention: keep 14 daily, 8 weekly
find /backups -name 'medu-*.sql.gz' -mtime +14 -delete
echo "Wrote $OUT"
```

Schedule with cron/systemd timer daily at 02:00 UTC.

### Continuous archiving (recommended for production)

Enable WAL archiving (`archive_mode=on`) and take a base backup with
`pg_basebackup` after the first deploy. Point-in-time recovery restores to
any second between base backup and last WAL segment.

### What to back up besides the database

- `.env` / secrets manager snapshots (JWT_SECRET, REDIS_URL, SMTP…)
- Uploaded document files / object-storage buckets
- `apps/api/prisma/migrations/` is already in git — no separate backup needed

## 5. Rollback

| Failure | Action |
|---|---|
| Bad API deploy (no migration) | Redeploy previous image/commit; restart |
| Bad API deploy (with migration) | Redeploy previous API **and** restore DB from pre-migration backup, OR write a compensating forward migration |
| Migration partially applied | `migrate resolve --rolled-back`, fix SQL, deploy a new migration |

Always take a backup immediately before a risky migration:

```bash
pg_dump "$DATABASE_URL" | gzip > /backups/pre-migrate-$(date -u +%Y%m%dT%H%M%SZ).sql.gz
```

## 6. Health checks

- API liveness & readiness: `GET /api/health`
- API readiness: `GET /ready` (DB + Redis)
- Web: `GET /` returns `index.html`

## 7. Secrets

- Never commit `.env`.
- Rotate `JWT_SECRET` by deploying with the new value and forcing re-login
  (old tokens become invalid immediately).
- Redis credentials via `REDIS_URL` (`redis://:pass@host:6379/0`).

## 8. Post-deploy verification checklist

1. `npx prisma migrate status` → "Database schema is up to date"
2. `GET /ready` → 200
3. Login works, one CRUD write + read round-trip per critical module
4. BullMQ: at least one job appears in the `background-jobs` queue after boot
5. No `UnhandledPromiseRejection` / `ioredis Unhandled error event` in logs

