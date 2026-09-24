/**
 * Migration verification harness (evidence for PHASE 20 — migration safety).
 *
 * Boots an EPHEMERAL embedded Postgres, applies every Prisma migration in
 * order, then asserts the new financial schema invariants. The database is
 * destroyed afterwards — no external service, no persistent state.
 *
 * Usage: npx tsx scripts/verify-migration.ts
 */
import { Client } from 'pg';
import embeddedPostgres from 'embedded-postgres';

async function main() {
  const path = await import('path');
  const port = 55432;
  const dbDir = path.resolve(__dirname, `../.pgtmp-migration-${Date.now()}`);
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
      await client.query(sql);
      console.log(`APPLIED  ${dir}`);
    }

    // ---- Assert new objects exist -----------------------------------------
    const objects = await client.query(`
      SELECT c.relname AS name, c.relkind AS kind
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('PayrollRun','Invoice','InvoiceItem','Refund')
    `);
    for (const want of ['PayrollRun', 'Invoice', 'InvoiceItem', 'Refund']) {
      check(
        `table ${want} exists`,
        objects.rows.some((r: { name: string }) => r.name === want),
      );
    }

    const enums = await client.query(`
      SELECT t.typname, e.enumlabel AS label
      FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname IN ('PayrollStatus','SalaryType','InvoiceStatus','RefundStatus','PaymentStatus')
      ORDER BY t.typname, e.enumsortorder
    `);
    const getEnum = (name: string): string[] =>
      enums.rows
        .filter((r: { typname: string }) => r.typname === name)
        .map((r: { label: string }) => r.label);

    check(
      'PaymentStatus gained PARTIALLY_PAID',
      getEnum('PaymentStatus').includes('PARTIALLY_PAID'),
      getEnum('PaymentStatus').join(','),
    );
    check(
      'PayrollStatus lifecycle correct',
      JSON.stringify(getEnum('PayrollStatus')) ===
        JSON.stringify(['DRAFT', 'CALCULATED', 'REVIEWED', 'APPROVED', 'PAID', 'CANCELLED']),
      getEnum('PayrollStatus').join(','),
    );

    // ---- Constraint evidence ----------------------------------------------
    const constraints = await client.query(`
      SELECT conname FROM pg_constraint
      WHERE conname IN (
        'PayrollRun_organizationId_teacherId_periodYear_periodMonth_key',
        'PayrollRun_periodMonth_check',
        'Invoice_organizationId_number_key',
        'Refund_organizationId_externalId_key',
        'Payment_organizationId_receiptNumber_key',
        'Invoice_discount_check',
        'Invoice_penalty_check'
      )
    `);
    const have = new Set(constraints.rows.map((r: { conname: string }) => r.conname));
    for (const want of [
      'PayrollRun_organizationId_teacherId_periodYear_periodMonth_key',
      'PayrollRun_periodMonth_check',
      'Invoice_organizationId_number_key',
      'Refund_organizationId_externalId_key',
      'Payment_organizationId_receiptNumber_key',
      'Invoice_discount_check',
      'Invoice_penalty_check',
    ]) {
      check(`constraint ${want}`, have.has(want));
    }

    // ---- Behavioral checks: duplicate payroll run must be rejected ---------
    await client.query(
      `INSERT INTO "Organization" ("id","name","email","updatedAt")
       VALUES ('11111111-1111-1111-1111-111111111111','T','t@t.test', NOW())`,
    );
    await client.query(
      `INSERT INTO "User" ("id","organizationId","email","firstName","lastName","role","updatedAt")
       VALUES ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','u@t.test','A','B','TEACHER', NOW())`,
    );
    await client.query(
      `INSERT INTO "Teacher" ("id","organizationId","userId","updatedAt") VALUES
       ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222', NOW())`,
    );
    await client.query(
      `INSERT INTO "PayrollRun" ("id","organizationId","teacherId","periodYear","periodMonth","status","salaryType","updatedAt")
       VALUES ('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333',2026,9,'CALCULATED','MONTHLY', NOW())`,
    );
    let duplicateRejected = false;
    try {
      await client.query(
        `INSERT INTO "PayrollRun" ("id","organizationId","teacherId","periodYear","periodMonth","status","salaryType","updatedAt")
         VALUES ('55555555-5555-5555-5555-555555555555','11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333',2026,9,'CALCULATED','MONTHLY', NOW())`,
      );
    } catch {
      duplicateRejected = true;
    }
    check('duplicate payroll run per period rejected by DB', duplicateRejected);

    let invalidMonthRejected = false;
    try {
      await client.query(
        `INSERT INTO "PayrollRun" ("id","organizationId","teacherId","periodYear","periodMonth","status","salaryType","updatedAt")
         VALUES ('66666666-6666-6666-6666-666666666666','11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333',2026,13,'CALCULATED','MONTHLY', NOW())`,
      );
    } catch {
      invalidMonthRejected = true;
    }
    check('periodMonth CHECK rejects month 13', invalidMonthRejected);
  } finally {
    await client.end().catch(() => {});
    await pg.stop().catch(() => {});
    try {
      fs.rmSync(dbDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
    } catch {
      // Ignored: Windows process handle release latency on ephemeral directory
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} migration check(s) FAILED`);
    process.exit(1);
  }
  console.log('\nAll migration checks passed.');
}

main().catch((err) => {
  console.error('Migration verification crashed:', err);
  process.exit(1);
});
