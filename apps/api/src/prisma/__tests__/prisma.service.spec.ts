import { describe, it, expect, vi } from 'vitest';
import { PrismaService } from '../prisma.service';

describe('PrismaService', () => {
  it('instantiates and handles lifecycle hooks', async () => {
    const service = new PrismaService();
    expect(service).toBeDefined();

    const connectSpy = vi.spyOn(service, '$connect').mockResolvedValue(undefined as never);
    const disconnectSpy = vi.spyOn(service, '$disconnect').mockResolvedValue(undefined as never);

    await service.onModuleInit();
    expect(connectSpy).toHaveBeenCalled();

    await service.onModuleDestroy();
    expect(disconnectSpy).toHaveBeenCalled();
  });
});
