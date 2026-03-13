#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { initDb } from './db/connection.js';
import { registerIntentTools } from './tools/intents.js';
import { registerClaimTools } from './tools/claims.js';
import { registerConflictTools } from './tools/conflicts.js';
import { registerSignalTools } from './tools/signals.js';
import { registerContextTools } from './tools/context.js';
import { registerOverviewTools } from './tools/overview.js';

const server = new McpServer({
  name: 'agentsync',
  version: '0.1.0',
});

// Register all tool groups
registerOverviewTools(server);   // create_team, list_teams, get_team_status, get_overview
registerIntentTools(server);     // create_intent, publish_intent, list_intents, get_intent, update_intent, decompose_intent
registerClaimTools(server);      // claim_work, heartbeat, release_claim, complete_claim
registerConflictTools(server);   // check_conflicts
registerSignalTools(server);     // send_signal, get_signals
registerContextTools(server);    // get_context

async function main(): Promise<void> {
  await initDb();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Failed to start AgentSync:', err);
  process.exit(1);
});
