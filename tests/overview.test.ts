import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTestDb, teardownTestDb, seedTeam, seedOpenIntent, testQuery } from './setup.js';
import * as db from '../src/db/queries.js';

describe('Team Status & Overview', () => {
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

  it('returns team status with intents grouped by status', async () => {
    const intent = await seedOpenIntent({ title: 'Open task' });
    const intent2 = await seedOpenIntent({ title: 'Claimed task' });
    await db.claimWork({ intent_id: intent2.id as string, claimed_by: 'pawel' });

    const status = await db.getTeamStatus('backend');

    expect(status.team.id).toBe('backend');
    expect(status.intents_by_status.open).toHaveLength(1);
    expect(status.intents_by_status.claimed).toHaveLength(1);
    expect(status.active_claims).toHaveLength(1);
  });

  it('overview shows stale claims', async () => {
    const intent = await seedOpenIntent();
    const { claim } = await db.claimWork({
      intent_id: intent.id as string,
      claimed_by: 'pawel',
    });

    // Manually set heartbeat to 31 minutes ago
    await testQuery(
      `UPDATE claims SET last_heartbeat = now() - interval '31 minutes' WHERE id = $1`,
      [claim.id]
    );

    const overview = await db.getOverview();
    expect(overview.stale_claims.length).toBeGreaterThanOrEqual(1);
    expect(overview.stale_claims[0].claimed_by).toBe('pawel');
  });

  it('overview shows blocked intents with what blocks them', async () => {
    const blocker = await seedOpenIntent({ title: 'Blocker' });

    const blockedRes = await testQuery(
      `INSERT INTO intents (title, created_by, team_id, status, acceptance_criteria)
       VALUES ('Blocked task', 'alice', 'backend', 'blocked', '["Done"]') RETURNING *`
    );
    const blocked = blockedRes.rows[0];
    await testQuery(
      'INSERT INTO intent_dependencies (intent_id, depends_on) VALUES ($1, $2)',
      [blocked.id, blocker.id]
    );

    const overview = await db.getOverview();
    expect(overview.blocked_intents).toHaveLength(1);
    expect(overview.blocked_intents[0].title).toBe('Blocked task');
    const blockedBy = overview.blocked_intents[0].blocked_by as unknown as string[];
    expect(blockedBy).toContain(blocker.id);
  });

  it('overview shows active conflicts', async () => {
    const intent1 = await seedOpenIntent({ title: 'Task 1' });
    const intent2 = await seedOpenIntent({ title: 'Task 2' });

    await db.claimWork({
      intent_id: intent1.id as string,
      claimed_by: 'pawel',
      files_touching: ['src/shared.ts'],
    });
    await db.claimWork({
      intent_id: intent2.id as string,
      claimed_by: 'alice',
      files_touching: ['src/shared.ts'],
    });

    const overview = await db.getOverview();
    expect(overview.active_conflicts.length).toBeGreaterThanOrEqual(1);
  });

  it('overview shows recently completed intents', async () => {
    const intent = await seedOpenIntent({ title: 'Will complete' });
    const { claim } = await db.claimWork({
      intent_id: intent.id as string,
      claimed_by: 'pawel',
    });
    await db.completeClaim(claim.id, 'Done');

    const overview = await db.getOverview();
    expect(overview.recently_completed).toHaveLength(1);
    expect(overview.recently_completed[0].title).toBe('Will complete');
  });
});
