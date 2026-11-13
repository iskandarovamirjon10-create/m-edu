import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';
import embeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';

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

async function tryConnect(port: number, timeoutMs = 3000): Promise<Client | null> {
  const client = new Client({
    host: '127.0.0.1',
    port,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
    connectionTimeoutMillis: timeoutMs,
  });
  try {
    await client.connect();
    return client;
  } catch {
    return null;
  }
}

async function main() {
  const dbDir = path.resolve(__dirname, '../.pgtmp-dev');
  const port = 5432;

  // Clean up stale lock file if previous process died abruptly
  const pidPath = path.join(dbDir, 'postmaster.pid');
  let processAlive = false;
  if (fs.existsSync(pidPath)) {
    try {
      const content = fs.readFileSync(pidPath, 'utf8');
      const firstLine = content.split('\n')[0].trim();
      const pid = parseInt(firstLine, 10);
      if (!isNaN(pid)) {
        try {
          process.kill(pid, 0);
          processAlive = true;
        } catch {
          console.log(`Removing stale postmaster.pid for dead PID ${pid}...`);
          fs.unlinkSync(pidPath);
        }
      }
    } catch {
      // Ignore
    }
  }

  // Check if port 5432 is already running
  let activeClient: Client | null = await tryConnect(port, 3000);

  if (!activeClient && processAlive) {
    // Process is alive but might still be completing crash recovery / startup
    for (let i = 1; i <= 5; i++) {
      console.log(`Waiting for existing postgres (PID in postmaster.pid) to accept connections (${i}/5)...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      activeClient = await tryConnect(port, 3000);
      if (activeClient) break;
    }
  }

  if (activeClient) {
    console.log('PostgreSQL is already running on port 5432.');
  } else {
    const installedPgCtl = process.platform === 'win32' ? findInstalledPgCtl() : null;
    const isClusterInit = fs.existsSync(dbDir) && fs.existsSync(path.join(dbDir, 'PG_VERSION'));

    if (installedPgCtl && isClusterInit) {
      console.log(`Starting PostgreSQL via installed pg_ctl: ${installedPgCtl}...`);
      const logPath = path.resolve(__dirname, '../.pgtmp-dev.log');
      try {
        execFileSync(installedPgCtl, ['start', '-D', dbDir, '-l', logPath]);
      } catch (e: any) {
        console.warn(`pg_ctl start returned error, checking if server started: ${e?.message}`);
      }
    } else {
      const pg = new embeddedPostgres({
        databaseDir: dbDir,
        user: 'postgres',
        password: 'postgres',
        port,
        persistent: true,
        initdbFlags: ['--encoding=UTF8'],
      });

      if (!fs.existsSync(dbDir) || fs.readdirSync(dbDir).length === 0) {
        console.log('Initializing embedded postgres in', dbDir);
        await pg.initialise();
      }
      console.log('Starting embedded postgres on port 5432...');
      await pg.start();
      console.log('Embedded postgres running on port 5432.');
    }

    // Wait up to 10 seconds for newly started postgres to accept connections
    for (let attempt = 1; attempt <= 5; attempt++) {
      activeClient = await tryConnect(port, 2000);
      if (activeClient) break;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    if (!activeClient) {
      throw new Error('PostgreSQL failed to accept connections on port 5432 after start.');
    }
  }

  const client = activeClient;

  const targetDatabases = ['medu_cert_db1', 'medu_dev'];
  for (const dbName of targetDatabases) {
    const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (res.rows.length === 0) {
      console.log(`Creating database '${dbName}'...`);
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`Database '${dbName}' created.`);
    } else {
      console.log(`Database '${dbName}' already exists.`);
    }
  }
  await client.end();

  console.log('POSTGRES_READY_ON_5432');

  // Keep process alive indefinitely
  setInterval(() => {}, 60000);
}

main().catch((err) => {
  console.error('Failed to start postgres:', err);
  process.exit(1);
});
