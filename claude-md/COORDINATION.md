## Team Coordination (Swarm Protocol)

This project uses Swarm Protocol for team coordination.
MCP server: mcp://localhost:3333/swarm-protocol

### Before starting any work:
1. Call `get_team_status` for your team to see what's in flight
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
