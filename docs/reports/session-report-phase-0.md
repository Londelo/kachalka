# Phase 0 — Session Report

**Date:** 2026-05-06
**Team:** `main-plan-1` (Plan, eng1, eng2, jester, review, squire)

## Goal

Implement Phase 0 (Scaffolding) from Plan-1.md — project foundation for the Lifting App.

## What Was Built

### Project Scaffolding
- `package.json` — Next.js, Drizzle, better-sqlite3, TypeScript dependencies
- `tsconfig.json` — path aliases (@/*), strict mode
- `next.config.ts`
- `.gitignore` — excludes data/ directory
- `data/` — SQLite database directory

### App Shell
- `src/app/layout.tsx` — root layout with nav bar shell
- `src/app/globals.css` — base styles
- `src/app/page.tsx` — user selection page

### Configuration
- `src/config/env.ts` — `validateEnv()` validates NODE_ENV and DATABASE_PATH
- `src/config/db.ts` — SQLite singleton with better-sqlite3, Drizzle initialization, WAL mode, foreign keys

### Database Schema
- `src/db/schema.ts` — 4 tables: users, exercises, user_routines, workout_logs
- `src/db/migrate.ts` — Drizzle migration runner (idempotent)
- `src/db/migrations/` — Generated migration SQL files

### Shared Utilities
- `src/shared/errors/app-error.ts` — AppError class with message, status, cause, toJSON
- `src/shared/utils/volume.ts` — calculateVolume(sets) = Σ(reps × weight)
- `src/shared/utils/date.ts` — formatDate(), getTodayISO(), dayOfWeekToIndex()
- `src/shared/types/day-of-week.ts` — DayOfWeek type (Sun=0 through Sat=6)

### Tests (76/76 passing)
- `tests/config/env.test.ts` — 11 tests
- `tests/config/db.test.ts` — 5 tests
- `tests/db/schema.test.ts` — 17 tests
- `tests/db/migrate.test.ts` — 1 test
- `tests/shared/errors/app-error.test.ts` — 13 tests
- `tests/shared/utils/volume.test.ts` — 9 tests
- `tests/shared/utils/date.test.ts` — 20 tests

## Verification

- `npm run dev` starts successfully (Next.js 15.5.15, 1350ms)
- SQLite DB creates on first request
- Migration files generated and idempotent

## Commit

`f1d6037` — "chore: Phase 0 — project scaffolding, DB setup, and utilities"
32 files committed.

## Review Findings (7 Issues)

| # | Severity | Issue |
|---|----------|-------|
| 1 | Low | `validateEnv()` never called (dead code) |
| 2 | High | `DATABASE_PATH` validated but db.ts hardcodes path |
| 3 | High | `new Date()` evaluated once at module load, not per-insert |
| 4 | Medium | Duplicate migration file (0000 and 0001) |
| 5 | Low | PRAGMA in migrations may not work with Drizzle migrator |
| 6 | Low | `AppError.toJSON()` defined but unused |
| 7 | Low | `calculateVolume` doesn't validate reps is integer |

## Stuck

Squire agent would not shut down despite ~20 shutdown requests over several minutes. Team cleanup incomplete.

## Next Steps

- Fix review issues (especially #2 DATABASE_PATH mismatch and #3 timestamp bug)
- Phase 1 (Users) — user selection, creation, auth shell
