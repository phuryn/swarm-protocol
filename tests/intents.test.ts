import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTestDb, teardownTestDb, seedTeam, testQuery } from './setup.js';
import * as db from '../src/db/queries.js';

describe('Intent Management', () => {
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

  it('creates an intent in draft status', async () => {
    const intent = await db.createIntent({
      title: 'Add rate limiting',
      description: 'Rate limit all API endpoints',
      created_by: 'pawel',
      team_id: 'backend',
      priority: 'high',
      acceptance_criteria: ['429 on limit exceeded', 'Rate headers present'],
    });

    expect(intent.id).toMatch(/^intent_/);
    expect(intent.status).toBe('draft');
    expect(intent.title).toBe('Add rate limiting');
    expect(intent.priority).toBe('high');
  });

  it('publishes a draft intent to open', async () => {
    const intent = await db.createIntent({
      title: 'Add caching',
      created_by: 'pawel',
      team_id: 'backend',
      acceptance_criteria: ['Cache TTL configurable'],
    });

    const published = await db.publishIntent(intent.id);
    expect(published.status).toBe('open');
  });

  it('rejects publishing without acceptance criteria', async () => {
    const intent = await db.createIntent({
      title: 'No criteria',
      created_by: 'pawel',
      team_id: 'backend',
    });

    await expect(db.publishIntent(intent.id)).rejects.toThrow('no acceptance criteria');
  });

  it('rejects publishing a non-draft intent', async () => {
    const intent = await db.createIntent({
      title: 'Already open',
      created_by: 'pawel',
      team_id: 'backend',
      acceptance_criteria: ['Done'],
    });
    await db.publishIntent(intent.id);

    await expect(db.publishIntent(intent.id)).rejects.toThrow('not in draft status');
  });

  it('lists intents excluding drafts by default', async () => {
    await db.createIntent({ title: 'Draft one', created_by: 'pawel', team_id: 'backend' });
    const i2 = await db.createIntent({
      title: 'Published one',
      created_by: 'pawel',
      team_id: 'backend',
      acceptance_criteria: ['Works'],
    });
    await db.publishIntent(i2.id);

    const list = await db.listIntents({});
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('Published one');
  });

  it('includes own drafts when include_drafts is true', async () => {
    await db.createIntent({ title: 'My draft', created_by: 'pawel', team_id: 'backend' });
    await db.createIntent({ title: 'Other draft', created_by: 'alice', team_id: 'backend' });

    const list = await db.listIntents({ include_drafts: true, requesting_user: 'pawel' });
    const titles = list.map(i => i.title);
    expect(titles).toContain('My draft');
    expect(titles).not.toContain('Other draft');
  });

  it('filters by team and status', async () => {
    await seedTeam('frontend', 'Frontend Team');
    const i1 = await db.createIntent({
      title: 'Backend task',
      created_by: 'pawel',
      team_id: 'backend',
      acceptance_criteria: ['Done'],
    });
    await db.publishIntent(i1.id);

    const i2 = await db.createIntent({
      title: 'Frontend task',
      created_by: 'alice',
      team_id: 'frontend',
      acceptance_criteria: ['Done'],
    });
    await db.publishIntent(i2.id);

    const backendOnly = await db.listIntents({ team_id: 'backend' });
    expect(backendOnly).toHaveLength(1);
    expect(backendOnly[0].title).toBe('Backend task');
  });

  it('gets intent with relations', async () => {
    const dep = await db.createIntent({
      title: 'Dependency',
      created_by: 'pawel',
      team_id: 'backend',
      acceptance_criteria: ['Done'],
    });
    await db.publishIntent(dep.id);

    const intent = await db.createIntent({
      title: 'Depends on something',
      created_by: 'pawel',
      team_id: 'backend',
      acceptance_criteria: ['Done'],
    });
    await db.createIntentDependencies(intent.id, [dep.id]);

    const full = await db.getIntent(intent.id);
    expect(full).not.toBeNull();
    expect(full!.depends_on).toContain(dep.id);
  });

  it('updates intent fields', async () => {
    const intent = await db.createIntent({
      title: 'Original',
      created_by: 'pawel',
      team_id: 'backend',
    });

    const updated = await db.updateIntent({
      intent_id: intent.id,
      title: 'Updated title',
      priority: 'critical',
    });

    expect(updated.title).toBe('Updated title');
    expect(updated.priority).toBe('critical');
  });

  it('decomposes intent into sub-intents', async () => {
    const parent = await db.createIntent({
      title: 'Big feature',
      created_by: 'pawel',
      team_id: 'backend',
    });

    const children = await db.decomposeIntent(parent.id, [
      { title: 'Sub-task 1', acceptance_criteria: ['Works'] },
      { title: 'Sub-task 2', acceptance_criteria: ['Also works'] },
    ]);

    expect(children).toHaveLength(2);
    expect(children[0].parent_id).toBe(parent.id);
    expect(children[0].team_id).toBe('backend');
    expect(children[0].created_by).toBe('pawel');
  });
});
