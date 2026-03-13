import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as db from '../db/queries.js';

export function registerSignalTools(server: McpServer): void {
  server.tool(
    'send_signal',
    'Send a signal (event notification) to the coordination system.',
    {
      type: z.enum(['completion', 'blocked', 'conflict', 'info', 'request']).describe('Signal type'),
      from_user: z.string().describe('Who is sending this signal'),
      intent_id: z.string().optional().describe('Related intent ID'),
      claim_id: z.string().optional().describe('Related claim ID'),
      message: z.string().describe('Signal message'),
      unblocks: z.array(z.string()).optional().describe('Intent IDs this unblocks'),
    },
    async (params) => {
      const signal = await db.sendSignal(params);
      return { content: [{ type: 'text', text: JSON.stringify(signal, null, 2) }] };
    }
  );

  server.tool(
    'get_signals',
    'Get signals matching filters. Useful for checking what happened while you were away.',
    {
      intent_id: z.string().optional().describe('Filter by intent'),
      team_id: z.string().optional().describe('Filter by team'),
      since: z.string().optional().describe('ISO timestamp — only signals after this time'),
      type: z.enum(['completion', 'blocked', 'conflict', 'info', 'request']).optional().describe('Filter by signal type'),
      limit: z.number().optional().describe('Max results (default: 20)'),
    },
    async (params) => {
      const signals = await db.getSignals(params);
      return { content: [{ type: 'text', text: JSON.stringify(signals, null, 2) }] };
    }
  );
}
