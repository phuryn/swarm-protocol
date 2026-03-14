// Intent statuses
export type IntentStatus = 'draft' | 'open' | 'claimed' | 'blocked' | 'done' | 'cancelled';

// Intent priorities
export type IntentPriority = 'critical' | 'high' | 'medium' | 'low';

// Claim statuses
export type ClaimStatus = 'active' | 'paused' | 'completed' | 'abandoned';

// Signal types
export type SignalType = 'completion' | 'blocked' | 'conflict' | 'info' | 'request';

export interface Team {
  id: string;
  name: string;
  conventions: string | null;
  created_at: Date;
}

export interface Intent {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  team_id: string | null;
  status: IntentStatus;
  priority: IntentPriority;
  parent_id: string | null;
  context: string | null;
  constraints: string[];
  acceptance_criteria: string[];
  files_likely_touched: string[];
  created_at: Date;
  updated_at: Date;
}

export interface IntentWithRelations extends Intent {
  depends_on: string[];
  active_claims: Claim[];
  recent_signals: Signal[];
}

export interface Claim {
  id: string;
  intent_id: string;
  claimed_by: string;
  agent_session: string | null;
  files_touching: string[];
  branch: string | null;
  status: ClaimStatus;
  started_at: Date;
  last_heartbeat: Date;
}

export interface Signal {
  id: string;
  type: SignalType;
  from_user: string;
  intent_id: string | null;
  claim_id: string | null;
  message: string;
  unblocks: string[];
  created_at: Date;
}

export interface ContextPackage {
  intent: Intent;
  parent: Intent | null;
  dependencies: Array<{ intent: Intent; status: IntentStatus }>;
  active_claims: Claim[];
  overlapping_claims: Claim[];
  recent_signals: Signal[];
  team_conventions: string | null;
}

export interface ConflictWarning {
  claim_id: string;
  claimed_by: string;
  intent_id: string;
  intent_title: string;
  overlapping_files: string[];
}

export interface TeamStatus {
  team: Team;
  intents_by_status: Record<IntentStatus, Intent[]>;
  active_claims: Claim[];
  recent_signals: Signal[];
}

export interface Overview {
  intents_by_team: Array<{
    team: Team;
    counts: Record<IntentStatus, number>;
  }>;
  active_conflicts: ConflictWarning[];
  stale_claims: Array<Claim & { intent_title: string }>;
  recently_completed: Intent[];
  blocked_intents: Array<Intent & { blocked_by: string[] }>;
}

export interface BoardIntent {
  id: string;
  title: string;
  priority: IntentPriority;
  team_id: string | null;
  claimed_by: string | null;
  claim_id: string | null;
  blocked_by: string[];
}

export type BoardStatus = Exclude<IntentStatus, 'draft'>;

export interface BoardView {
  columns: Record<BoardStatus, BoardIntent[]>;
  summary: Record<BoardStatus, number>;
}
