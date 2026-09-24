import path from 'path';
import fs from 'fs';
import embeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';

async function main() {
  const dbDir = path.resolve(__dirname, '../.pgtmp-dev');
  const pg = new embeddedPostgres({
    databaseDir: dbDir,
    user: 'postgres',
    password: 'postgres',
    port: 5432,
    persistent: true,
  });

  if (!fs.existsSync(dbDir) || fs.readdirSync(dbDir).length === 0) {
    console.log('Initializing embedded postgres in', dbDir);
    await pg.initialise();
  }
  console.log('Starting embedded postgres on port 5432...');
  await pg.start();
  console.log('Embedded postgres running on port 5432.');

  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  });
  await client.connect();
  const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'medu_dev'");
  if (res.rows.length === 0) {
    console.log("Creating database 'medu_dev'...");
    await client.query("CREATE DATABASE medu_dev");
    console.log("Database 'medu_dev' created.");
  } else {
    console.log("Database 'medu_dev' already exists.");
  }
  await client.end();

  console.log("POSTGRES_READY_ON_5432");

  // Keep process alive indefinitely
  setInterval(() => {}, 60000);
}

main().catch((err) => {
  console.error('Failed to start postgres:', err);
  process.exit(1);
});
