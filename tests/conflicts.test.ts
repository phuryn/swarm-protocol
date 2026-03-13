import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTestDb, teardownTestDb, seedTeam, seedOpenIntent } from './setup.js';
import * as db from '../src/db/queries.js';

describe('Conflict Detection', () => {
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

  it('detects overlapping files between active claims', async () => {
    const intent1 = await seedOpenIntent({ title: 'Task 1' });
    const intent2 = await seedOpenIntent({ title: 'Task 2' });

    // Pawel claims task 1, touching auth.ts
    await db.claimWork({
      intent_id: intent1.id as string,
      claimed_by: 'pawel',
      files_touching: ['src/auth.ts', 'src/middleware.ts'],
    });

    // Alice checks before claiming task 2
    const conflicts = await db.findConflicts(['src/auth.ts', 'src/router.ts']);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].claimed_by).toBe('pawel');
    expect(conflicts[0].overlapping_files).toEqual(['src/auth.ts']);
  });

  it('returns no conflicts when files do not overlap', async () => {
    const intent = await seedOpenIntent();
    await db.claimWork({
      intent_id: intent.id as string,
      claimed_by: 'pawel',
      files_touching: ['src/auth.ts'],
    });

    const conflicts = await db.findConflicts(['src/router.ts']);
    expect(conflicts).toHaveLength(0);
  });

  it('ignores completed claims', async () => {
    const intent = await seedOpenIntent();
    const { claim } = await db.claimWork({
      intent_id: intent.id as string,
      claimed_by: 'pawel',
      files_touching: ['src/auth.ts'],
    });

    await db.completeClaim(claim.id, 'Done');

    const conflicts = await db.findConflicts(['src/auth.ts']);
    expect(conflicts).toHaveLength(0);
  });

  it('ignores abandoned claims', async () => {
    const intent = await seedOpenIntent();
    const { claim } = await db.claimWork({
      intent_id: intent.id as string,
      claimed_by: 'pawel',
      files_touching: ['src/auth.ts'],
    });

    await db.releaseClaim(claim.id);

    const conflicts = await db.findConflicts(['src/auth.ts']);
    expect(conflicts).toHaveLength(0);
  });

  it('claim_work returns conflict warnings on creation', async () => {
    const intent1 = await seedOpenIntent({ title: 'First' });
    const intent2 = await seedOpenIntent({ title: 'Second' });

    await db.claimWork({
      intent_id: intent1.id as string,
      claimed_by: 'pawel',
      files_touching: ['src/shared.ts'],
    });

    const { conflicts } = await db.claimWork({
      intent_id: intent2.id as string,
      claimed_by: 'alice',
      files_touching: ['src/shared.ts'],
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].claimed_by).toBe('pawel');
    expect(conflicts[0].intent_title).toBe('First');
  });
});
