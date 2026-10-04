/**
 * Backward compatibility bridge for `@/lib/types`.
 * All domain types have been migrated to domain modules under `src/types/*`
 * and unified in `src/types/index.ts`.
 *
 * DO NOT add types directly to this file. Add them to the corresponding
 * domain module under `src/types/` and export through `src/types/index.ts`.
 */

export * from '../types';
