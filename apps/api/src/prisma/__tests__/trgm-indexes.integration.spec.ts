import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

describe('Database Trigram Indexes & Schema Parity (F-01, F-05, F-06)', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client(
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/medu_test',
    );
    await client.connect();
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
  });

  it('all intended *trgm* indexes use GIN access method and none use BTREE', async () => {
    const res = await client.query<{
      tablename: string;
      indexname: string;
      indexdef: string;
    }>(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND indexname LIKE '%trgm%'
      ORDER BY tablename, indexname
    `);

    expect(res.rows.length).toBeGreaterThanOrEqual(18);

    const btreeTrgmIndexes: string[] = [];
    const ginTrgmIndexes: string[] = [];

    for (const row of res.rows) {
      const defLower = row.indexdef.toLowerCase();
      if (defLower.includes('using btree')) {
        btreeTrgmIndexes.push(`${row.tablename}.${row.indexname}`);
      } else if (defLower.includes('using gin') && defLower.includes('gin_trgm_ops')) {
        ginTrgmIndexes.push(`${row.tablename}.${row.indexname}`);
      }
    }

    // Invariant: No intended trigram index is BTREE
    expect(btreeTrgmIndexes).toEqual([]);

    // Invariant: All intended trigram indexes are GIN with gin_trgm_ops
    expect(ginTrgmIndexes.length).toBe(res.rows.length);

    // Verify key tables are present
    const indexedTables = new Set(res.rows.map((r) => r.tablename));
    expect(indexedTables.has('User')).toBe(true);
    expect(indexedTables.has('Course')).toBe(true);
    expect(indexedTables.has('Group')).toBe(true);
    expect(indexedTables.has('Lead')).toBe(true);
    expect(indexedTables.has('LibraryBook')).toBe(true);
    expect(indexedTables.has('Payment')).toBe(true);
    expect(indexedTables.has('Employee')).toBe(true);
    expect(indexedTables.has('Certificate')).toBe(true);
  });

  it('query planner uses GIN trigram index for ILIKE %query% queries', async () => {
    await client.query('SET enable_seqscan = off');

    const testQueries = [
      {
        table: 'User',
        sql: `EXPLAIN SELECT id, email FROM "User" WHERE email ILIKE '%search%'`,
        index: 'user_email_trgm_idx',
      },
      {
        table: 'Course',
        sql: `EXPLAIN SELECT id, name FROM "Course" WHERE name ILIKE '%math%'`,
        index: 'course_name_trgm_idx',
      },
      {
        table: 'Lead',
        sql: `EXPLAIN SELECT id, "lastName" FROM "Lead" WHERE "lastName" ILIKE '%doe%'`,
        index: 'lead_last_name_trgm_idx',
      },
    ];

    for (const q of testQueries) {
      const res = await client.query<{ 'QUERY PLAN': string }>(q.sql);
      const plan = res.rows.map((r) => r['QUERY PLAN']).join('\n');
      expect(plan).toContain('Bitmap Index Scan');
      expect(plan).toContain(q.index);
    }

    await client.query('SET enable_seqscan = on');
  });

  it('UserSettings.quietHoursEnabled is NOT NULL with default false', async () => {
    const res = await client.query<{
      column_name: string;
      is_nullable: string;
      column_default: string;
    }>(`
      SELECT column_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'UserSettings' AND column_name = 'quietHoursEnabled'
    `);

    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].is_nullable).toBe('NO');
    expect(res.rows[0].column_default).toContain('false');
  });

  it('phantom foreign key and lookup indexes exist on Branch, Document, Student, ParentSession', async () => {
    const res = await client.query<{ indexname: string }>(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
    `);

    const indexNames = new Set(res.rows.map((r) => r.indexname));
    expect(indexNames.has('Branch_organizationId_idx')).toBe(true);
    expect(indexNames.has('Branch_managerId_idx')).toBe(true);
    expect(indexNames.has('Document_title_idx')).toBe(true);
    expect(indexNames.has('LibraryBook_isbn_idx')).toBe(true);
    expect(indexNames.has('Organization_email_idx')).toBe(true);
    expect(indexNames.has('ParentSession_parentId_idx')).toBe(true);
    expect(indexNames.has('Student_branchId_idx')).toBe(true);

    // Redundant duplicate non-unique index on ApiKey(keyHash) is dropped
    expect(indexNames.has('ApiKey_keyHash_idx')).toBe(false);
    // While the unique index is intact
    expect(indexNames.has('ApiKey_keyHash_key')).toBe(true);
  });
});
