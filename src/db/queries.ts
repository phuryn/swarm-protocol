import { query } from './connection.js';
import type {
  Team, Intent, IntentWithRelations, Claim, Signal,
  ConflictWarning, ContextPackage, TeamStatus, Overview,
  IntentStatus, IntentPriority, SignalType,
} from '../types.js';

// ─── Teams ──────────────────────────────────────────────

export async function createTeam(id: string, name: string, conventions?: string): Promise<Team> {
  const res = await query<Team>(
    `INSERT INTO teams (id, name, conventions) VALUES ($1, $2, $3) RETURNING *`,
    [id, name, conventions ?? null]
  );
  return res.rows[0];
}

export async function listTeams(): Promise<Team[]> {
  const res = await query<Team>(`SELECT * FROM teams ORDER BY name`);
  return res.rows;
}

export async function getTeam(id: string): Promise<Team | null> {
  const res = await query<Team>(`SELECT * FROM teams WHERE id = $1`, [id]);
  return res.rows[0] ?? null;
}

// ─── Intents ────────────────────────────────────────────

interface CreateIntentParams {
  title: string;
  description?: string;
  created_by: string;
  team_id: string;
  priority?: IntentPriority;
  parent_id?: string;
  context?: string;
  constraints?: string[];
  acceptance_criteria?: string[];
  files_likely_touched?: string[];
}

export async function createIntent(params: CreateIntentParams): Promise<Intent> {
  const res = await query<Intent>(
    `INSERT INTO intents (title, description, created_by, team_id, priority, parent_id, context, constraints, acceptance_criteria, files_likely_touched)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      params.title,
      params.description ?? null,
      params.created_by,
      params.team_id,
      params.priority ?? 'medium',
      params.parent_id ?? null,
      params.context ?? null,
      JSON.stringify(params.constraints ?? []),
      JSON.stringify(params.acceptance_criteria ?? []),
      JSON.stringify(params.files_likely_touched ?? []),
    ]
  );
  return res.rows[0];
}

export async function createIntentDependencies(intentId: string, dependsOn: string[]): Promise<void> {
  for (const dep of dependsOn) {
    await query(
      `INSERT INTO intent_dependencies (intent_id, depends_on) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [intentId, dep]
    );
  }
}

export async function publishIntent(intentId: string): Promise<Intent> {
  // Validate the intent exists and is in draft status
  const check = await query<Intent>(`SELECT * FROM intents WHERE id = $1`, [intentId]);
  const intent = check.rows[0];
  if (!intent) throw new Error(`Intent ${intentId} not found`);
  if (intent.status !== 'draft') throw new Error(`Intent ${intentId} is not in draft status (current: ${intent.status})`);
  if (!intent.team_id) throw new Error(`Intent ${intentId} has no team_id`);
  const criteria = intent.acceptance_criteria as unknown as string[];
  if (!criteria || criteria.length === 0) throw new Error(`Intent ${intentId} has no acceptance criteria`);

  const res = await query<Intent>(
    `UPDATE intents SET status = 'open', updated_at = now() WHERE id = $1 RETURNING *`,
    [intentId]
  );
  return res.rows[0];
}

export async function getIntent(intentId: string): Promise<IntentWithRelations | null> {
  const res = await query<Intent>(`SELECT * FROM intents WHERE id = $1`, [intentId]);
  const intent = res.rows[0];
  if (!intent) return null;

  const deps = await query<{ depends_on: string }>(
    `SELECT depends_on FROM intent_dependencies WHERE intent_id = $1`,
    [intentId]
  );

  const claims = await query<Claim>(
    `SELECT * FROM claims WHERE intent_id = $1 AND status = 'active' ORDER BY started_at DESC`,
    [intentId]
  );

  const signals = await query<Signal>(
    `SELECT * FROM signals WHERE intent_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [intentId]
  );

  return {
    ...intent,
    depends_on: deps.rows.map(d => d.depends_on),
    active_claims: claims.rows,
    recent_signals: signals.rows,
  };
}

interface ListIntentsParams {
  team_id?: string;
  status?: IntentStatus;
  priority?: IntentPriority;
  created_by?: string;
  include_drafts?: boolean;
  requesting_user?: string;
  limit?: number;
}

export async function listIntents(params: ListIntentsParams): Promise<Intent[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (params.status) {
    conditions.push(`status = $${paramIdx++}`);
    values.push(params.status);
  } else if (!params.include_drafts) {
    conditions.push(`status != 'draft'`);
  }

  if (params.include_drafts && !params.status && params.requesting_user) {
    // Show non-drafts + only this user's drafts
    conditions.pop(); // Remove the status != draft condition
    conditions.push(`(status != 'draft' OR (status = 'draft' AND created_by = $${paramIdx++}))`);
    values.push(params.requesting_user);
  }

  if (params.team_id) {
    conditions.push(`team_id = $${paramIdx++}`);
    values.push(params.team_id);
  }
  if (params.priority) {
    conditions.push(`priority = $${paramIdx++}`);
    values.push(params.priority);
  }
  if (params.created_by) {
    conditions.push(`created_by = $${paramIdx++}`);
    values.push(params.created_by);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = params.limit ?? 20;

  const res = await query<Intent>(
    `SELECT * FROM intents ${where} ORDER BY created_at DESC LIMIT $${paramIdx}`,
    [...values, limit]
  );
  return res.rows;
}

interface UpdateIntentParams {
  intent_id: string;
  title?: string;
  description?: string;
  priority?: IntentPriority;
  status?: IntentStatus;
  context?: string;
  constraints?: string[];
  acceptance_criteria?: string[];
  files_likely_touched?: string[];
}

export async function updateIntent(params: UpdateIntentParams): Promise<Intent> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (params.title !== undefined) { sets.push(`title = $${paramIdx++}`); values.push(params.title); }
  if (params.description !== undefined) { sets.push(`description = $${paramIdx++}`); values.push(params.description); }
  if (params.priority !== undefined) { sets.push(`priority = $${paramIdx++}`); values.push(params.priority); }
  if (params.status !== undefined) { sets.push(`status = $${paramIdx++}`); values.push(params.status); }
  if (params.context !== undefined) { sets.push(`context = $${paramIdx++}`); values.push(params.context); }
  if (params.constraints !== undefined) { sets.push(`constraints = $${paramIdx++}`); values.push(JSON.stringify(params.constraints)); }
  if (params.acceptance_criteria !== undefined) { sets.push(`acceptance_criteria = $${paramIdx++}`); values.push(JSON.stringify(params.acceptance_criteria)); }
  if (params.files_likely_touched !== undefined) { sets.push(`files_likely_touched = $${paramIdx++}`); values.push(JSON.stringify(params.files_likely_touched)); }

  if (sets.length === 0) throw new Error('No fields to update');

  sets.push(`updated_at = now()`);

  const res = await query<Intent>(
    `UPDATE intents SET ${sets.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    [...values, params.intent_id]
  );
  if (res.rows.length === 0) throw new Error(`Intent ${params.intent_id} not found`);
  return res.rows[0];
}

interface SubIntentInput {
  title: string;
  description?: string;
  priority?: IntentPriority;
  constraints?: string[];
  acceptance_criteria?: string[];
  files_likely_touched?: string[];
}

export async function decomposeIntent(intentId: string, subIntents: SubIntentInput[]): Promise<Intent[]> {
  const parent = await query<Intent>(`SELECT * FROM intents WHERE id = $1`, [intentId]);
  if (parent.rows.length === 0) throw new Error(`Intent ${intentId} not found`);
  const p = parent.rows[0];

  const created: Intent[] = [];
  for (const sub of subIntents) {
    const res = await query<Intent>(
      `INSERT INTO intents (title, description, created_by, team_id, priority, parent_id, constraints, acceptance_criteria, files_likely_touched)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        sub.title,
        sub.description ?? null,
        p.created_by,
        p.team_id,
        sub.priority ?? p.priority,
        intentId,
        JSON.stringify(sub.constraints ?? []),
        JSON.stringify(sub.acceptance_criteria ?? []),
        JSON.stringify(sub.files_likely_touched ?? []),
      ]
    );
    created.push(res.rows[0]);
  }
  return created;
}

// ─── Claims ─────────────────────────────────────────────

interface ClaimWorkParams {
  intent_id: string;
  claimed_by: string;
  agent_session?: string;
  files_touching?: string[];
  branch?: string;
}

export async function claimWork(params: ClaimWorkParams): Promise<{ claim: Claim; conflicts: ConflictWarning[] }> {
  // Verify intent is open
  const intentRes = await query<Intent>(`SELECT * FROM intents WHERE id = $1`, [params.intent_id]);
  const intent = intentRes.rows[0];
  if (!intent) throw new Error(`Intent ${params.intent_id} not found`);
  if (intent.status !== 'open') throw new Error(`Intent ${params.intent_id} is not open (current: ${intent.status})`);

  // Create the claim
  const claimRes = await query<Claim>(
    `INSERT INTO claims (intent_id, claimed_by, agent_session, files_touching, branch)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      params.intent_id,
      params.claimed_by,
      params.agent_session ?? null,
      JSON.stringify(params.files_touching ?? []),
      params.branch ?? null,
    ]
  );
  const claim = claimRes.rows[0];

  // Update intent status
  await query(`UPDATE intents SET status = 'claimed', updated_at = now() WHERE id = $1`, [params.intent_id]);

  // Check for conflicts
  const conflicts = params.files_touching?.length
    ? await findConflicts(params.files_touching, claim.id)
    : [];

  return { claim, conflicts };
}

export async function heartbeat(claimId: string, filesTouching?: string[]): Promise<Claim> {
  const sets = ['last_heartbeat = now()'];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (filesTouching) {
    sets.push(`files_touching = $${paramIdx++}`);
    values.push(JSON.stringify(filesTouching));
  }

  const res = await query<Claim>(
    `UPDATE claims SET ${sets.join(', ')} WHERE id = $${paramIdx} AND status = 'active' RETURNING *`,
    [...values, claimId]
  );
  if (res.rows.length === 0) throw new Error(`Active claim ${claimId} not found`);
  return res.rows[0];
}

export async function releaseClaim(claimId: string, reason?: string): Promise<Claim> {
  const claimRes = await query<Claim>(`SELECT * FROM claims WHERE id = $1`, [claimId]);
  const claim = claimRes.rows[0];
  if (!claim) throw new Error(`Claim ${claimId} not found`);

  // Set claim to abandoned
  const res = await query<Claim>(
    `UPDATE claims SET status = 'abandoned' WHERE id = $1 RETURNING *`,
    [claimId]
  );

  // Set intent back to open
  await query(`UPDATE intents SET status = 'open', updated_at = now() WHERE id = $1`, [claim.intent_id]);

  // Optionally send an info signal about the release
  if (reason) {
    await query(
      `INSERT INTO signals (type, from_user, intent_id, claim_id, message) VALUES ('info', $1, $2, $3, $4)`,
      [claim.claimed_by, claim.intent_id, claimId, `Claim released: ${reason}`]
    );
  }

  return res.rows[0];
}

export async function completeClaim(
  claimId: string,
  message?: string,
  unblocks?: string[]
): Promise<{ claim: Claim; unblocked_intents: Intent[] }> {
  const claimRes = await query<Claim>(`SELECT * FROM claims WHERE id = $1`, [claimId]);
  const claim = claimRes.rows[0];
  if (!claim) throw new Error(`Claim ${claimId} not found`);
  if (claim.status !== 'active') throw new Error(`Claim ${claimId} is not active (current: ${claim.status})`);

  // Complete the claim
  await query(`UPDATE claims SET status = 'completed' WHERE id = $1`, [claimId]);

  // Set intent to done
  await query(`UPDATE intents SET status = 'done', updated_at = now() WHERE id = $1`, [claim.intent_id]);

  // Create completion signal
  await query(
    `INSERT INTO signals (type, from_user, intent_id, claim_id, message, unblocks)
     VALUES ('completion', $1, $2, $3, $4, $5)`,
    [
      claim.claimed_by,
      claim.intent_id,
      claimId,
      message ?? 'Work completed',
      JSON.stringify(unblocks ?? []),
    ]
  );

  // Unblock dependent intents: find intents that depend on the completed intent
  // and check if ALL their dependencies are now done
  const unblockedRes = await query<Intent>(
    `UPDATE intents SET status = 'open', updated_at = now()
     WHERE id IN (
       SELECT d.intent_id
       FROM intent_dependencies d
       WHERE d.depends_on = $1
       AND NOT EXISTS (
         SELECT 1 FROM intent_dependencies d2
         JOIN intents dep ON dep.id = d2.depends_on
         WHERE d2.intent_id = d.intent_id
         AND dep.status != 'done'
       )
     )
     AND status IN ('blocked', 'draft')
     RETURNING *`,
    [claim.intent_id]
  );

  const updated = await query<Claim>(`SELECT * FROM claims WHERE id = $1`, [claimId]);
  return { claim: updated.rows[0], unblocked_intents: unblockedRes.rows };
}

// ─── Conflicts ──────────────────────────────────────────

export async function findConflicts(files: string[], excludeClaimId?: string): Promise<ConflictWarning[]> {
  // Find active claims that touch any of the given files
  const excludeClause = excludeClaimId ? `AND c.id != $2` : '';
  const params: unknown[] = [JSON.stringify(files)];
  if (excludeClaimId) params.push(excludeClaimId);

  const res = await query<{
    claim_id: string;
    claimed_by: string;
    intent_id: string;
    intent_title: string;
    files_touching: string[];
  }>(
    `SELECT c.id as claim_id, c.claimed_by, c.intent_id, i.title as intent_title, c.files_touching
     FROM claims c
     JOIN intents i ON i.id = c.intent_id
     WHERE c.status = 'active' ${excludeClause}
     AND EXISTS (
       SELECT 1
       FROM jsonb_array_elements_text(c.files_touching) AS cf
       WHERE cf = ANY(SELECT jsonb_array_elements_text($1::jsonb))
     )`,
    params
  );

  return res.rows.map(row => {
    const claimFiles = row.files_touching as unknown as string[];
    return {
      claim_id: row.claim_id,
      claimed_by: row.claimed_by,
      intent_id: row.intent_id,
      intent_title: row.intent_title,
      overlapping_files: files.filter(f => claimFiles.includes(f)),
    };
  });
}

// ─── Signals ────────────────────────────────────────────

interface SendSignalParams {
  type: SignalType;
  from_user: string;
  intent_id?: string;
  claim_id?: string;
  message: string;
  unblocks?: string[];
}

export async function sendSignal(params: SendSignalParams): Promise<Signal> {
  const res = await query<Signal>(
    `INSERT INTO signals (type, from_user, intent_id, claim_id, message, unblocks)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      params.type,
      params.from_user,
      params.intent_id ?? null,
      params.claim_id ?? null,
      params.message,
      JSON.stringify(params.unblocks ?? []),
    ]
  );
  return res.rows[0];
}

interface GetSignalsParams {
  intent_id?: string;
  team_id?: string;
  since?: string;
  type?: SignalType;
  limit?: number;
}

export async function getSignals(params: GetSignalsParams): Promise<Signal[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (params.intent_id) {
    conditions.push(`s.intent_id = $${paramIdx++}`);
    values.push(params.intent_id);
  }
  if (params.team_id) {
    conditions.push(`i.team_id = $${paramIdx++}`);
    values.push(params.team_id);
  }
  if (params.since) {
    conditions.push(`s.created_at > $${paramIdx++}`);
    values.push(params.since);
  }
  if (params.type) {
    conditions.push(`s.type = $${paramIdx++}`);
    values.push(params.type);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = params.limit ?? 20;
  const needsJoin = params.team_id ? `LEFT JOIN intents i ON i.id = s.intent_id` : '';

  const res = await query<Signal>(
    `SELECT s.* FROM signals s ${needsJoin} ${where} ORDER BY s.created_at DESC LIMIT $${paramIdx}`,
    [...values, limit]
  );
  return res.rows;
}

// ─── Context ────────────────────────────────────────────

export async function getContext(intentId: string): Promise<ContextPackage> {
  const intent = await query<Intent>(`SELECT * FROM intents WHERE id = $1`, [intentId]);
  if (intent.rows.length === 0) throw new Error(`Intent ${intentId} not found`);
  const theIntent = intent.rows[0];

  // Parent
  let parent: Intent | null = null;
  if (theIntent.parent_id) {
    const parentRes = await query<Intent>(`SELECT * FROM intents WHERE id = $1`, [theIntent.parent_id]);
    parent = parentRes.rows[0] ?? null;
  }

  // Dependencies
  const depsRes = await query<Intent>(
    `SELECT i.* FROM intents i
     JOIN intent_dependencies d ON d.depends_on = i.id
     WHERE d.intent_id = $1`,
    [intentId]
  );
  const dependencies = depsRes.rows.map(dep => ({ intent: dep, status: dep.status }));

  // Active claims on this intent
  const claimsRes = await query<Claim>(
    `SELECT * FROM claims WHERE intent_id = $1 AND status = 'active'`,
    [intentId]
  );

  // Overlapping file claims from OTHER intents
  const filesLikely = theIntent.files_likely_touched as unknown as string[];
  let overlappingClaims: Claim[] = [];
  if (filesLikely.length > 0) {
    const overlapRes = await query<Claim>(
      `SELECT c.* FROM claims c
       WHERE c.status = 'active'
       AND c.intent_id != $1
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(c.files_touching) AS cf
         WHERE cf = ANY(SELECT jsonb_array_elements_text($2::jsonb))
       )`,
      [intentId, JSON.stringify(filesLikely)]
    );
    overlappingClaims = overlapRes.rows;
  }

  // Recent signals
  const signalsRes = await query<Signal>(
    `SELECT * FROM signals WHERE intent_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [intentId]
  );

  // Team conventions
  let teamConventions: string | null = null;
  if (theIntent.team_id) {
    const teamRes = await query<Team>(`SELECT conventions FROM teams WHERE id = $1`, [theIntent.team_id]);
    teamConventions = teamRes.rows[0]?.conventions ?? null;
  }

  return {
    intent: theIntent,
    parent,
    dependencies,
    active_claims: claimsRes.rows,
    overlapping_claims: overlappingClaims,
    recent_signals: signalsRes.rows,
    team_conventions: teamConventions,
  };
}

// ─── Team Status ────────────────────────────────────────

export async function getTeamStatus(teamId: string): Promise<TeamStatus> {
  const teamRes = await query<Team>(`SELECT * FROM teams WHERE id = $1`, [teamId]);
  if (teamRes.rows.length === 0) throw new Error(`Team ${teamId} not found`);

  const intentsRes = await query<Intent>(
    `SELECT * FROM intents WHERE team_id = $1 AND status != 'draft' ORDER BY priority, created_at DESC`,
    [teamId]
  );

  const intentsByStatus: Record<string, Intent[]> = {
    draft: [], open: [], claimed: [], blocked: [], done: [], cancelled: [],
  };
  for (const intent of intentsRes.rows) {
    intentsByStatus[intent.status].push(intent);
  }

  const claimsRes = await query<Claim>(
    `SELECT c.* FROM claims c
     JOIN intents i ON i.id = c.intent_id
     WHERE i.team_id = $1 AND c.status = 'active'
     ORDER BY c.started_at DESC`,
    [teamId]
  );

  const signalsRes = await query<Signal>(
    `SELECT s.* FROM signals s
     JOIN intents i ON i.id = s.intent_id
     WHERE i.team_id = $1
     ORDER BY s.created_at DESC
     LIMIT 20`,
    [teamId]
  );

  return {
    team: teamRes.rows[0],
    intents_by_status: intentsByStatus as Record<IntentStatus, Intent[]>,
    active_claims: claimsRes.rows,
    recent_signals: signalsRes.rows,
  };
}

// ─── Overview ───────────────────────────────────────────

export async function getOverview(): Promise<Overview> {
  // Intents by team
  const teamsRes = await query<Team>(`SELECT * FROM teams ORDER BY name`);
  const intentsByTeam = [];
  for (const team of teamsRes.rows) {
    const countRes = await query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) as count FROM intents WHERE team_id = $1 AND status != 'draft' GROUP BY status`,
      [team.id]
    );
    const counts: Record<string, number> = {
      draft: 0, open: 0, claimed: 0, blocked: 0, done: 0, cancelled: 0,
    };
    for (const row of countRes.rows) {
      counts[row.status] = parseInt(row.count, 10);
    }
    intentsByTeam.push({ team, counts: counts as Record<IntentStatus, number> });
  }

  // Active conflicts (active claims with overlapping files)
  const conflictsRes = await query<{
    claim_id_1: string; claimed_by_1: string; intent_id_1: string; title_1: string; files_1: string[];
    claim_id_2: string; claimed_by_2: string; intent_id_2: string; title_2: string; files_2: string[];
  }>(
    `SELECT
       c1.id as claim_id_1, c1.claimed_by as claimed_by_1, c1.intent_id as intent_id_1, i1.title as title_1, c1.files_touching as files_1,
       c2.id as claim_id_2, c2.claimed_by as claimed_by_2, c2.intent_id as intent_id_2, i2.title as title_2, c2.files_touching as files_2
     FROM claims c1
     JOIN claims c2 ON c1.id < c2.id
     JOIN intents i1 ON i1.id = c1.intent_id
     JOIN intents i2 ON i2.id = c2.intent_id
     WHERE c1.status = 'active' AND c2.status = 'active'
     AND EXISTS (
       SELECT 1
       FROM jsonb_array_elements_text(c1.files_touching) f1,
            jsonb_array_elements_text(c2.files_touching) f2
       WHERE f1 = f2
     )`
  );

  const activeConflicts: ConflictWarning[] = conflictsRes.rows.map(row => ({
    claim_id: row.claim_id_2,
    claimed_by: row.claimed_by_2,
    intent_id: row.intent_id_2,
    intent_title: row.title_2,
    overlapping_files: (row.files_1 as unknown as string[]).filter(
      f => (row.files_2 as unknown as string[]).includes(f)
    ),
  }));

  // Stale claims (no heartbeat > 30 min)
  const staleRes = await query<Claim & { intent_title: string }>(
    `SELECT c.*, i.title as intent_title
     FROM claims c
     JOIN intents i ON i.id = c.intent_id
     WHERE c.status = 'active'
     AND c.last_heartbeat < now() - interval '30 minutes'
     ORDER BY c.last_heartbeat ASC`
  );

  // Recently completed
  const completedRes = await query<Intent>(
    `SELECT * FROM intents WHERE status = 'done' ORDER BY updated_at DESC LIMIT 10`
  );

  // Blocked intents
  const blockedRes = await query<Intent & { blocked_by: string[] }>(
    `SELECT i.*,
       ARRAY(
         SELECT d.depends_on FROM intent_dependencies d
         JOIN intents dep ON dep.id = d.depends_on
         WHERE d.intent_id = i.id AND dep.status != 'done'
       ) as blocked_by
     FROM intents i
     WHERE i.status = 'blocked'
     ORDER BY i.priority, i.created_at`
  );

  return {
    intents_by_team: intentsByTeam,
    active_conflicts: activeConflicts,
    stale_claims: staleRes.rows,
    recently_completed: completedRes.rows,
    blocked_intents: blockedRes.rows,
  };
}
