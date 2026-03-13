import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTestDb, teardownTestDb } from './setup.js';
import * as db from '../src/db/queries.js';

describe('Team Management', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('creates a team', async () => {
    const team = await db.createTeam('backend', 'Backend Team', 'Use TypeScript strict mode.');
    expect(team.id).toBe('backend');
    expect(team.name).toBe('Backend Team');
    expect(team.conventions).toBe('Use TypeScript strict mode.');
  });

  it('creates a team without conventions', async () => {
    const team = await db.createTeam('frontend', 'Frontend Team');
    expect(team.conventions).toBeNull();
  });

  it('rejects duplicate team IDs', async () => {
    await db.createTeam('backend', 'Backend Team');
    await expect(db.createTeam('backend', 'Another Backend')).rejects.toThrow();
  });

  it('lists all teams ordered by name', async () => {
    await db.createTeam('frontend', 'Frontend Team');
    await db.createTeam('backend', 'Backend Team');
    await db.createTeam('mobile', 'Mobile Team');

    const teams = await db.listTeams();
    expect(teams).toHaveLength(3);
    expect(teams[0].name).toBe('Backend Team');
    expect(teams[2].name).toBe('Mobile Team');
  });

  it('returns empty list when no teams exist', async () => {
    const teams = await db.listTeams();
    expect(teams).toHaveLength(0);
  });

  it('gets a team by ID', async () => {
    await db.createTeam('backend', 'Backend Team', 'Conventions here');
    const team = await db.getTeam('backend');
    expect(team).not.toBeNull();
    expect(team!.name).toBe('Backend Team');
  });

  it('returns null for non-existent team', async () => {
    const team = await db.getTeam('nonexistent');
    expect(team).toBeNull();
  });
});
