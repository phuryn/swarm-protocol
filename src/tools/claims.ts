import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as db from '../db/queries.js';

export function registerClaimTools(server: McpServer): void {
  server.tool(
    'claim_work',
    'Claim an intent — declare you are actively working on it. Returns conflict warnings if others are touching overlapping files.',
    {
      intent_id: z.string().describe('ID of the intent to claim'),
      claimed_by: z.string().describe('Your identifier (e.g., your name)'),
      agent_session: z.string().optional().describe('Claude Code session ID'),
      files_touching: z.array(z.string()).optional().describe('Files you expect to modify'),
      branch: z.string().optional().describe('Git branch name'),
    },
    async (params) => {
      const result = await db.claimWork(params);
      const response: Record<string, unknown> = { claim: result.claim };
      if (result.conflicts.length > 0) {
        response.warnings = result.conflicts;
        response.message = `⚠️ ${result.conflicts.length} conflict(s) detected with active claims on overlapping files`;
      }
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  server.tool(
    'heartbeat',
    'Update heartbeat for an active claim. Call every 10-15 minutes. Claims with no heartbeat for 30 min get flagged as stale.',
    {
      claim_id: z.string().describe('ID of the active claim'),
      files_touching: z.array(z.string()).optional().describe('Updated file list if changed'),
    },
    async ({ claim_id, files_touching }) => {
      const claim = await db.heartbeat(claim_id, files_touching);
      return { content: [{ type: 'text', text: JSON.stringify(claim, null, 2) }] };
    }
  );

  server.tool(
    'release_claim',
    'Release a claim — sets it to abandoned and reopens the intent for others.',
    {
      claim_id: z.string().describe('ID of the claim to release'),
      reason: z.string().optional().describe('Why you are releasing this claim'),
    },
    async ({ claim_id, reason }) => {
      const claim = await db.releaseClaim(claim_id, reason);
      return { content: [{ type: 'text', text: JSON.stringify(claim, null, 2) }] };
    }
  );

  server.tool(
    'complete_claim',
    'Complete a claim — marks work as done. Creates a completion signal. Unblocks dependent intents if all their dependencies are met.',
    {
      claim_id: z.string().describe('ID of the claim to complete'),
      message: z.string().optional().describe('Summary of what was accomplished'),
      unblocks: z.array(z.string()).optional().describe('Intent IDs this work unblocks'),
    },
    async ({ claim_id, message, unblocks }) => {
      const result = await db.completeClaim(claim_id, message, unblocks);
      const response: Record<string, unknown> = { claim: result.claim };
      if (result.unblocked_intents.length > 0) {
        response.unblocked = result.unblocked_intents;
        response.message = `✅ Completed. ${result.unblocked_intents.length} intent(s) unblocked and now open for claiming.`;
      }
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );
}
