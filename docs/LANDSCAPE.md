# Swarm Protocol — Competitive Landscape & Market Signals

## The Gap

Every existing tool solves: **"I'm one developer running 3-5 agents in parallel, how do I prevent them from colliding?"**

Nobody is solving: **"We're a team of 8 humans, each working through agents, across multiple repos and teams. How do we know what's in flight, avoid stepping on each other, and automatically hand off unblocked work?"**

This is single-player multiplayer vs. true multiplayer. Different product category.

---

## Existing Tools (All Single-Developer Focus)

### 1. Claude Code Agent Teams (Anthropic, shipped with Opus 4.6)
- Officially launched as experimental feature — enable with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`
- One lead agent coordinates teammates, each in independent context windows
- Shared task list, inter-agent messaging, peer-to-peer communication between teammates
- Teammates work independently — not subagents reporting back to a parent
- Intra-session only — not cross-team, not cross-human
- Known limitations: no session resumption, no nested teams, no cross-session state
- Uses significantly more tokens than single sessions (~3-4x for a 3-teammate team)
- Best for: research/review, new modules, debugging with competing hypotheses, cross-layer coordination
- https://code.claude.com/docs/en/agent-teams

### 2. Claude Code Tasks (Anthropic, native)
- Task management persisting to `~/.claude/tasks/`
- Can share state across sessions via `CLAUDE_CODE_TASK_LIST_ID` env var
- Session-scoped by design — no cross-human coordination
- Dependencies and blockers supported
- https://venturebeat.com/orchestration/claude-codes-tasks-update-lets-agents-work-longer-and-coordinate-across

### 3. Claude Code Review (Anthropic, March 2026)
- Multi-agent PR review — dispatches parallel agents examining code from different perspectives
- Verification agent aggregates findings, removes duplicates, ranks by severity
- Agents don't approve PRs — they post flagged issues as inline comments
- Configurable via REVIEW.md (what to prioritize/deprioritize) and CLAUDE.md (codebase context)
- 54% of PRs receive substantive comments (up from 16% with older approaches per Anthropic)
- Scoped to single PR — not cross-session, not cross-team coordination
- Team and Enterprise plans only, ~$15-25 per review, ~20 min completion time
- https://www.anthropic.com/research/claude-code-review

### 4. VS Code Multi-Agent Development (Microsoft, Feb 2026)
- VS Code 1.109 positioned itself as "the home for multi-agent development"
- Run Claude, Codex, and Copilot agents side by side — local, background, or cloud
- Parallel subagents with visibility into what each is doing
- Agent Sessions view: single place to manage all running agents
- Agent Skills (Anthropic's open standard) generally available in VS Code extensions
- Custom agents with specialized tools, instructions, and model selection per agent
- Still single-developer scope — multiple agents for one person, not team coordination
- https://code.visualstudio.com/blogs/2026/02/05/multi-agent-development

### 5. CCPM — Claude Code Project Manager (automazeio)
- GitHub Issues as database, git worktrees for parallel execution
- PRD → Epic → Task → Issue → Code → Commit pipeline
- Closer to our idea but assumes single developer dispatching agents
- No cross-team coordination or conflict detection
- https://github.com/automazeio/ccpm

### 6. tick-md (Purple Horizons)
- Markdown file as database, git-backed, MCP server included
- 7 GitHub stars — tiny traction
- File locking, dependency tracking, real-time monitoring
- Elegant but single-file approach doesn't scale to multiple teams
- No intent/outcome abstraction — still task/ticket-oriented
- https://www.tick.md/
- https://github.com/Purple-Horizons (org page)

### 7. Agent-MCP (rinadelph)
- Shared memory graph ("Obsidian for AI agents"), file locking, task management
- Real-time dashboard visualization
- Single-repo, single-developer scope
- https://github.com/rinadelph/Agent-MCP

### 8. 1Code (21st.dev, YC W26)
- GUI wrapper for Claude Code / OpenAI Codex
- Cloud-based background execution, kanban board
- Git worktree isolation per agent
- GitHub/Linear/Slack automation triggers
- Orchestration client, not a coordination protocol
- https://dev.to/_46ea277e677b888e0cd13/1code-managing-multiple-ai-coding-agents-without-terminal-hell-14o4

### 9. multi-agent-coordination-mcp (AndrewDavidRivers)
- MCP server for Cursor IDE specifically
- File locking, dependency management, Projects → Tasks → Todo Items
- Single-developer scope
- https://github.com/AndrewDavidRivers/multi-agent-coordination-mcp

### 10. GitButler
- Auto-sorts parallel Claude Code sessions into separate git branches via hooks
- Each session gets its own branch automatically
- Smart but solves git conflict isolation, not team coordination
- https://blog.gitbutler.com/parallel-claude-code

### 11. multi-agent-coordination-framework (timothyjrainwater-lab)
- Methodology/protocol repo, not a tool
- Built by a non-technical operator coordinating Claude + GPT agents
- Handoff checklists, consistency gates, structured memo formats
- "If it's not in a file, it doesn't exist" — core principle
- Proves the pain is real but solution is manual protocols
- https://github.com/timothyjrainwater-lab/multi-agent-coordination-framework

### 12. Beads Village (MCP-based)
- MCP server with task queues, file locking, and built-in messaging between agents
- Standard workflow: initialize → claim tasks → lock files → work → complete
- Runs entirely locally, data stored in Git repo
- Cross-platform: supports Claude Desktop, Cursor, VS Code
- Still single-developer scope — no cross-human coordination
- https://mcp.aibase.com/server/1586804682578469105

---

## Research Papers

### AgentConductor (Chinese labs, Feb 2026)
- Dynamic topology evolution for multi-agent code generation
- LLM-based orchestrator infers agent roles and task difficulty, constructs task-adapted DAG topology
- Easy tasks get small, cheap teams. Hard tasks get large, highly connected teams.
- Manager rewrites the team workflow on failure based on error feedback
- 68% token cost reduction vs. fixed topologies, 14.6% accuracy improvement on competition-level code
- Validates our core thesis: static agent pipelines waste compute on simple tasks and fail on complex ones
- Still single-problem scope — solves intra-session topology, not cross-session coordination
- Paper: https://arxiv.org/abs/2602.17100

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
| State handoff | Implicit (file system changes) | Explicit (Context Package with structured output + dependency schema) |

## Key Positioning

- Not "Jira but with AI" — that's what Atlassian is doing and they'll always do it better
- Not "one dev managing agent fleet" — that's what 1Code, CCPM, tick-md do
- Not "smarter agents in one session" — that's what Agent Teams, Code Review, VS Code multi-agent, and AgentConductor do
- **"Coordination infrastructure for agent-first teams"** — a new category
- The market for this is tiny today and enormous in 12-18 months
- March 2026 signal: Anthropic shipped Agent Teams AND Code Review. Microsoft shipped multi-agent VS Code. AgentConductor paper dropped. All single-player. The multiplayer gap is widening, not closing.
- First mover who names the category owns the narrative
