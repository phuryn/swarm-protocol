# 🐝 Swarm Protocol

[![Tests](https://github.com/phuryn/swarm-protocol/actions/workflows/test.yml/badge.svg)](https://github.com/phuryn/swarm-protocol/actions/workflows/test.yml)
![GitHub stars](https://img.shields.io/github/stars/phuryn/swarm-protocol?style=flat-square&color=0d9488)
[![License: MIT](https://img.shields.io/badge/License-MIT-0d9488?style=flat-square)](https://github.com/phuryn/swarm-protocol/blob/main/LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-0d9488?style=flat-square)](https://github.com/phuryn/swarm-protocol/blob/main/CONTRIBUTING.md)

**Coordination protocol for agent-first teams. No UI. No sprints. No Jira. Just state sync.**

![Swarm Protocol](docs/welcome.png)

**Status: Alpha — building in public. [19 MCP tools](#all-19-tools) implemented, integration tests passing.**

## The Coordination Loop

Drop [`COORDINATION.md`](claude-md/COORDINATION.md) into your repo's `CLAUDE.md` and agents coordinate automatically:

```
Agent starts session
  → get_team_status        "What's in flight?"
  → claim_work             "I'm taking this — here are my files"
  → check_conflicts        "Anyone else touching src/api/router.ts?"
  → heartbeat              "Still working" (every 10-15 min)
  → complete_claim          "Done — this unblocks intent_xyz"
                              ↳ intent_xyz status: blocked → open
                              ↳ Next agent picks it up automatically
```

Zero Slack messages. Zero status meetings. Agents coordinate through shared state.

## What This Is

A headless coordination layer exposed as an MCP server — the same protocol Claude Code already speaks. No REST API. No dashboard. Agents query it to see what's in flight, claim work, detect file conflicts, and hand off unblocked tasks.

This is a **coordination protocol, not a project management tool.** Jira was built for humans clicking buttons. This is state synchronization infrastructure for teams where agents are the primary development interface.

The CLAUDE.md integration pattern is as important as the server itself. Agents coordinate automatically without humans configuring anything.

## Who Is This For

Teams of 2+ developers where AI agents (Claude Code, etc.) are the primary development interface. If your workflow is "open terminal → tell Claude Code what to build → review the PR" and teammates are doing the same thing at the same time — this is the missing layer.

**Not for:** solo devs running multiple agents in parallel (tools like [CCPM](https://github.com/automazeio/ccpm) and [1Code](https://www.1code.io/) solve that). Not a Jira replacement. Not a project management tool.

## The Problem

Every existing tool in this space solves **single-player** multi-agent coordination: one developer dispatching 3-5 agents. Useful, but insufficient.

Nobody is solving **multiplayer**: multiple humans, each working through agents, across teams. That's not a project management problem — it's a state synchronization problem.

What happens without coordination:
- Two agents edit the same files → ugly merge conflicts
- Completed work sits idle — no one picks up the next dependent task
- Context is lost between agent sessions
- No shared state of what's done, in progress, or blocked

See [LANDSCAPE.md](docs/LANDSCAPE.md) for the full competitive breakdown.

## Four Primitives

| Primitive | What It Does |
|-----------|-------------|
| **Intent** | A unit of desired outcome — not a ticket. Lifecycle: `draft → open → claimed → done`. Has constraints, acceptance criteria, and dependency chains. |
| **Claim** | "I'm working on this." Tracks which files are being touched. Includes heartbeat — claims with no heartbeat for 30 min get flagged as stale. |
| **Signal** | Event notification: completion, blocked, conflict, info. When a completion signal fires, dependent intents auto-unblock. |
| **Context Package** | Everything an agent needs to start work — intent, dependencies, active claims on overlapping files, recent signals, team conventions — assembled in one call via `get_context`. |

## Architecture

![Architecture](docs/architecture.png)

**Stack:** Node.js + TypeScript · PostgreSQL (raw SQL, no ORM) · `@modelcontextprotocol/sdk`

**Design decisions:**
- Conflicts are advisory, not enforced — no file-level locking
- Auth is trust-based in v1 (`claimed_by` is a string the agent passes)
- Single PostgreSQL instance (designed for <1000 users)
- Polling via MCP tools, no WebSocket subscriptions
- Protocol over product — minimal and composable by design

## Key Tools

### `check_conflicts` — Prevent file collisions before they happen

```
→ check_conflicts({ files: ["src/api/router.ts", "src/middleware/auth.ts"] })

← { conflicts: [{
     file: "src/api/router.ts",
     claimed_by: "anna",
     intent: "Refactor API error handling",
     claim_id: "claim_abc123"
   }]}
```

### `get_context` — One call, full onboarding

```
→ get_context({ intent_id: "intent_abc123" })

← { intent: { title, description, constraints, acceptance_criteria },
    parent: null,
    dependencies: [{ id: "intent_xyz", status: "done" }],
    active_claims: [{ file: "src/middleware/rateLimit.ts", claimed_by: "pawel" }],
    recent_signals: [...],
    team_conventions: "Use Prettier. Tests required. No console.log in production." }
```

### `complete_claim` — Done. Dependents auto-unblock.

```
→ complete_claim({ claim_id: "claim_def456", unblocks: ["intent_xyz"] })

← intent_abc123: claimed → done
   intent_xyz: blocked → open  (all dependencies met)
   signal: completion created
```

### All 19 Tools

<details>
<summary>Full tool reference</summary>

| Group | Tools |
|-------|-------|
| **Teams** | `create_team`, `list_teams`, `get_team_status`, `get_overview` |
| **Intents** | `create_intent`, `publish_intent`, `list_intents`, `get_intent`, `update_intent`, `decompose_intent` |
| **Claims** | `claim_work`, `heartbeat`, `release_claim`, `complete_claim` |
| **Conflicts** | `check_conflicts` |
| **Signals** | `send_signal`, `get_signals` |
| **Context** | `get_context` |

See [SPEC.md](docs/SPEC.md) for full parameter specs and data model.

</details>

## Quick Start

**Prerequisites:** Docker, Node.js 22+

```bash
# Clone and set up
git clone https://github.com/phuryn/swarm-protocol.git
cd swarm-protocol

# Start PostgreSQL
docker compose up -d

# Build and test
npm install
npm run build
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

**Enable automatic coordination** — copy [`claude-md/COORDINATION.md`](claude-md/COORDINATION.md) into your repo's `CLAUDE.md`. That's it.

## What's Not in v1

Intentional omissions, not missing features:

- **No web UI** — agents and terminal are the interface
- **No auth** — trust-based identity. Auth layer comes when it needs to.
- **No real-time subscriptions** — MCP polling is sufficient
- **No notifications** — Slack/Discord integration is a natural v2 extension
- **No file locking** — conflicts are advisory by design
- **No multi-repo** — single repo per team assumed

## Looking for Co-Builders

The market for agent-team coordination is tiny today and enormous in 12-18 months. Every team adopting Claude Code, Codex, or similar tools will hit this exact problem the moment they scale past one developer.

This isn't a side project looking for drive-by PRs. It's a category that needs to be built. I'm looking for people who want to **own parts of this protocol** — lead feature areas, review PRs, shape the design.

**Where to plug in:**

- **Tool groups** (`src/tools/`) are natural ownership boundaries — each one is a self-contained module with its own tests
- **The protocol design itself** — the four primitives are v1. What's missing? What's wrong? Open an issue and make the case.
- **Adapters** — SQLite backend, auth layer, Slack signal forwarding, dashboard read-model. Each is a standalone contribution.
- **The CLAUDE.md pattern** — better coordination instructions, support for other agents beyond Claude Code

The raw SQL + no-framework design is intentional — fork it, swap PostgreSQL for SQLite, add auth, build custom tools.

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. Or just open an issue with your idea.

## Docs

| Doc | What's In It |
|-----|-------------|
| [SPEC.md](docs/SPEC.md) | Full protocol design, data model, SQL schema, tool specifications |
| [LANDSCAPE.md](docs/LANDSCAPE.md) | Competitive analysis — every tool in the space and why this is different |
| [TESTING.md](docs/TESTING.md) | Test architecture, coverage, assumptions |
| [COORDINATION.md](claude-md/COORDINATION.md) | Drop-in CLAUDE.md snippet for your repo |

## License

MIT
