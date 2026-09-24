import { vi } from 'vitest';

// Specs in this repo were authored with the jest global API but run under
// vitest (globals: true). Vitest intentionally does not define a `jest`
// global, so we alias it to `vi`, whose fn() API is compatible
// (mockResolvedValue, mockImplementation, mockClear, ...).
(globalThis as Record<string, unknown>).jest = vi;
