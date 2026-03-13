# Example Test Results

**Run date:** 2026-03-13 16:40 UTC+1
**Environment:** Windows 11, Node.js 22, PostgreSQL 16 (Docker), Vitest 3.2.4

```
 ✓ tests/edge-cases.test.ts (22 tests) 1328ms
 ✓ tests/intents.test.ts (10 tests) 619ms
 ✓ tests/claims.test.ts (8 tests) 552ms
 ✓ tests/teams.test.ts (7 tests) 388ms
 ✓ tests/scenarios.test.ts (4 tests) 387ms
 ✓ tests/overview.test.ts (5 tests) 386ms
 ✓ tests/conflicts.test.ts (5 tests) 348ms
 ✓ tests/signals.test.ts (4 tests) 290ms
 ✓ tests/context.test.ts (2 tests) 158ms

 Test Files  9 passed (9)
      Tests  67 passed (67)
   Start at  16:40:36
   Duration  6.80s (transform 104ms, setup 0ms, collect 905ms, tests 4.46s, environment 1ms, prepare 527ms)
```

## Test Breakdown

| File | Tests | What It Covers |
|------|-------|----------------|
| `edge-cases.test.ts` | 22 | Error paths, boundary conditions, invalid state transitions |
| `intents.test.ts` | 10 | Create/publish lifecycle, filtering, draft visibility, decomposition |
| `claims.test.ts` | 8 | Claim lifecycle, heartbeat, release/reopen, completion, dependency unblocking |
| `teams.test.ts` | 7 | Team CRUD, duplicate rejection, empty list, null handling |
| `scenarios.test.ts` | 4 | End-to-end coordination stories |
| `overview.test.ts` | 5 | Team status, stale claims, blocked intents, conflicts, completed |
| `conflicts.test.ts` | 5 | File overlap detection, ignoring completed/abandoned claims |
| `signals.test.ts` | 4 | Send/retrieve, filtering by type/team, limit |
| `context.test.ts` | 2 | Full context package assembly, non-existent intent |

For live CI results, see the [Actions tab](https://github.com/phuryn/swarm-protocol/actions).
