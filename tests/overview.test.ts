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

describe('Board View', () => {
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

  it('returns empty columns with zero counts when no intents exist', async () => {
    const board = await db.getBoard();

    expect(board.columns.open).toEqual([]);
    expect(board.columns.claimed).toEqual([]);
    expect(board.columns.blocked).toEqual([]);
    expect(board.columns.done).toEqual([]);
    expect(board.columns.cancelled).toEqual([]);
    expect(board.summary.open).toBe(0);
    expect(board.summary.claimed).toBe(0);
    expect(board.summary.blocked).toBe(0);
    expect(board.summary.done).toBe(0);
    expect(board.summary.cancelled).toBe(0);
  });

  it('groups intents into correct status columns', async () => {
    const openIntent = await seedOpenIntent({ title: 'Open task' });
    const claimedIntent = await seedOpenIntent({ title: 'Claimed task' });
    await db.claimWork({ intent_id: claimedIntent.id as string, claimed_by: 'alice' });

    const board = await db.getBoard();

    expect(board.columns.open).toHaveLength(1);
    expect(board.columns.open![0].title).toBe('Open task');
    expect(board.columns.claimed).toHaveLength(1);
    expect(board.columns.claimed![0].title).toBe('Claimed task');
  });

  it('includes claimed_by and claim_id for claimed intents', async () => {
    const intent = await seedOpenIntent({ title: 'In progress' });
    const { claim } = await db.claimWork({
      intent_id: intent.id as string,
      claimed_by: 'pawel',
    });

    const board = await db.getBoard();

    const claimedCard = board.columns.claimed![0];
    expect(claimedCard.claimed_by).toBe('pawel');
    expect(claimedCard.claim_id).toBe(claim.id);
  });

  it('includes blocked_by for blocked intents', async () => {
    const blocker = await seedOpenIntent({ title: 'Blocker' });

    await testQuery(
      `INSERT INTO intents (title, created_by, team_id, status, priority, acceptance_criteria)
       VALUES ('Blocked task', 'alice', 'backend', 'blocked', 'medium', '["Done"]') RETURNING *`
    );
    const blockedRes = await testQuery(
      `SELECT id FROM intents WHERE title = 'Blocked task'`
    );
    const blockedId = blockedRes.rows[0].id;
    await testQuery(
      'INSERT INTO intent_dependencies (intent_id, depends_on) VALUES ($1, $2)',
      [blockedId, blocker.id]
    );

    const board = await db.getBoard();

    expect(board.columns.blocked).toHaveLength(1);
    expect(board.columns.blocked![0].blocked_by).toContain(blocker.id);
  });

  it('filters by team_id when provided', async () => {
    await seedTeam('frontend', 'Frontend Team');
    await seedOpenIntent({ title: 'Backend task', team_id: 'backend' });
    await seedOpenIntent({ title: 'Frontend task', team_id: 'frontend' });

    const board = await db.getBoard('frontend');

    expect(board.columns.open).toHaveLength(1);
    expect(board.columns.open![0].title).toBe('Frontend task');
  });

  it('excludes drafts from all columns', async () => {
    await testQuery(
      `INSERT INTO intents (title, created_by, team_id, status, priority, acceptance_criteria)
       VALUES ('Draft task', 'alice', 'backend', 'draft', 'medium', '["Done"]')`
    );
    await seedOpenIntent({ title: 'Open task' });

    const board = await db.getBoard();

    const allCards = Object.values(board.columns).flat();
    expect(allCards.every(c => c.title !== 'Draft task')).toBe(true);
    expect(board.columns.open).toHaveLength(1);
    expect(board.columns).not.toHaveProperty('draft');
    expect(board.summary).not.toHaveProperty('draft');
  });
});
