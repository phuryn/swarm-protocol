import pg from 'pg';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/swarm_protocol';

export const testPool = new pg.Pool({ connectionString: DATABASE_URL });

export async function setupTestDb(): Promise<void> {
  const schemaPath = join(__dirname, '..', 'src', 'db', 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  await testPool.query(schema);
}

export async function cleanTestDb(): Promise<void> {
  await testPool.query('TRUNCATE signals, claims, intent_dependencies, intents, teams CASCADE');
}

export async function teardownTestDb(): Promise<void> {
  await testPool.end();
}

// Helper to directly query the test DB
export async function testQuery<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return testPool.query<T>(text, params);
}

// Seed a team for tests
export async function seedTeam(id = 'backend', name = 'Backend Team', conventions = 'Use TypeScript. Write tests.'): Promise<void> {
  await testPool.query(
    'INSERT INTO teams (id, name, conventions) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [id, name, conventions]
  );
}

// Seed an intent in open status
export async function seedOpenIntent(overrides: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const res = await testPool.query(
    `INSERT INTO intents (title, description, created_by, team_id, status, priority, acceptance_criteria, files_likely_touched)
     VALUES ($1, $2, $3, $4, 'open', $5, $6, $7)
     RETURNING *`,
    [
      overrides.title ?? 'Test intent',
      overrides.description ?? 'Test description',
      overrides.created_by ?? 'tester',
      overrides.team_id ?? 'backend',
      overrides.priority ?? 'medium',
      JSON.stringify(overrides.acceptance_criteria ?? ['It works']),
      JSON.stringify(overrides.files_likely_touched ?? []),
    ]
  );
  return res.rows[0];
}
