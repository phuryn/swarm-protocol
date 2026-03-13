import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTestDb, teardownTestDb, seedTeam, seedOpenIntent, testQuery } from './setup.js';
import * as db from '../src/db/queries.js';

describe('Claim Management', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
    await seedTeam();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('claims an open intent', async () => {
    const intent = await seedOpenIntent({ title: 'Add auth' });
    const { claim, conflicts } = await db.claimWork({
      intent_id: intent.id as string,
      claimed_by: 'pawel',
      files_touching: ['src/auth.ts'],
      branch: 'feat/auth',
    });

    expect(claim.id).toMatch(/^claim_/);
    expect(claim.status).toBe('active');
    expect(claim.claimed_by).toBe('pawel');
    expect(conflicts).toHaveLength(0);

    // Verify intent moved to claimed
    const updated = await db.getIntent(intent.id as string);
    expect(updated!.status).toBe('claimed');
  });

  it('rejects claiming a non-open intent', async () => {
    const intent = await db.createIntent({
      title: 'Still draft',
      created_by: 'pawel',
      team_id: 'backend',
    });

    await expect(
      db.claimWork({ intent_id: intent.id, claimed_by: 'alice' })
    ).rejects.toThrow('not open');
  });

  it('updates heartbeat', async () => {
    const intent = await seedOpenIntent();
    const { claim } = await db.claimWork({
      intent_id: intent.id as string,
      claimed_by: 'pawel',
    });

    const updated = await db.heartbeat(claim.id, ['src/new-file.ts']);
    expect(new Date(updated.last_heartbeat).getTime()).toBeGreaterThanOrEqual(
      new Date(claim.last_heartbeat).getTime()
    );
  });

  it('releases a claim and reopens the intent', async () => {
    const intent = await seedOpenIntent();
    const { claim } = await db.claimWork({
      intent_id: intent.id as string,
      claimed_by: 'pawel',
    });

    const released = await db.releaseClaim(claim.id, 'Got blocked');
    expect(released.status).toBe('abandoned');

    const reopened = await db.getIntent(intent.id as string);
    expect(reopened!.status).toBe('open');
  });

  it('completes a claim and marks intent done', async () => {
    const intent = await seedOpenIntent();
    const { claim } = await db.claimWork({
      intent_id: intent.id as string,
      claimed_by: 'pawel',
    });

    const { claim: completed } = await db.completeClaim(claim.id, 'All done');
    expect(completed.status).toBe('completed');

    const doneIntent = await db.getIntent(intent.id as string);
    expect(doneIntent!.status).toBe('done');
  });

  it('completing a claim creates a completion signal', async () => {
    const intent = await seedOpenIntent();
    const { claim } = await db.claimWork({
      intent_id: intent.id as string,
      claimed_by: 'pawel',
    });

    await db.completeClaim(claim.id, 'Finished the work');

    const signals = await db.getSignals({ intent_id: intent.id as string, type: 'completion' });
    expect(signals).toHaveLength(1);
    expect(signals[0].from_user).toBe('pawel');
  });

  it('completing a claim unblocks dependent intents', async () => {
    // Create dependency chain: intent B depends on intent A
    const intentA = await seedOpenIntent({ title: 'Intent A' });

    // Create intent B that depends on A — start as blocked
    const intentBRes = await testQuery(
      `INSERT INTO intents (title, created_by, team_id, status, acceptance_criteria)
       VALUES ('Intent B', 'alice', 'backend', 'blocked', '["Done"]') RETURNING *`
    );
    const intentB = intentBRes.rows[0];

    // Add dependency
    await testQuery(
      'INSERT INTO intent_dependencies (intent_id, depends_on) VALUES ($1, $2)',
      [intentB.id, intentA.id]
    );

    // Claim and complete intent A
    const { claim } = await db.claimWork({
      intent_id: intentA.id as string,
      claimed_by: 'pawel',
    });
    const { unblocked_intents } = await db.completeClaim(claim.id, 'A is done');

    // Verify B was unblocked
    expect(unblocked_intents).toHaveLength(1);
    expect(unblocked_intents[0].title).toBe('Intent B');

    const updatedB = await db.getIntent(intentB.id);
    expect(updatedB!.status).toBe('open');
  });

  it('does NOT unblock if other dependencies remain incomplete', async () => {
    const intentA = await seedOpenIntent({ title: 'Intent A' });
    const intentC = await seedOpenIntent({ title: 'Intent C' });

    // Intent B depends on BOTH A and C
    const intentBRes = await testQuery(
      `INSERT INTO intents (title, created_by, team_id, status, acceptance_criteria)
       VALUES ('Intent B', 'alice', 'backend', 'blocked', '["Done"]') RETURNING *`
    );
    const intentB = intentBRes.rows[0];

    await testQuery('INSERT INTO intent_dependencies (intent_id, depends_on) VALUES ($1, $2)', [intentB.id, intentA.id]);
    await testQuery('INSERT INTO intent_dependencies (intent_id, depends_on) VALUES ($1, $2)', [intentB.id, intentC.id]);

    // Complete only A
    const { claim } = await db.claimWork({ intent_id: intentA.id as string, claimed_by: 'pawel' });
    const { unblocked_intents } = await db.completeClaim(claim.id, 'A done');

    // B should NOT be unblocked (C is still open)
    expect(unblocked_intents).toHaveLength(0);

    const updatedB = await db.getIntent(intentB.id);
    expect(updatedB!.status).toBe('blocked');
  });
});
