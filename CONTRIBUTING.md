# Contributing to Swarm Protocol

Swarm Protocol is early-stage and building in public. We're looking for contributors at every level — from bug fixes to leading entire feature areas.

## We're Looking for Co-Maintainers

This isn't just "submit a PR and we'll review it." We're looking for people who want to **co-own this project** — review PRs, shape the roadmap, make design calls, help the community. Everyone pitches in on everything.

If you're interested, open an issue titled "Maintainer interest" and tell us what drew you to the project. No prior contributions required.

## Contributing Code

### Setup

```bash
git clone https://github.com/phuryn/swarm-protocol.git
cd swarm-protocol
docker compose up -d
npm install
npm run build
npm test
```

### Making Changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Add or update tests — we use integration tests against real PostgreSQL (see [TESTING.md](TESTING.md))
4. Run `npm test` and make sure all 67+ tests pass
5. Open a PR with a clear description of what and why

### Where to Contribute

The codebase is organized into natural contribution boundaries:

| Area | Files | Complexity |
|------|-------|------------|
| Tool groups | `src/tools/*.ts` | Low — each file is independent |
| Database queries | `src/db/queries.ts` | Medium — SQL + state transitions |
| Tests | `tests/*.test.ts` | Low — add new scenarios |
| CLAUDE.md integration | `claude-md/` | Low — improve the drop-in snippet |
| Documentation | `*.md` | Low |

### Good First Contributions

- Add a new signal type
- Improve error messages in query functions
- Add a `since` filter test for `get_signals`
- Write a SQLite adapter for `src/db/connection.ts`
- Add a `--port` flag for HTTP/SSE transport alongside stdio
- Improve `get_overview` with additional aggregations

### Code Style

- TypeScript strict mode
- Raw SQL with parameterized queries (`$1`, `$2`) — no ORM, no query builder
- Each tool group in its own file under `src/tools/`
- Tests are integration tests against real PostgreSQL — no mocks
- Keep it simple. If you're adding a dependency, explain why in the PR.

## Reporting Issues

Open an issue with:
- What you expected
- What happened
- Steps to reproduce (if applicable)
- Your environment (Node version, PostgreSQL version, OS)

## Design Philosophy

Before proposing large changes, read [SPEC.md](SPEC.md) and the Philosophy section in [CLAUDE.md](CLAUDE.md). The key principles:

- **Protocol over product** — resist feature creep toward traditional PM tools
- **MCP-native** — the interface is MCP tools, not REST or UI
- **Advisory, not enforced** — conflicts are warnings, not locks
- **Simple by default** — raw SQL, no frameworks, no magic

If your proposal adds significant complexity, open an issue to discuss the design before writing code.
