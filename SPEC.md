# AgentSync — Agent-Native Team Coordination Protocol

## What This Is

A headless coordination layer for teams where AI agents (Claude Code, etc.) are the primary development interface. No UI. No sprints. No boards. Just an MCP server that agents and humans query to stay in sync.

## Problem

When multiple people work through AI agents simultaneously:
- No one knows what's in flight right now
- Two agents edit the same files and create conflicts
- Completed work sits idle because no one picks up the next dependent task
- Context is lost between agent sessions
- There's no shared state of "done / in progress / blocked"

This isn't a project management problem. It's a state synchronization problem.

## Core Primitives

### 1. Intent

What needs to happen. Not a ticket — a unit of desired outcome.

```json
{
  "id": "intent_abc123",
  "title": "Add rate limiting to API endpoints",
  "description": "All public API endpoints need rate limiting. 100 req/min per API key for free tier, 1000 for paid.",
  "created_by": "pawel",
  "team": "backend",
  "status": "draft",            // draft | open | claimed | blocked | done | cancelled
  "priority": "high",           // critical | high | medium | low
  "parent_id": null,            // for decomposed sub-intents
  "depends_on": ["intent_xyz"], // other intents that must complete first
  "context": "Part of the Q3 API hardening initiative. See RFC-012 for rate limit tiers.",
  "constraints": [
    "Must not break existing API contracts",
    "Use Redis for rate counting, not in-memory"
  ],
  "acceptance_criteria": [
    "All /api/v1/* endpoints return 429 when limit exceeded",
    "Rate limit headers present on every response",
    "Dashboard shows rate limit usage per key"
  ],
  "files_likely_touched": ["src/middleware/", "src/api/"],
  "created_at": "2026-03-13T10:00:00Z",
  "updated_at": "2026-03-13T10:00:00Z"
}
```

### 2. Claim

An agent (or human+agent pair) declares: "I'm working on this."

```json
{
  "id": "claim_def456",
  "intent_id": "intent_abc123",
  "claimed_by": "pawel",         // human identifier
  "agent_session": "cc_sess_789", // optional: Claude Code session ID
  "files_touching": [
    "src/middleware/rateLimit.ts",
    "src/api/v1/router.ts"
  ],
  "branch": "feat/rate-limiting",
  "status": "active",            // active | paused | completed | abandoned
  "started_at": "2026-03-13T10:30:00Z",
  "last_heartbeat": "2026-03-13T11:15:00Z"
}
```

### 3. Signal

Events that flow to whoever needs to know.

```json
{
  "id": "signal_ghi789",
  "type": "completion",          // completion | blocked | conflict | info | request
  "from": "pawel",
  "intent_id": "intent_abc123",
  "claim_id": "claim_def456",
  "message": "Rate limiting middleware done. Endpoints wired up. Tests passing. Unblocks intent_xyz.",
  "unblocks": ["intent_xyz"],
  "created_at": "2026-03-13T12:00:00Z"
}
```

### 4. Context Package

When an agent picks up work, it gets everything it needs in one call.

Assembled on the fly from:
- The intent (description, constraints, acceptance criteria)
- Related intents (parent, dependencies, blocked-by)
- Active claims on overlapping files (conflict awareness)
- Recent signals related to this intent or its dependencies
- Team conventions (from team config)

## Data Model (PostgreSQL)

```sql
CREATE TABLE teams (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  conventions TEXT,              -- free-form team norms, coding standards, etc.
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE intents (
  id              TEXT PRIMARY KEY DEFAULT 'intent_' || gen_random_uuid()::text,
  title           TEXT NOT NULL,
  description     TEXT,
  created_by      TEXT NOT NULL,
  team_id         TEXT REFERENCES teams(id),
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','claimed','blocked','done','cancelled')),
  priority        TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  parent_id       TEXT REFERENCES intents(id),
  context         TEXT,
  constraints     JSONB DEFAULT '[]',
  acceptance_criteria JSONB DEFAULT '[]',
  files_likely_touched JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE intent_dependencies (
  intent_id    TEXT REFERENCES intents(id) ON DELETE CASCADE,
  depends_on   TEXT REFERENCES intents(id) ON DELETE CASCADE,
  PRIMARY KEY (intent_id, depends_on)
);

CREATE TABLE claims (
  id            TEXT PRIMARY KEY DEFAULT 'claim_' || gen_random_uuid()::text,
  intent_id     TEXT REFERENCES intents(id) ON DELETE CASCADE,
  claimed_by    TEXT NOT NULL,
  agent_session TEXT,
  files_touching JSONB DEFAULT '[]',
  branch        TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','abandoned')),
  started_at    TIMESTAMPTZ DEFAULT now(),
  last_heartbeat TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE signals (
  id          TEXT PRIMARY KEY DEFAULT 'signal_' || gen_random_uuid()::text,
  type        TEXT NOT NULL CHECK (type IN ('completion','blocked','conflict','info','request')),
  from_user   TEXT NOT NULL,
  intent_id   TEXT REFERENCES intents(id),
  claim_id    TEXT REFERENCES claims(id),
  message     TEXT NOT NULL,
  unblocks    JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_intents_status ON intents(status);
CREATE INDEX idx_intents_team ON intents(team_id);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_claims_intent ON claims(intent_id);
CREATE INDEX idx_signals_intent ON signals(intent_id);
CREATE INDEX idx_signals_created ON signals(created_at DESC);
```

## MCP Server Tools

The entire interface. No REST API needed — agents interact through MCP only.

### Intent Management

**`create_intent`**
- Params: `title`, `description`, `team_id`, `priority`, `parent_id?`, `depends_on?[]`, `context?`, `constraints?[]`, `acceptance_criteria?[]`, `files_likely_touched?[]`
- Returns: created intent with status `draft`
- Auto-sets `created_by` from session context
- Intent is invisible to other agents until published

**`publish_intent`**
- Params: `intent_id`
- Validates required fields are present: `title`, `team_id`, `acceptance_criteria` (non-empty)
- Moves status from `draft` → `open`
- Returns: updated intent
- Fails if intent is not in `draft` status

**`list_intents`**
- Params: `team_id?`, `status?`, `priority?`, `created_by?`, `include_drafts?` (default false), `limit?` (default 20)
- Returns: intents matching filters, newest first
- Excludes `draft` intents unless `include_drafts=true` or `status=draft` explicitly set
- When `include_drafts=true`, only returns drafts owned by the requesting user

**`get_intent`**
- Params: `intent_id`
- Returns: full intent with dependencies, active claims, recent signals

**`update_intent`**
- Params: `intent_id`, any mutable fields
- Returns: updated intent

**`decompose_intent`**
- Params: `intent_id`, `sub_intents[]` (each with title, description, etc.)
- Creates child intents with `parent_id` set. Original intent stays open until all children are done.

### Claim Management

**`claim_work`**
- Params: `intent_id`, `claimed_by`, `files_touching?[]`, `branch?`
- Returns: claim + conflict warnings if other active claims touch overlapping files
- Side effect: sets intent status to `claimed`
- Fails if intent is not in `open` status (cannot claim drafts, already-claimed, or done intents)

**`heartbeat`**
- Params: `claim_id`, `files_touching?[]` (update if changed)
- Updates `last_heartbeat`. Claims with no heartbeat for 30 min get flagged as potentially stale.

**`release_claim`**
- Params: `claim_id`, `reason?`
- Sets claim to `abandoned`, intent back to `open`

**`complete_claim`**
- Params: `claim_id`, `message?`, `unblocks?[]`
- Sets claim to `completed`, intent to `done`
- Creates a completion signal automatically
- Updates dependent intents: if all dependencies met, their status changes to `open`

### Conflict Detection

**`check_conflicts`**
- Params: `files[]` (file paths about to be modified)
- Returns: list of active claims touching any of those files, with who and what intent
- This is the key safety check. Call before starting work.

### Signals

**`send_signal`**
- Params: `type`, `intent_id?`, `message`, `unblocks?[]`
- Returns: created signal

**`get_signals`**
- Params: `intent_id?`, `team_id?`, `since?` (timestamp), `type?`, `limit?`
- Returns: signals matching filters

### Context

**`get_context`**
- Params: `intent_id`
- Returns: assembled context package:
  - The intent itself
  - Parent intent (if sub-intent)
  - Dependency intents and their statuses
  - Active claims on this intent and overlapping files
  - Last 10 signals related to this intent
  - Team conventions
- This is what an agent calls first when starting work.

### Team

**`list_teams`**
- Returns: all teams

**`get_team_status`**
- Params: `team_id`
- Returns: all active intents for team grouped by status, active claims, recent signals. The "mission control" view.

### Dashboard / Overview

**`get_overview`**
- Returns: cross-team summary
  - Active intents by team and status
  - Current conflicts
  - Stale claims (no heartbeat > 30 min)
  - Recently completed intents
  - Blocked intents and what's blocking them

## CLAUDE.md Integration

This is how it gets embedded into every Claude Code session without human overhead.

### Repo-Level CLAUDE.md Addition

```markdown
## Team Coordination (AgentSync)

This project uses AgentSync for team coordination.
MCP server: mcp://localhost:3333/agentsync

### Before starting any work:
1. Call `get_team_status` for team "{team_id}" to see what's in flight
2. If picking up an intent, call `claim_work` with the files you expect to touch
3. Call `check_conflicts` with your file list to verify no collisions

### While working:
- Call `heartbeat` every 10-15 minutes with updated file list
- If blocked, call `send_signal` with type "blocked" and explain what you need

### After completing work:
1. Call `complete_claim` with a summary of what was done
2. If your work unblocks other intents, include them in `unblocks`

### If creating new work:
- Call `create_intent` to draft new work items
- Refine description, constraints, and acceptance criteria
- Call `publish_intent` when ready for someone to pick it up
- Use `decompose_intent` to break large intents into sub-intents
```

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Database**: PostgreSQL (single instance is fine for <1000 users)
- **MCP Server**: `@modelcontextprotocol/sdk`
- **No ORM**: Raw SQL with `pg` driver. The schema is simple enough.
- **No auth layer v1**: Trust-based. `claimed_by` is a string the agent passes. Auth can come later.
- **No UI v1**: Agents and terminal are the interface. A read-only dashboard can come later.

## What's Explicitly Out of Scope (v1)

- Web UI / dashboard
- Authentication / authorization
- Real-time WebSocket subscriptions (polling via MCP is fine)
- Notifications (Slack integration can come in v2)
- Historical analytics / velocity tracking
- File-level locking (conflicts are advisory, not enforced)
- Multi-repo support (single repo per team assumed)

## What Success Looks Like

Two people on the same team, both working through Claude Code, both starting sessions at roughly the same time. Neither touches the other's files. Both know what's in flight. When one finishes, the other's agent picks up the unblocked work next. Zero Slack messages needed.

## Repo Structure

```
agentsync/
├── README.md
├── LICENSE                    # MIT
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts               # MCP server entry point
│   ├── db/
│   │   ├── schema.sql         # PostgreSQL schema
│   │   ├── connection.ts      # pg pool setup
│   │   └── queries.ts         # all SQL queries as functions
│   ├── tools/
│   │   ├── intents.ts         # intent CRUD tools
│   │   ├── claims.ts          # claim management tools
│   │   ├── signals.ts         # signal tools
│   │   ├── conflicts.ts       # conflict detection
│   │   ├── context.ts         # context package assembly
│   │   └── overview.ts        # dashboard / team status
│   └── types.ts               # shared TypeScript types
├── claude-md/
│   └── COORDINATION.md        # drop-in CLAUDE.md snippet
└── examples/
    └── setup.sh               # quick start: create DB, run migrations, start server
```
