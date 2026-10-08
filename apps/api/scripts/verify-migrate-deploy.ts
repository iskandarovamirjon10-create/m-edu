/**
 * Production-grade migration deploy verification.
 *
 * Boots an EPHEMERAL embedded PostgreSQL 16 (UTF8 — the canonical version
 * used by docker-compose, CI and this test environment), runs the REAL
 * `prisma migrate deploy` against it, then `prisma migrate status` to prove
 * the database ends up fully up-to-date. The cluster is destroyed afterwards.
 *
 * Usage: npx tsx scripts/verify-migrate-deploy.ts
 * Exit code 0 = deploy + status verified; 1 = failure.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import embeddedPostgres from 'embedded-postgres';

const execFileAsync = promisify(execFile);

async function main() {
  const path = await import('path');
  const fs = await import('fs');
  const port = 55440;
  const dbDir = path.resolve(__dirname, `../.pgtmp-deploy-verify-${Date.now()}`);
  const pg = new embeddedPostgres({
    databaseDir: dbDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
    initdbFlags: ['--encoding=UTF8'],
    onLog: () => {},
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase('medu_deploy_verify');

  const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/medu_deploy_verify`;
  const prismaDir = path.resolve(__dirname, '..');

  try {
    // ---- REAL `prisma migrate deploy` -------------------------------------
    const deploy = await execFileAsync(
      'npx',
      ['prisma', 'migrate', 'deploy'],
      {
        cwd: prismaDir,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        timeout: 300_000,
        // Windows cannot spawn npx.cmd without a shell (spawn EINVAL).
        shell: process.platform === 'win32',
      },
    );
    console.log('--- prisma migrate deploy ---');
    console.log(deploy.stdout.trim());
    if (!/applied|Already in sync|Database schema/i.test(deploy.stdout)) {
      throw new Error('migrate deploy produced no recognisable success output');
    }

    // ---- `prisma migrate status` must be fully up-to-date -----------------
    const status = await execFileAsync(
      'npx',
      ['prisma', 'migrate', 'status'],
      {
        cwd: prismaDir,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        timeout: 300_000,
        shell: process.platform === 'win32',
      },
    );
    console.log('--- prisma migrate status ---');
    console.log(status.stdout.trim());
    if (!/up to date/i.test(status.stdout)) {
      throw new Error('migrate status does not report the schema as up to date');
    }
    if (/pending/i.test(status.stdout)) {
      throw new Error('migrate status still reports pending migrations');
    }

    console.log('\nPASS  prisma migrate deploy + migrate status verified on PostgreSQL 16 (UTF8)');
  } finally {
    await pg.stop().catch(() => {});
    try {
      fs.rmSync(dbDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
    } catch {
      // Windows may hold the directory handle briefly — safe to ignore.
    }
  }
}

main().catch((err) => {
  console.error('MIGRATE DEPLOY VERIFICATION FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
