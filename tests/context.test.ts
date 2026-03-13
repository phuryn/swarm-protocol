import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTestDb, teardownTestDb, seedTeam, seedOpenIntent, testQuery } from './setup.js';
import * as db from '../src/db/queries.js';

describe('Context Package', () => {
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

  it('assembles a complete context package', async () => {
    // Create parent intent
    const parent = await db.createIntent({
      title: 'Parent feature',
      created_by: 'pawel',
      team_id: 'backend',
      acceptance_criteria: ['All sub-tasks done'],
    });

    // Create the intent with parent and files
    const intentRes = await testQuery(
      `INSERT INTO intents (title, description, created_by, team_id, status, parent_id, acceptance_criteria, files_likely_touched)
       VALUES ('Child task', 'Implement auth', 'pawel', 'backend', 'open', $1, '["Auth works"]', '["src/auth.ts"]')
       RETURNING *`,
      [parent.id]
    );
    const intent = intentRes.rows[0];

    // Create dependency
    const dep = await seedOpenIntent({ title: 'Dependency task' });
    await testQuery(
      'INSERT INTO intent_dependencies (intent_id, depends_on) VALUES ($1, $2)',
      [intent.id, dep.id]
    );

    // Create an overlapping claim from another intent
    const otherIntent = await seedOpenIntent({ title: 'Other work' });
    await db.claimWork({
      intent_id: otherIntent.id as string,
      claimed_by: 'alice',
      files_touching: ['src/auth.ts'],
    });

    // Send a signal
    await db.sendSignal({
      type: 'info',
      from_user: 'alice',
      intent_id: intent.id,
      message: 'Heads up: I am also touching auth',
    });

    // Get context
    const ctx = await db.getContext(intent.id);

    expect(ctx.intent.title).toBe('Child task');
    expect(ctx.parent).not.toBeNull();
    expect(ctx.parent!.title).toBe('Parent feature');
    expect(ctx.dependencies).toHaveLength(1);
    expect(ctx.dependencies[0].intent.title).toBe('Dependency task');
    expect(ctx.overlapping_claims).toHaveLength(1);
    expect(ctx.overlapping_claims[0].claimed_by).toBe('alice');
    expect(ctx.recent_signals).toHaveLength(1);
    expect(ctx.team_conventions).toBe('Use TypeScript. Write tests.');
  });

  it('throws for non-existent intent', async () => {
    await expect(db.getContext('intent_nonexistent')).rejects.toThrow('not found');
  });
});
