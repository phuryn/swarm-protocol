import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as db from '../db/queries.js';

export function registerContextTools(server: McpServer): void {
  server.tool(
    'get_context',
    'Get the full context package for an intent. Call this FIRST when picking up work — gives you everything you need in one call.',
    {
      intent_id: z.string().describe('ID of the intent to get context for'),
    },
    async ({ intent_id }) => {
      const ctx = await db.getContext(intent_id);
      return { content: [{ type: 'text', text: JSON.stringify(ctx, null, 2) }] };
    }
  );
}
