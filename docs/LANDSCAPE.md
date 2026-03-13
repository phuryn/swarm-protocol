# Swarm Protocol — Competitive Landscape & Market Signals

## The Gap

Every existing tool solves: **"I'm one developer running 3-5 agents in parallel, how do I prevent them from colliding?"**

Nobody is solving: **"We're a team of 8 humans, each working through agents, across multiple repos and teams. How do we know what's in flight, avoid stepping on each other, and automatically hand off unblocked work?"**

This is single-player multiplayer vs. true multiplayer. Different product category.

---

## Existing Tools (All Single-Developer Focus)

### 1. Claude Code Agent Teams (Anthropic, experimental)
- One lead agent coordinates teammates within a single session
- Shared task list, file locking, inter-agent messaging
- Intra-session only — not cross-team, not cross-human
- Still experimental, known limitations around session resumption
- https://code.claude.com/docs/en/agent-teams

### 2. Claude Code Tasks (Anthropic, native)
- Task management persisting to `~/.claude/tasks/`
- Can share state across sessions via `CLAUDE_CODE_TASK_LIST_ID` env var
- Session-scoped by design — no cross-human coordination
- Dependencies and blockers supported
- https://venturebeat.com/orchestration/claude-codes-tasks-update-lets-agents-work-longer-and-coordinate-across

### 3. CCPM — Claude Code Project Manager (automazeio)
- GitHub Issues as database, git worktrees for parallel execution
- PRD → Epic → Task → Issue → Code → Commit pipeline
- Closer to our idea but assumes single developer dispatching agents
- No cross-team coordination or conflict detection
- https://github.com/automazeio/ccpm

### 4. tick-md (Purple Horizons)
- Markdown file as database, git-backed, MCP server included
- 7 GitHub stars — tiny traction
- File locking, dependency tracking, real-time monitoring
- Elegant but single-file approach doesn't scale to multiple teams
- No intent/outcome abstraction — still task/ticket-oriented
- https://www.tick.md/
- https://github.com/Purple-Horizons (org page)

### 5. Agent-MCP (rinadelph)
- Shared memory graph ("Obsidian for AI agents"), file locking, task management
- Real-time dashboard visualization
- Single-repo, single-developer scope
- https://github.com/rinadelph/Agent-MCP

### 6. 1Code (21st.dev, YC W26)
- GUI wrapper for Claude Code / OpenAI Codex
- Cloud-based background execution, kanban board
- Git worktree isolation per agent
- GitHub/Linear/Slack automation triggers
- Orchestration client, not a coordination protocol
- https://dev.to/_46ea277e677b888e0cd13/1code-managing-multiple-ai-coding-agents-without-terminal-hell-14o4

### 7. multi-agent-coordination-mcp (AndrewDavidRivers)
- MCP server for Cursor IDE specifically
- File locking, dependency management, Projects → Tasks → Todo Items
- Single-developer scope
- https://github.com/AndrewDavidRivers/multi-agent-coordination-mcp

### 8. GitButler
- Auto-sorts parallel Claude Code sessions into separate git branches via hooks
- Each session gets its own branch automatically
- Smart but solves git conflict isolation, not team coordination
- https://blog.gitbutler.com/parallel-claude-code

### 9. multi-agent-coordination-framework (timothyjrainwater-lab)
- Methodology/protocol repo, not a tool
- Built by a non-technical operator coordinating Claude + GPT agents
- Handoff checklists, consistency gates, structured memo formats
- "If it's not in a file, it doesn't exist" — core principle
- Proves the pain is real but solution is manual protocols
- https://github.com/timothyjrainwater-lab/multi-agent-coordination-framework

### 10. Beads Village (MCP-based)
- MCP server with task queues, file locking, and built-in messaging between agents
- Standard workflow: initialize → claim tasks → lock files → work → complete
- Runs entirely locally, data stored in Git repo
- Cross-platform: supports Claude Desktop, Cursor, VS Code
- Still single-developer scope — no cross-human coordination
- https://mcp.aibase.com/server/1586804682578469105

---

## What Jira Is Doing

- Atlassian launched **"agents in Jira"** (open beta, Feb 2026) — assign tasks to AI agents from the same dashboard as human employees
- Rovo Dev — AI agent for developers working with Jira + Bitbucket
- Agentic CI/CD in Bitbucket Pipelines — natural language workflow automation
- All of this is bolting agents onto the existing ticket model — opposite of agent-native
- https://techcrunch.com/2026/02/25/jiras-latest-update-allows-ai-agents-and-humans-to-work-side-by-side/
- https://www.atlassian.com/blog/announcements/ai-agents-in-jira

---

## Pain Signals From the Community

### "Recipe for disaster"
> One developer called multi-agent coding "a recipe for disaster" with "too much code to review" and "ugly conflicts due to agents all modifying the same files in different ways."
- Source: https://www.eqengineered.com/insights/multiple-coding-agents

### "You're the synchronization layer"
> "With two agents it's manageable. With three it gets stressful. With five — it's impossible. The difference is whether the agents can operate autonomously... In a shared directory, the answer is no."
- Source: https://vibehackers.io/blog/git-worktrees-multi-agent-development

### "Agents forget everything between sessions"
> A non-technical builder coordinating Claude + GPT over 100+ sessions found: "Agents forget everything between sessions. Parallel agents conflict. Nobody holds the full picture. Documents drift from reality. The human coordinator becomes the bottleneck."
- Source: https://github.com/timothyjrainwater-lab/multi-agent-coordination-framework

### "Terminal hell"
> 1Code's creator after 4 months with Claude Code: "Running 3-4 agents in parallel, the CLI became painful." No visibility, git diffs scattered, merge conflicts waiting to happen.
- Source: https://dev.to/_46ea277e677b888e0cd13/1code-managing-multiple-ai-coding-agents-without-terminal-hell-14o4

### "Productivity decreased by 23%"
> A Medium article reported one e-commerce team's productivity actually decreased by 23% after introducing their third AI tool, because tools were fighting each other with conflicting suggestions.
- Source: https://medium.com/@techdigesthq/when-ai-tools-fight-each-other-the-hidden-chaos-of-multi-agent-workflows-83169e8dcc6f

### Reddit/community signals
> From r/programming: "Spent 4 hours debugging why my tests kept failing only to discover that my AI code formatter and my AI test generator were in a literal fight over syntax preferences."
> From r/ExperiencedDevs: "Junior devs think AI tools are magic, but they don't understand that each tool has its own 'opinion' about best practices."

---

## Swarm Protocol Differentiation

| Dimension | Existing Tools | Swarm Protocol |
|-----------|---------------|-----------|
| Scope | One dev, multiple agents | Multiple humans + agents across teams |
| Primitive | Tasks / Tickets | Intents (outcome-oriented) |
| Coordination | File locking, git worktrees | Claims + conflict detection + signals |
| Context | Per-session, lost between sessions | Context packages assembled on demand |
| Interface | GUI / CLI / Markdown files | MCP-native, embedded in CLAUDE.md |
| Team support | None | Multi-team with conventions |
| State sharing | Env vars, shared files | PostgreSQL, real-time via MCP |
| Draft workflow | No | Draft → publish → claim |

## Key Positioning

- Not "Jira but with AI" — that's what Atlassian is doing and they'll always do it better
- Not "one dev managing agent fleet" — that's what 1Code, CCPM, tick-md do
- **"Coordination infrastructure for agent-first teams"** — a new category
- The market for this is tiny today and enormous in 12-18 months
- First mover who names the category owns the narrative
