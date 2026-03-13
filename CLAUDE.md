# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Swarm Protocol is a headless MCP server for AI agent team coordination. It solves state synchronization when multiple people work through AI agents (Claude Code, etc.) on the same codebase simultaneously — preventing file conflicts, tracking work in flight, and managing task dependencies.

**Status:** Alpha — all 19 MCP tools implemented, integration tests written. See SPEC.md for the full design.

## Philosophy & Positioning

This is a **coordination protocol, not a project management tool**. The origin insight: "Jira was built for humans clicking buttons. This is coordination infrastructure for agent-first teams." The problem isn't Kanban or sprints — it's state synchronization when agents are the primary interface.

**Key differentiator:** Every existing tool (Claude Code Agent Teams, CCPM, tick-md, Agent-MCP, 1Code, etc.) solves single-developer multi-agent coordination. Swarm Protocol solves multi-human multi-agent coordination across teams. See LANDSCAPE.md for the full competitive analysis.

When making implementation decisions:
- **Protocol over product.** Keep it minimal and composable. Resist feature creep toward traditional PM concepts (sprints, boards, velocity, story points).
- **MCP-native is the differentiator.** The "UI" is Claude Code itself. No REST API or web dashboard in v1.
- **Ship fast, iterate in public.** This is a first-mover play on the "agent coordination protocol" category. Simplicity and speed of adoption matter more than feature completeness.
- **The CLAUDE.md integration pattern is as important as the server itself.** The drop-in snippet in `claude-md/COORDINATION.md` is what makes adoption zero-friction — agents coordinate automatically without humans configuring anything.

## Tech Stack

- Node.js + TypeScript
- PostgreSQL (raw SQL via `pg` driver, no ORM)
- `@modelcontextprotocol/sdk` for the MCP server
- No auth layer or UI in v1

## Build & Development Commands

```bash
docker compose up -d   # start PostgreSQL
npm install            # install dependencies
npm run build          # compile TypeScript
npm start              # start the MCP server (stdio transport)
npm test               # run integration tests (needs PostgreSQL)
npm run dev            # watch mode for TypeScript compilation
```

Database: PostgreSQL on `localhost:5432`, database `swarm_protocol`. Schema auto-applies on startup via `initDb()`. Connection string via `DATABASE_URL` env var (default: `postgresql://postgres:postgres@localhost:5432/swarm_protocol`).

Tests: Vitest, integration tests against real PostgreSQL. No mocks. Run `npm test` — requires a running PostgreSQL instance.

## Architecture

### Four Core Primitives

1. **Intent** — A unit of desired work outcome (not a ticket). Lifecycle: `draft → open → claimed → blocked/done/cancelled`. Intents can have parent-child relationships (decomposition) and depend on other intents.

2. **Claim** — Declaration that an agent/human is actively working on an intent. Tracks files being touched, branch name, and has a heartbeat mechanism (30-min stale threshold). Key for conflict detection.

3. **Signal** — Event notifications (completion, blocked, conflict, info, request) that flow between agents. Completion signals can unblock dependent intents.

4. **Context Package** — Assembled on-demand when an agent picks up work. Bundles the intent, dependencies, overlapping claims, recent signals, and team conventions into a single response.

### MCP Tools (the entire interface)

All interaction happens through 19 MCP tools — no REST API. Tools are grouped into:
- **Intent Management:** create, publish, list, get, update, decompose
- **Claim Management:** claim_work, heartbeat, release, complete
- **Conflict Detection:** check_conflicts (the key safety check before starting work)
- **Signals:** send_signal, get_signals
- **Context:** get_context (first call when an agent starts work)
- **Team/Overview:** list_teams, get_team_status, get_overview

### Key Design Decisions

- Conflicts are **advisory, not enforced** — no file-level locking
- `claimed_by` is a trust-based string identifier (auth deferred to v2)
- Single PostgreSQL instance (designed for <1000 users)
- Polling via MCP tools, no WebSocket subscriptions in v1

## Source Layout

All source goes under `src/`. Key entry point is `src/index.ts` (MCP server). Database layer in `src/db/` (schema, connection pool, query functions). Each tool group gets its own file in `src/tools/`. Shared types in `src/types.ts`.
