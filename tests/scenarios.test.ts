import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTestDb, teardownTestDb, seedTeam, testQuery } from './setup.js';
import * as db from '../src/db/queries.js';

describe('End-to-End Scenarios', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
    await seedTeam('backend', 'Backend Team', 'Use TypeScript strict mode. All PRs need tests.');
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('Scenario: Two agents work on separate files — no conflict', async () => {
    // Pawel creates and publishes two intents
    const auth = await db.createIntent({
      title: 'Add authentication',
      created_by: 'pawel',
      team_id: 'backend',
      acceptance_criteria: ['JWT auth works', 'Middleware applied'],
      files_likely_touched: ['src/auth.ts', 'src/middleware.ts'],
    });
    await db.publishIntent(auth.id);

    const cache = await db.createIntent({
      title: 'Add caching layer',
      created_by: 'pawel',
      team_id: 'backend',
      acceptance_criteria: ['Redis caching active', 'Cache TTL configurable'],
      files_likely_touched: ['src/cache.ts', 'src/config.ts'],
    });
    await db.publishIntent(cache.id);

    // Agent A (pawel) claims auth
    const { claim: claimA, conflicts: conflictsA } = await db.claimWork({
      intent_id: auth.id,
      claimed_by: 'pawel',
      files_touching: ['src/auth.ts', 'src/middleware.ts'],
      branch: 'feat/auth',
    });
    expect(conflictsA).toHaveLength(0);

    // Agent B (alice) checks conflicts before claiming cache
    const preCheck = await db.findConflicts(['src/cache.ts', 'src/config.ts']);
    expect(preCheck).toHaveLength(0); // No overlap — safe!

    // Agent B claims cache
    const { claim: claimB, conflicts: conflictsB } = await db.claimWork({
      intent_id: cache.id,
      claimed_by: 'alice',
      files_touching: ['src/cache.ts', 'src/config.ts'],
      branch: 'feat/cache',
    });
    expect(conflictsB).toHaveLength(0);

    // Both agents send heartbeats
    await db.heartbeat(claimA.id);
    await db.heartbeat(claimB.id);

    // Agent A completes
    await db.completeClaim(claimA.id, 'Auth middleware done, tests passing');

    // Agent B completes
    await db.completeClaim(claimB.id, 'Redis caching active, TTL configurable');

    // Overview shows both completed
    const overview = await db.getOverview();
    expect(overview.recently_completed).toHaveLength(2);
    expect(overview.active_conflicts).toHaveLength(0);
    expect(overview.stale_claims).toHaveLength(0);
  });

  it('Scenario: File conflict detected — agents warned', async () => {
    const intent1 = await db.createIntent({
      title: 'Refactor user model',
      created_by: 'pawel',
      team_id: 'backend',
      acceptance_criteria: ['Model cleaned up'],
    });
    await db.publishIntent(intent1.id);

    const intent2 = await db.createIntent({
      title: 'Add user validation',
      created_by: 'pawel',
      team_id: 'backend',
      acceptance_criteria: ['Validation in place'],
    });
    await db.publishIntent(intent2.id);

    // Pawel starts refactoring
    await db.claimWork({
      intent_id: intent1.id,
      claimed_by: 'pawel',
      files_touching: ['src/models/user.ts', 'src/types.ts'],
    });

    // Alice wants to add validation — overlapping on user.ts!
    const { conflicts } = await db.claimWork({
      intent_id: intent2.id,
      claimed_by: 'alice',
      files_touching: ['src/models/user.ts', 'src/validators.ts'],
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].claimed_by).toBe('pawel');
    expect(conflicts[0].overlapping_files).toEqual(['src/models/user.ts']);

    // Alice sends a signal to coordinate
    await db.sendSignal({
      type: 'conflict',
      from_user: 'alice',
      intent_id: intent2.id,
      message: 'I need to modify user.ts too — lets coordinate on the interface changes',
    });

    // Overview shows the conflict
    const overview = await db.getOverview();
    expect(overview.active_conflicts.length).toBeGreaterThanOrEqual(1);
  });

  it('Scenario: Completion unblocks dependent work chain', async () => {
    // Create a chain: DB schema → API endpoints → Frontend
    const schema = await db.createIntent({
      title: 'Design DB schema',
      created_by: 'pawel',
      team_id: 'backend',
      acceptance_criteria: ['Schema migrated'],
    });
    await db.publishIntent(schema.id);

    const api = await db.createIntent({
      title: 'Build API endpoints',
      created_by: 'pawel',
      team_id: 'backend',
      acceptance_criteria: ['Endpoints tested'],
    });
    await db.createIntentDependencies(api.id, [schema.id]);
    // Set to blocked since dependency isn't done yet
    await db.updateIntent({ intent_id: api.id, status: 'blocked' });

    const frontend = await db.createIntent({
      title: 'Build frontend',
      created_by: 'pawel',
      team_id: 'backend',
      acceptance_criteria: ['UI working'],
    });
    await db.createIntentDependencies(frontend.id, [api.id]);
    await db.updateIntent({ intent_id: frontend.id, status: 'blocked' });

    // Pawel works on DB schema
    const { claim } = await db.claimWork({ intent_id: schema.id, claimed_by: 'pawel' });

    // Complete schema — should unblock API
    const { unblocked_intents } = await db.completeClaim(claim.id, 'Schema done');
    expect(unblocked_intents).toHaveLength(1);
    expect(unblocked_intents[0].title).toBe('Build API endpoints');

    // Frontend should STILL be blocked (API isn't done yet)
    const frontendStatus = await db.getIntent(frontend.id);
    expect(frontendStatus!.status).toBe('blocked');

    // Alice picks up the now-open API work
    const { claim: apiClaim } = await db.claimWork({ intent_id: api.id, claimed_by: 'alice' });
    const { unblocked_intents: unblocked2 } = await db.completeClaim(apiClaim.id, 'API done');

    // NOW frontend should be unblocked
    expect(unblocked2).toHaveLength(1);
    expect(unblocked2[0].title).toBe('Build frontend');
  });

  it('Scenario: Full context package for agent onboarding', async () => {
    // Setup: team has conventions, intent has parent and dependencies
    const parent = await db.createIntent({
      title: 'API Hardening',
      created_by: 'pawel',
      team_id: 'backend',
      acceptance_criteria: ['All hardening tasks done'],
    });

    const dep = await db.createIntent({
      title: 'Logging infrastructure',
      created_by: 'pawel',
      team_id: 'backend',
      acceptance_criteria: ['Structured logging in place'],
    });
    await db.publishIntent(dep.id);
    // Complete the dependency
    const { claim: depClaim } = await db.claimWork({ intent_id: dep.id, claimed_by: 'pawel' });
    await db.completeClaim(depClaim.id, 'Logging done');

    const rateLimit = await db.createIntent({
      title: 'Add rate limiting',
      description: 'All public API endpoints need rate limiting',
      created_by: 'pawel',
      team_id: 'backend',
      acceptance_criteria: ['429 on limit exceeded', 'Rate headers present'],
      files_likely_touched: ['src/middleware/rateLimit.ts', 'src/api/router.ts'],
      constraints: ['Must not break existing API contracts'],
    });
    // Manually set parent
    await testQuery('UPDATE intents SET parent_id = $1 WHERE id = $2', [parent.id, rateLimit.id]);
    await db.createIntentDependencies(rateLimit.id, [dep.id]);
    await db.publishIntent(rateLimit.id);

    // Someone else is touching nearby files
    const otherIntent = await db.createIntent({
      title: 'Error handling refactor',
      created_by: 'alice',
      team_id: 'backend',
      acceptance_criteria: ['Errors consistent'],
    });
    await db.publishIntent(otherIntent.id);
    await db.claimWork({
      intent_id: otherIntent.id,
      claimed_by: 'alice',
      files_touching: ['src/api/router.ts', 'src/errors.ts'],
    });

    // Agent picks up rate limiting — get full context
    const ctx = await db.getContext(rateLimit.id);

    expect(ctx.intent.title).toBe('Add rate limiting');
    expect(ctx.parent!.title).toBe('API Hardening');
    expect(ctx.dependencies).toHaveLength(1);
    expect(ctx.dependencies[0].intent.title).toBe('Logging infrastructure');
    expect(ctx.dependencies[0].status).toBe('done');
    expect(ctx.overlapping_claims).toHaveLength(1);
    expect(ctx.overlapping_claims[0].claimed_by).toBe('alice');
    expect(ctx.team_conventions).toBe('Use TypeScript strict mode. All PRs need tests.');
  });
});
