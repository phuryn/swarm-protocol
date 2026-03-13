# Swarm Protocol

> MCP server for AI agent team coordination. No UI. No sprints. Just state sync.

**Status: Alpha — building in public**

## The Problem

When multiple people work through AI agents simultaneously:
- No one knows what's in flight right now
- Two agents edit the same files and create conflicts
- Completed work sits idle because no one picks up the next dependent task
- Context is lost between agent sessions
- There's no shared state of "done / in progress / blocked"

Every existing tool solves **single-developer** multi-agent coordination. Nobody is solving: **"We're a team of 8 humans, each working through agents, across multiple repos and teams. How do we stay in sync?"**

This isn't a project management problem. It's a state synchronization problem.

## What This Is

A headless coordination layer exposed as an MCP server. Agents query it to see what's in flight, claim work, detect file conflicts, and hand off unblocked tasks — all without human overhead.

The "UI" is Claude Code itself. Drop a snippet in your repo's CLAUDE.md and agents coordinate automatically.

## Quick Start

**Prerequisites:** Docker, Node.js 22+

```bash
# 1. Clone and set up
git clone https://github.com/phuryn/swarm-protocol.git
cd swarm-protocol

# 2. Start PostgreSQL
docker compose up -d

# 3. Build
npm install
npm run build

# 4. Test
npm test
```

**Add to Claude Code** (`~/.claude/config.json`):

```json
{
  "mcpServers": {
    "swarm-protocol": {
      "command": "node",
      "args": ["/path/to/swarm-protocol/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/swarm_protocol"
      }
    }
  }
}
```

**Enable automatic coordination** — copy [`claude-md/COORDINATION.md`](claude-md/COORDINATION.md) into your repo's CLAUDE.md. Agents will automatically check for conflicts, claim work, and signal completions.

## How It Works

### Four Primitives

| Primitive | What It Does |
|-----------|-------------|
| **Intent** | Unit of desired outcome. Lifecycle: `draft → open → claimed → done`. Not a ticket — an outcome. |
| **Claim** | "I'm working on this." Tracks files being touched, includes heartbeat for stale detection. |
| **Signal** | Event notification — completion, blocked, conflict, info. Flows to whoever needs to know. |
| **Context Package** | Everything an agent needs to start work, assembled in one call. |

### The Coordination Loop

```
Agent starts session
  → get_team_status (what's in flight?)
  → claim_work (I'm taking this, here are my files)
  → check_conflicts (am I stepping on anyone?)
  → heartbeat (still working, every 10-15 min)
  → complete_claim (done — this unblocks X, Y, Z)
```

### 19 MCP Tools

| Group | Tools |
|-------|-------|
| **Teams** | `create_team`, `list_teams`, `get_team_status`, `get_overview` |
| **Intents** | `create_intent`, `publish_intent`, `list_intents`, `get_intent`, `update_intent`, `decompose_intent` |
| **Claims** | `claim_work`, `heartbeat`, `release_claim`, `complete_claim` |
| **Conflicts** | `check_conflicts` |
| **Signals** | `send_signal`, `get_signals` |
| **Context** | `get_context` |

## Architecture

- **Runtime:** Node.js + TypeScript
- **Database:** PostgreSQL (raw SQL, no ORM)
- **Interface:** MCP-native via `@modelcontextprotocol/sdk`
- **Auth:** Trust-based v1 (agent passes user identifier)

See [SPEC.md](SPEC.md) for the full design. See [LANDSCAPE.md](LANDSCAPE.md) for competitive analysis. See [TESTING.md](TESTING.md) for test architecture, coverage, and assumptions.

## What Makes This Different

Every tool in this space — Claude Code Agent Teams, CCPM, tick-md, Agent-MCP, 1Code — solves the **single-player** version: one dev running multiple agents in parallel. That's useful but insufficient.

Swarm Protocol solves the **multiplayer** version: multiple humans, each working through agents, across teams. Cross-human conflict detection, dependency chains that auto-unblock, context packages that onboard agents instantly.

See [LANDSCAPE.md](LANDSCAPE.md) for the full competitive breakdown.

## Contributing

This is early-stage, building in public. We're looking for **contributors and maintainers** — people who want to own parts of this project, not just submit patches.

Interested in leading a feature area, reviewing PRs, or managing releases? See [CONTRIBUTING.md](CONTRIBUTING.md).

The tool groups (`src/tools/`) are natural contribution boundaries. The raw SQL + no-framework design is intentional — fork it, swap PostgreSQL for SQLite, add auth, build custom tools.

## License

MIT
