import { describe, it, expect } from 'vitest';
import { RootController } from '../root.controller';

describe('RootController', () => {
  it('should return API information and navigation hints', () => {
    const controller = new RootController();
    const result = controller.getRoot();

    expect(result.name).toBe('M-EDU API');
    expect(result.version).toBe('2.0.0');
    expect(result.docs).toBe('/api/docs');
    expect(result.health).toBe('/api/health');
    expect(result.readiness).toBe('/api/readiness');
    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp).getTime()).not.toBeNaN();
  });
});
