import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTestDb, teardownTestDb, seedTeam, seedOpenIntent, testQuery } from './setup.js';
import * as db from '../src/db/queries.js';

describe('Edge Cases & Error Paths', () => {
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

  // ─── Intent Error Paths ─────────────────────────

  it('publish rejects intent with no team_id', async () => {
    // Insert directly without team_id
    const res = await testQuery(
      `INSERT INTO intents (title, created_by, acceptance_criteria) VALUES ('No team', 'pawel', '["Done"]') RETURNING *`
    );
    await expect(db.publishIntent(res.rows[0].id)).rejects.toThrow('no team_id');
  });

  it('publish rejects non-existent intent', async () => {
    await expect(db.publishIntent('intent_nonexistent')).rejects.toThrow('not found');
  });

  it('update rejects non-existent intent', async () => {
    await expect(
      db.updateIntent({ intent_id: 'intent_nonexistent', title: 'New title' })
    ).rejects.toThrow('not found');
  });

  it('update rejects empty update (no fields)', async () => {
    const intent = await db.createIntent({ title: 'Test', created_by: 'pawel', team_id: 'backend' });
    await expect(
      db.updateIntent({ intent_id: intent.id })
    ).rejects.toThrow('No fields');
  });

  it('decompose rejects non-existent parent', async () => {
    await expect(
      db.decomposeIntent('intent_nonexistent', [{ title: 'Sub' }])
    ).rejects.toThrow('not found');
  });

  it('getIntent returns null for non-existent intent', async () => {
    const result = await db.getIntent('intent_nonexistent');
    expect(result).toBeNull();
  });

  // ─── Claim Error Paths ──────────────────────────

  it('claim rejects non-existent intent', async () => {
    await expect(
      db.claimWork({ intent_id: 'intent_nonexistent', claimed_by: 'pawel' })
    ).rejects.toThrow('not found');
  });

  it('claim rejects already-claimed intent', async () => {
    const intent = await seedOpenIntent();
    await db.claimWork({ intent_id: intent.id as string, claimed_by: 'pawel' });

    await expect(
      db.claimWork({ intent_id: intent.id as string, claimed_by: 'alice' })
    ).rejects.toThrow('not open');
  });

  it('claim rejects done intent', async () => {
    const intent = await seedOpenIntent();
    const { claim } = await db.claimWork({ intent_id: intent.id as string, claimed_by: 'pawel' });
    await db.completeClaim(claim.id);

    await expect(
      db.claimWork({ intent_id: intent.id as string, claimed_by: 'alice' })
    ).rejects.toThrow('not open');
  });

  it('complete rejects non-existent claim', async () => {
    await expect(db.completeClaim('claim_nonexistent')).rejects.toThrow('not found');
  });

  it('complete rejects already-completed claim', async () => {
    const intent = await seedOpenIntent();
    const { claim } = await db.claimWork({ intent_id: intent.id as string, claimed_by: 'pawel' });
    await db.completeClaim(claim.id);

    await expect(db.completeClaim(claim.id)).rejects.toThrow('not active');
  });

  it('complete rejects abandoned claim', async () => {
    const intent = await seedOpenIntent();
    const { claim } = await db.claimWork({ intent_id: intent.id as string, claimed_by: 'pawel' });
    await db.releaseClaim(claim.id);

    await expect(db.completeClaim(claim.id)).rejects.toThrow('not active');
  });

  it('release rejects non-existent claim', async () => {
    await expect(db.releaseClaim('claim_nonexistent')).rejects.toThrow('not found');
  });

  it('heartbeat rejects non-existent claim', async () => {
    await expect(db.heartbeat('claim_nonexistent')).rejects.toThrow('not found');
  });

  it('heartbeat rejects completed claim', async () => {
    const intent = await seedOpenIntent();
    const { claim } = await db.claimWork({ intent_id: intent.id as string, claimed_by: 'pawel' });
    await db.completeClaim(claim.id);

    await expect(db.heartbeat(claim.id)).rejects.toThrow('not found');
  });

  // ─── Conflict Edge Cases ────────────────────────

  it('check_conflicts with empty files array returns nothing', async () => {
    const intent = await seedOpenIntent();
    await db.claimWork({
      intent_id: intent.id as string,
      claimed_by: 'pawel',
      files_touching: ['src/auth.ts'],
    });

    const conflicts = await db.findConflicts([]);
    expect(conflicts).toHaveLength(0);
  });

  it('detects conflicts across three active claims', async () => {
    const i1 = await seedOpenIntent({ title: 'Task 1' });
    const i2 = await seedOpenIntent({ title: 'Task 2' });
    const i3 = await seedOpenIntent({ title: 'Task 3' });

    await db.claimWork({ intent_id: i1.id as string, claimed_by: 'pawel', files_touching: ['src/shared.ts'] });
    await db.claimWork({ intent_id: i2.id as string, claimed_by: 'alice', files_touching: ['src/shared.ts'] });
    await db.claimWork({ intent_id: i3.id as string, claimed_by: 'bob', files_touching: ['src/shared.ts'] });

    // Bob checks — should see both Pawel and Alice
    const conflicts = await db.findConflicts(['src/shared.ts'], (await testQuery(`SELECT id FROM claims WHERE claimed_by = 'bob'`)).rows[0].id);
    expect(conflicts).toHaveLength(2);
  });

  // ─── Overview Edge Cases ────────────────────────

  it('overview works with empty database', async () => {
    await cleanTestDb(); // Remove the seeded team too
    const overview = await db.getOverview();
    expect(overview.intents_by_team).toHaveLength(0);
    expect(overview.active_conflicts).toHaveLength(0);
    expect(overview.stale_claims).toHaveLength(0);
    expect(overview.recently_completed).toHaveLength(0);
    expect(overview.blocked_intents).toHaveLength(0);
  });

  it('get_team_status rejects non-existent team', async () => {
    await expect(db.getTeamStatus('nonexistent')).rejects.toThrow('not found');
  });

  it('get_context rejects non-existent intent', async () => {
    await expect(db.getContext('intent_nonexistent')).rejects.toThrow('not found');
  });

  // ─── Signal Edge Cases ──────────────────────────

  it('sends signal without intent_id (standalone signal)', async () => {
    const signal = await db.sendSignal({
      type: 'info',
      from_user: 'pawel',
      message: 'Team standup at 10am',
    });
    expect(signal.intent_id).toBeNull();
    expect(signal.type).toBe('info');
  });

  it('get_signals with no filters returns all signals', async () => {
    const intent = await seedOpenIntent();
    await db.sendSignal({ type: 'info', from_user: 'pawel', intent_id: intent.id as string, message: 'One' });
    await db.sendSignal({ type: 'blocked', from_user: 'alice', intent_id: intent.id as string, message: 'Two' });

    const all = await db.getSignals({});
    expect(all).toHaveLength(2);
  });
});
