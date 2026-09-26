/**
 * Telegram migration verification harness.
 *
 * Boots an EPHEMERAL embedded Postgres, applies every Prisma migration in
 * order, then asserts the Telegram foundation objects exist with the right
 * uniqueness guarantees. The database is destroyed afterwards — no external
 * service, no persistent state.
 *
 * Pre-existing migration failures (drift unrelated to Telegram) are reported
 * separately and do NOT fail the run; only the Telegram checks determine the
 * exit code.
 *
 * Usage: npx tsx scripts/verify-telegram-migration.ts
 */
import { Client } from 'pg';
import embeddedPostgres from 'embedded-postgres';

const TELEGRAM_TABLES = [
  'TelegramAccount',
  'TelegramLinkToken',
  'TelegramUpdate',
  // Slice 3 — delivery tracking
  'NotificationDelivery',
];
const TELEGRAM_UNIQUE_INDEXES = [
  'TelegramAccount_telegramUserId_key',
  'TelegramAccount_chatId_key',
  'TelegramLinkToken_tokenHash_key',
  // Exactly one delivery record per (event, principal, channel).
  'NotificationDelivery_dedupKey_key',
];
const TELEGRAM_FOREIGN_KEYS = [
  'TelegramAccount_organizationId_fkey',
  'TelegramAccount_userId_fkey',
  'TelegramAccount_parentAccountId_fkey',
  'TelegramLinkToken_organizationId_fkey',
  'NotificationDelivery_organizationId_fkey',
];

/** Secondary indexes the delivery sweep + retention jobs depend on. */
const TELEGRAM_DELIVERY_INDEXES = [
  'NotificationDelivery_status_deferredUntil_idx',
  'NotificationDelivery_createdAt_idx',
  'NotificationDelivery_organizationId_status_idx',
  'NotificationDelivery_telegramAccountId_idx',
];

/** Columns added by the Slice-3 migration. */
const TELEGRAM_COLUMNS: Array<[string, string]> = [
  ['UserSettings', 'telegramNotifications'],
  ['UserSettings', 'quietHoursEnabled'],
  ['UserSettings', 'quietHoursStart'],
  ['UserSettings', 'quietHoursEnd'],
  ['NotificationPreference', 'telegramEnabled'],
];

async function main() {
  const path = await import('path');
  const port = 55433;
  const dbDir = path.resolve(__dirname, `../.pgtmp-telegram-${Date.now()}`);
  const pg = new embeddedPostgres({
    databaseDir: dbDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
  });

  await pg.initialise();
  await pg.start();
  const client = new Client({
    host: '127.0.0.1',
    port,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  });
  await client.connect();

  let failures = 0;
  const preExisting: string[] = [];
  const check = (name: string, ok: boolean, extra = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
    if (!ok) failures++;
  };

  try {
    const fs = await import('fs');
    const migrationsDir = path.resolve(__dirname, '../prisma/migrations');
    const dirs = fs
      .readdirSync(migrationsDir)
      .filter((d) => fs.statSync(path.join(migrationsDir, d)).isDirectory())
      .sort();

    for (const dir of dirs) {
      const sql = fs.readFileSync(path.join(migrationsDir, dir, 'migration.sql'), 'utf8');
      try {
        await client.query(sql);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (dir.includes('telegram')) {
          check(`migration ${dir} applies`, false, message);
        } else {
          preExisting.push(`${dir}: ${message}`);
        }
      }
    }

    // ---- tables -----------------------------------------------------------
    const tables = await client.query(
      `SELECT c.relname AS name FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY($1)`,
      [TELEGRAM_TABLES],
    );
    for (const table of TELEGRAM_TABLES) {
      check(
        `table ${table} exists`,
        tables.rows.some((r: { name: string }) => r.name === table),
      );
    }

    // ---- enum -------------------------------------------------------------
    const enumRows = await client.query(
      `SELECT e.enumlabel AS label FROM pg_type t
         JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'TelegramAccountStatus'
        ORDER BY e.enumsortorder`,
    );
    const labels = enumRows.rows.map((r: { label: string }) => r.label);
    check(
      'enum TelegramAccountStatus has the four lifecycle states',
      JSON.stringify(labels) === JSON.stringify(['ACTIVE', 'DISCONNECTED', 'BLOCKED', 'SUSPENDED']),
      labels.join(','),
    );

    // ---- unique indexes ---------------------------------------------------
    const indexes = await client.query(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = ANY($1)`,
      [TELEGRAM_UNIQUE_INDEXES],
    );
    for (const name of TELEGRAM_UNIQUE_INDEXES) {
      check(
        `unique index ${name} exists`,
        indexes.rows.some((r: { indexname: string }) => r.indexname === name),
      );
    }

    // ---- foreign keys -----------------------------------------------------
    const fks = await client.query(
      `SELECT conname FROM pg_constraint WHERE conname = ANY($1)`,
      [TELEGRAM_FOREIGN_KEYS],
    );
    for (const name of TELEGRAM_FOREIGN_KEYS) {
      check(
        `foreign key ${name} exists`,
        fks.rows.some((r: { conname: string }) => r.conname === name),
      );
    }

    // ---- Slice 3: delivery-tracking indexes -------------------------------
    const deliveryIndexes = await client.query(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = ANY($1)`,
      [TELEGRAM_DELIVERY_INDEXES],
    );
    for (const name of TELEGRAM_DELIVERY_INDEXES) {
      check(
        `index ${name} exists`,
        deliveryIndexes.rows.some((r: { indexname: string }) => r.indexname === name),
      );
    }

    // ---- Slice 3: delivery lifecycle enum ---------------------------------
    const deliveryEnum = await client.query(
      `SELECT e.enumlabel AS label FROM pg_type t
         JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'NotificationDeliveryStatus'
        ORDER BY e.enumsortorder`,
    );
    const deliveryLabels = deliveryEnum.rows.map((r: { label: string }) => r.label);
    check(
      'enum NotificationDeliveryStatus has the delivery lifecycle states',
      JSON.stringify(deliveryLabels) ===
        JSON.stringify(['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED', 'DEFERRED']),
      deliveryLabels.join(','),
    );

    // ---- Slice 3: settings + preference columns ---------------------------
    for (const [table, column] of TELEGRAM_COLUMNS) {
      const found = await client.query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [table, column],
      );
      check(`column ${table}.${column} exists`, found.rowCount === 1);
    }

    // ---- live uniqueness guarantee on the dedup ledger --------------------
    await client.query(
      `INSERT INTO "TelegramUpdate" ("updateId") VALUES (10001)`,
    );
    let duplicateRejected = false;
    try {
      await client.query(`INSERT INTO "TelegramUpdate" ("updateId") VALUES (10001)`);
    } catch {
      duplicateRejected = true;
    }
    check('duplicate update_id is rejected by the primary key', duplicateRejected);

    // ---- live uniqueness guarantee on delivery tracking -------------------
    const org = await client.query(`SELECT id FROM "Organization" LIMIT 1`);
    const organizationId =
      (org.rows[0] as { id?: string } | undefined)?.id ?? '00000000-0000-0000-0000-000000000001';
    await client.query(
      `INSERT INTO "Organization" ("id", "name", "email", "updatedAt")
       VALUES ($1, 'retention-test', 'retention@example.test', now())
       ON CONFLICT ("id") DO NOTHING`,
      [organizationId],
    );
    const insertDelivery = `
      INSERT INTO "NotificationDelivery"
        ("id", "organizationId", "eventId", "eventType", "entityType", "entityId",
         "principalType", "principalId", "dedupKey", "updatedAt")
      VALUES (gen_random_uuid(), $1, 'job-1', 'ATTENDANCE_MARKED_ABSENT', 'Attendance', 'att-1',
              'PARENT_ACCOUNT', gen_random_uuid(), 'dedup-1', now())`;
    await client.query(insertDelivery, [organizationId]);
    let duplicateDeliveryRejected = false;
    try {
      await client.query(insertDelivery, [organizationId]);
    } catch {
      duplicateDeliveryRejected = true;
    }
    check(
      'duplicate delivery dedupKey is rejected by the unique index',
      duplicateDeliveryRejected,
    );
  } finally {
    await client.end().catch(() => {});
    await pg.stop().catch(() => {});
    try {
      (await import('fs')).rmSync(dbDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
    } catch {
      // Ignored: Windows process handle release latency on ephemeral directory
    }
  }

  if (preExisting.length > 0) {
    console.log(`\nNOTE: ${preExisting.length} pre-existing (non-Telegram) migration file(s) did not apply:`);
    for (const line of preExisting) console.log(`  - ${line}`);
  }

  if (failures > 0) {
    console.error(`\n${failures} Telegram migration check(s) FAILED`);
    process.exit(1);
  }
  console.log('\nAll Telegram migration checks passed.');
}

main().catch((err) => {
  console.error('Telegram migration verification crashed:', err);
  process.exit(1);
});
