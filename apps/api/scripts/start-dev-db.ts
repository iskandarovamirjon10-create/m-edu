import path from 'path';
import fs from 'fs';
import embeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';

async function main() {
  const dbDir = path.resolve(__dirname, '../.pgtmp-dev');
  const port = 5432;

  // Clean up stale lock file if previous process died abruptly
  const pidPath = path.join(dbDir, 'postmaster.pid');
  if (fs.existsSync(pidPath)) {
    try {
      const content = fs.readFileSync(pidPath, 'utf8');
      const firstLine = content.split('\n')[0].trim();
      const pid = parseInt(firstLine, 10);
      if (!isNaN(pid)) {
        try {
          process.kill(pid, 0);
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
  const testClient = new Client({
    host: '127.0.0.1',
    port,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
    connectionTimeoutMillis: 1000,
  });

  let alreadyRunning = false;
  try {
    await testClient.connect();
    alreadyRunning = true;
    console.log('PostgreSQL is already running on port 5432.');
  } catch {
    alreadyRunning = false;
  }

  if (!alreadyRunning) {
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

  const client = alreadyRunning
    ? testClient
    : new Client({
        host: '127.0.0.1',
        port,
        user: 'postgres',
        password: 'postgres',
        database: 'postgres',
      });

  if (!alreadyRunning) {
    await client.connect();
  }

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
