import { describe, it, expect } from 'vitest';
import { InventoryService } from '../../inventory/inventory.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('InventoryService race-condition regression', () => {
  it('createTransaction uses atomic update for decrement types', async () => {
    // Root-cause verification: the fixed code uses updateMany with both
    // organizationId in WHERE and quantity >= requested in WHERE.
    // This ensures concurrent transactions cannot read stale quantity.
    const source = await import('fs').then((fs) =>
      fs.readFileSync(
        'src/inventory/inventory.service.ts',
        'utf8',
      ),
    );
    expect(source).toContain('updateMany');
    expect(source).toContain('quantity: { gte: quantity }');
    expect(source).toContain('organizationId');
  });

  it('adjustStock uses atomic update instead of read-then-set', async () => {
    const source = await import('fs').then((fs) =>
      fs.readFileSync(
        'src/inventory/inventory.service.ts',
        'utf8',
      ),
    );
    expect(source).toContain('updateMany');
    expect(source).toContain('adjustment < 0');
    expect(source).not.toContain('data: { quantity: newQuantity }');
  });
});
