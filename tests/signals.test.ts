import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTestDb, teardownTestDb, seedTeam, seedOpenIntent } from './setup.js';
import * as db from '../src/db/queries.js';

describe('Signals', () => {
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

  it('sends and retrieves a signal', async () => {
    const intent = await seedOpenIntent();
    const signal = await db.sendSignal({
      type: 'blocked',
      from_user: 'pawel',
      intent_id: intent.id as string,
      message: 'Blocked by missing API spec',
    });

    expect(signal.id).toMatch(/^signal_/);
    expect(signal.type).toBe('blocked');

    const signals = await db.getSignals({ intent_id: intent.id as string });
    expect(signals).toHaveLength(1);
  });

  it('filters signals by type', async () => {
    const intent = await seedOpenIntent();
    await db.sendSignal({ type: 'info', from_user: 'pawel', intent_id: intent.id as string, message: 'FYI' });
    await db.sendSignal({ type: 'blocked', from_user: 'alice', intent_id: intent.id as string, message: 'Stuck' });

    const blocked = await db.getSignals({ type: 'blocked' });
    expect(blocked).toHaveLength(1);
    expect(blocked[0].from_user).toBe('alice');
  });

  it('filters signals by team', async () => {
    await seedTeam('frontend', 'Frontend');
    const backendIntent = await seedOpenIntent({ team_id: 'backend', title: 'Backend work' });
    const feRes = await db.createIntent({
      title: 'Frontend work',
      created_by: 'alice',
      team_id: 'frontend',
      acceptance_criteria: ['Done'],
    });
    await db.publishIntent(feRes.id);

    await db.sendSignal({ type: 'info', from_user: 'pawel', intent_id: backendIntent.id as string, message: 'Backend signal' });
    await db.sendSignal({ type: 'info', from_user: 'alice', intent_id: feRes.id, message: 'Frontend signal' });

    const backendSignals = await db.getSignals({ team_id: 'backend' });
    expect(backendSignals).toHaveLength(1);
    expect(backendSignals[0].message).toBe('Backend signal');
  });

  it('respects limit parameter', async () => {
    const intent = await seedOpenIntent();
    for (let i = 0; i < 5; i++) {
      await db.sendSignal({ type: 'info', from_user: 'pawel', intent_id: intent.id as string, message: `Signal ${i}` });
    }

    const limited = await db.getSignals({ limit: 2 });
    expect(limited).toHaveLength(2);
  });
});
