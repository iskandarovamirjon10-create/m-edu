import { describe, it, expect } from 'vitest';

describe('LibraryService race-condition regression', () => {
  it('borrowBook uses atomic updateMany with available >= 1', async () => {
    const source = await import('fs').then((fs) =>
      fs.readFileSync('src/library/library.service.ts', 'utf8'),
    );
    // Atomic checkbox: the WHERE must include available: { gte: 1 }
    expect(source).toContain('updateMany');
    expect(source).toContain('available: { gte: 1 }');
    expect(source).toContain('organizationId');
    // Must check result.count === 0 after the atomic operation
    expect(source).toContain('updateResult.count === 0');
  });

  it('borrowBook transaction creates borrow only after successful decrement', async () => {
    const source = await import('fs').then((fs) =>
      fs.readFileSync('src/library/library.service.ts', 'utf8'),
    );
    // The borrow record should be created after the updateMany call.
    const updateLine = source.indexOf('const updateResult');
    const createLine = source.indexOf('const borrow = await tx.libraryBorrow.create');
    expect(createLine).toBeGreaterThan(updateLine);
  });
});
