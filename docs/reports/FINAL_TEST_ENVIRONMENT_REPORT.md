## Root Cause
The 58 Face Engine tests failed in the clean clone because the local development .env files are correctly ignored by .gitignore. The FaceService and CameraService classes, when instantiated directly in the unit tests (bypassing NestJS's ConfigModule logic), rely on process.env.BIOMETRIC_ENCRYPTION_KEY and other cryptographic defaults. In a clean repository clone without .env overrides, these values were completely missing, triggering the fatal "must be configured" validation errors built into the production code.

## Files Changed
- pps/api/vitest.setup.ts

## Fix
Modified pps/api/vitest.setup.ts to assign deterministic, safe, test-only defaults directly onto process.env before any tests run. I intentionally used short-circuit assignment (e.g., process.env.BIOMETRIC_ENCRYPTION_KEY = process.env.BIOMETRIC_ENCRYPTION_KEY || '00...00';) to preserve actual developer configurations if present, while providing a foolproof default payload for fresh clones. This completely eliminated the dependency on external environment files for test initialization.

## Test Results
Face Engine: 58 previously failing tests now pass natively.
Unit: 2475/2475 tests pass natively inside the clean workspace.
Integration: PASS (Tests connect locally correctly given test defaults).
Build: PASS.
Clean clone: PASS (Verified with m-edu-final-verification2 workspace cloning from source).

## Security
Production secrets committed: NO
Test secrets committed: NO
Real credentials exposed: NO

## Final Decision
PASS — CLEAN CLONE TESTS REPRODUCIBLE
