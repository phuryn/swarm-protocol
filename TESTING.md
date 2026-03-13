# Testing

Swarm Protocol uses integration tests against a real PostgreSQL database. No mocks. Tests are written with [Vitest](https://vitest.dev/).

## Running Tests

```bash
docker compose up -d          # start PostgreSQL
npm test                      # run all tests
npm run test:watch            # watch mode
```

Requires `DATABASE_URL` (default: `postgresql://postgres:postgres@localhost:5432/swarm_protocol`).

## Test Architecture

**Why integration tests, not unit tests:** The core logic lives in SQL queries. Mocking the database would test nothing useful — the integration IS the logic. Every test hits a real PostgreSQL instance, every test cleans up after itself with `TRUNCATE ... CASCADE`.

**Why no MCP transport tests:** The MCP SDK handles serialization, transport, and Zod validation. Testing it would be testing the framework, not our code.

**Test isolation:** Each test file gets a fresh database state. `beforeEach` truncates all tables. Tests within a file run sequentially. Test files run sequentially (no parallel DB access).

## Test Coverage Summary

**67 tests across 9 test files.**

| File | Tests | What It Covers |
|------|-------|----------------|
| `teams.test.ts` | 7 | Team CRUD, duplicate rejection, empty list, null handling |
| `intents.test.ts` | 10 | Create/publish lifecycle, filtering, draft visibility, decomposition |
| `claims.test.ts` | 8 | Claim lifecycle, heartbeat, release/reopen, completion, dependency unblocking |
| `conflicts.test.ts` | 5 | File overlap detection, ignoring completed/abandoned claims |
| `signals.test.ts` | 4 | Send/retrieve, filtering by type/team, limit |
| `context.test.ts` | 2 | Full context package assembly, non-existent intent |
| `overview.test.ts` | 5 | Team status, stale claims, blocked intents, conflicts, completed |
| `scenarios.test.ts` | 4 | End-to-end coordination stories (see below) |
| `edge-cases.test.ts` | 22 | Error paths, boundary conditions, invalid state transitions |

## Key Test Scenarios

These are the tests that demonstrate the value proposition — they read like user stories.

### Scenario: Two agents, no conflict
Two humans (Pawel and Alice) each claim separate intents with non-overlapping files. Both work in parallel, send heartbeats, complete their work. Overview shows both completed, zero conflicts, zero stale claims.

### Scenario: File conflict detected
Pawel is refactoring `user.ts`. Alice wants to add validation to the same file. When Alice claims her intent, she gets a conflict warning showing Pawel's active claim. She sends a coordination signal. The overview dashboard surfaces the conflict.

### Scenario: Completion unblocks dependent work chain
Three intents form a dependency chain: DB Schema → API Endpoints → Frontend. Pawel completes the schema — API endpoints automatically transition from `blocked` to `open`. Alice picks up the API work, completes it — Frontend unblocks. The chain reaction works without any manual status updates.

### Scenario: Full context package for agent onboarding
An intent has a parent, a completed dependency, overlapping claims from another team member, and recent signals. `get_context` assembles everything into one response — the agent gets full situational awareness in a single call.

## Edge Cases Tested

### Intent Error Paths
- Publishing non-existent intent → error
- Publishing intent without team_id → error
- Publishing intent without acceptance criteria → error
- Publishing non-draft intent (already open, claimed, done) → error
- Updating non-existent intent → error
- Updating with no fields → error
- Decomposing non-existent parent → error
- Getting non-existent intent → returns null

### Claim Error Paths
- Claiming non-existent intent → error
- Claiming non-open intent (draft, claimed, done) → error
- Claiming already-claimed intent (second agent tries) → error
- Completing non-existent claim → error
- Completing already-completed claim → error
- Completing abandoned claim → error
- Releasing non-existent claim → error
- Heartbeat on non-existent claim → error
- Heartbeat on completed claim → error

### Conflict Edge Cases
- Empty files array → no conflicts
- Three-way conflict (three active claims on same file) → all detected
- Completed claims excluded from conflicts
- Abandoned claims excluded from conflicts

### Overview Edge Cases
- Empty database (no teams, no data) → empty overview, no crash
- Non-existent team in get_team_status → error
- Non-existent intent in get_context → error
- Standalone signals (no intent_id) → works

## Design Assumptions

These assumptions are baked into the implementation and validated by tests:

1. **Trust-based identity.** `claimed_by` is a string the caller passes. No authentication. An agent could impersonate another user. This is intentional for v1 — auth adds complexity without solving the coordination problem.

2. **Advisory conflicts, not locks.** `check_conflicts` warns but doesn't prevent. Two agents CAN claim overlapping files. The system trusts humans to coordinate after seeing the warning.

3. **Single claim per intent.** An intent can only be claimed when it's in `open` status. Once claimed, others cannot claim it until it's released or completed. This is enforced.

4. **Automatic dependency unblocking.** When a claim is completed, all intents that depend on the completed intent are checked. If ALL their dependencies are now `done`, they transition to `open`. This is transactional — no intermediate states.

5. **30-minute stale threshold.** Claims with no heartbeat for 30 minutes appear in the overview as stale. This is a reporting threshold, not an enforcement mechanism — stale claims are not automatically released.

6. **Draft visibility.** Draft intents are invisible to other users by default. `list_intents` excludes drafts unless `include_drafts=true`, and even then only shows the requesting user's own drafts.

7. **Schema is idempotent.** `initDb()` uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`. It can be called multiple times safely — on every server startup.

8. **JSONB arrays for file lists.** `files_touching`, `files_likely_touched`, `constraints`, `acceptance_criteria`, and `unblocks` are stored as JSONB arrays. Conflict detection uses `jsonb_array_elements_text` for overlap queries.

## What Is NOT Tested (and Why)

| Not Tested | Reason |
|-----------|--------|
| Zod parameter validation | MCP SDK handles this before our code runs |
| SQL injection | All queries use parameterized `$1, $2` — PostgreSQL handles escaping |
| MCP transport (stdio) | That's the SDK's responsibility |
| Concurrent database access | PostgreSQL handles row-level locking; our queries are simple enough |
| Performance at scale | Premature for MVP; schema has indexes on key columns |
| File path case sensitivity | OS-level concern, not our abstraction layer |
