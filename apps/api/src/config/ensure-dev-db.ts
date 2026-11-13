import { LoggerService } from '@nestjs/common';
import { Client } from 'pg';
import * as path from 'path';
import * as fs from 'fs';
import { execFileSync } from 'child_process';

function findInstalledPgCtl(): string | null {
  const candidateDirs = [
    'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_ctl.exe',
    'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_ctl.exe',
    'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_ctl.exe',
  ];
  for (const p of candidateDirs) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Ensures the PostgreSQL database is running during local development.
 *
 * 1. Pings 127.0.0.1:5432 to see if PostgreSQL (native, Docker, or embedded) is already up.
 * 2. If already up, verifies required dev databases exist and exits.
 * 3. If unreachable, launches the local embedded-postgres instance from apps/api/.pgtmp-dev.
 * 4. Cleans up stale postmaster.pid lock files if a previous process was killed abruptly.
 * 5. Ensures required dev databases (medu_cert_db1, medu_dev) are created.
 *
 * This runs ONLY when NODE_ENV !== 'production' and is a no-op in production.
 */
export async function ensureDevDatabase(logger: LoggerService): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const dbHost = '127.0.0.1';
  const dbPort = 5432;

  // 1. Check if PostgreSQL is already reachable
  const testClient = new Client({
    host: dbHost,
    port: dbPort,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
    connectionTimeoutMillis: 1200,
  });

  let isConnected = false;
  try {
    await testClient.connect();
    isConnected = true;
    logger.log(`[dev-db] PostgreSQL already reachable on ${dbHost}:${dbPort}`);
  } catch {
    isConnected = false;
  }

  if (isConnected) {
    try {
      await ensureRequiredDatabases(testClient, logger);
    } finally {
      await testClient.end().catch(() => {});
    }
    return;
  }

  // 2. Not running — start embedded postgres
  logger.log(`[dev-db] PostgreSQL not detected on ${dbHost}:${dbPort}. Starting embedded postgres...`);
  try {
    // Resolve .pgtmp-dev directory
    const candidates = [
      path.resolve(__dirname, '../../.pgtmp-dev'),
      path.resolve(process.cwd(), 'apps/api/.pgtmp-dev'),
      path.resolve(process.cwd(), '.pgtmp-dev'),
    ];
    let dbDir = candidates.find((c) => fs.existsSync(c));
    if (!dbDir) {
      dbDir = candidates[0];
    }

    // Clean up stale lock file if previous process crashed or died abruptly
    const pidPath = path.join(dbDir, 'postmaster.pid');
    if (fs.existsSync(pidPath)) {
      try {
        const content = fs.readFileSync(pidPath, 'utf8');
        const firstLine = content.split('\n')[0].trim();
        const pid = parseInt(firstLine, 10);
        if (!isNaN(pid)) {
          let isAlive = false;
          try {
            process.kill(pid, 0);
            isAlive = true;
          } catch {
            isAlive = false;
          }
          if (!isAlive) {
            logger.warn(`[dev-db] Removing stale postmaster.pid for dead PID ${pid}`);
            fs.unlinkSync(pidPath);
          }
        }
      } catch {
        // Ignore inspection errors
      }
    }

    const installedPgCtl = process.platform === 'win32' ? findInstalledPgCtl() : null;
    const isClusterInit = fs.existsSync(dbDir) && fs.existsSync(path.join(dbDir, 'PG_VERSION'));

    if (installedPgCtl && isClusterInit) {
      logger.log(`[dev-db] Starting PostgreSQL via installed pg_ctl: ${installedPgCtl}...`);
      const logPath = path.resolve(dbDir, '../.pgtmp-dev.log');
      try {
        execFileSync(installedPgCtl, ['start', '-D', dbDir, '-l', logPath]);
        logger.log(`[dev-db] PostgreSQL started via pg_ctl on port ${dbPort}.`);
      } catch (e: any) {
        logger.warn(`[dev-db] pg_ctl start note: ${e?.message}`);
      }
    } else {
      // Dynamic import embedded-postgres so production never bundles it
      const embeddedPostgresModule = await import('embedded-postgres');
      const EmbeddedPostgres = embeddedPostgresModule.default || embeddedPostgresModule;

      const pg = new EmbeddedPostgres({
        databaseDir: dbDir,
        user: 'postgres',
        password: 'postgres',
        port: dbPort,
        persistent: true,
        initdbFlags: ['--encoding=UTF8'],
      });

      if (!fs.existsSync(dbDir) || fs.readdirSync(dbDir).length === 0) {
        logger.log(`[dev-db] Initializing embedded postgres in ${dbDir}...`);
        await pg.initialise();
      }

      await pg.start();
      logger.log(`[dev-db] Embedded postgres successfully started on port ${dbPort}.`);
    }

    // Wait up to 10 seconds for newly started postgres to accept connections
    let client: Client | null = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const testClient = new Client({
          host: dbHost,
          port: dbPort,
          user: 'postgres',
          password: 'postgres',
          database: 'postgres',
          connectionTimeoutMillis: 2000,
        });
        await testClient.connect();
        client = testClient;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    if (!client) {
      throw new Error(`PostgreSQL failed to accept connections on port ${dbPort} after start.`);
    }

    await ensureRequiredDatabases(client, logger);
    await client.end().catch(() => {});
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[dev-db] Failed to start embedded postgres: ${msg}`);
  }
}

async function ensureRequiredDatabases(client: Client, logger: LoggerService): Promise<void> {
  const targetDbs = ['medu', 'medu_cert_db1', 'medu_dev'];
  for (const dbName of targetDbs) {
    try {
      const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
      if (res.rows.length === 0) {
        logger.log(`[dev-db] Creating database '${dbName}'...`);
        await client.query(`CREATE DATABASE ${dbName}`);
        logger.log(`[dev-db] Database '${dbName}' created.`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn(`[dev-db] Could not verify database '${dbName}': ${msg}`);
    }
  }
}
