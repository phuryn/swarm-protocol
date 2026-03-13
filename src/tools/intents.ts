import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as db from '../db/queries.js';

export function registerIntentTools(server: McpServer): void {
  server.tool(
    'create_intent',
    'Create a new intent (unit of desired work). Starts in draft status — invisible to others until published.',
    {
      title: z.string().describe('What needs to happen'),
      description: z.string().optional().describe('Detailed description'),
      created_by: z.string().describe('Who is creating this intent'),
      team_id: z.string().describe('Team this intent belongs to'),
      priority: z.enum(['critical', 'high', 'medium', 'low']).optional().describe('Priority level (default: medium)'),
      parent_id: z.string().optional().describe('Parent intent ID if this is a sub-intent'),
      depends_on: z.array(z.string()).optional().describe('Intent IDs this depends on'),
      context: z.string().optional().describe('Additional context'),
      constraints: z.array(z.string()).optional().describe('Constraints on how to accomplish this'),
      acceptance_criteria: z.array(z.string()).optional().describe('How to verify this is done'),
      files_likely_touched: z.array(z.string()).optional().describe('Files likely to be modified'),
    },
    async (params) => {
      const intent = await db.createIntent(params);
      if (params.depends_on?.length) {
        await db.createIntentDependencies(intent.id, params.depends_on);
      }
      return { content: [{ type: 'text', text: JSON.stringify(intent, null, 2) }] };
    }
  );

  server.tool(
    'publish_intent',
    'Publish a draft intent, making it visible and claimable. Validates required fields.',
    {
      intent_id: z.string().describe('ID of the intent to publish'),
    },
    async ({ intent_id }) => {
      const intent = await db.publishIntent(intent_id);
      return { content: [{ type: 'text', text: JSON.stringify(intent, null, 2) }] };
    }
  );

  server.tool(
    'list_intents',
    'List intents matching filters. Excludes drafts by default.',
    {
      team_id: z.string().optional().describe('Filter by team'),
      status: z.enum(['draft', 'open', 'claimed', 'blocked', 'done', 'cancelled']).optional().describe('Filter by status'),
      priority: z.enum(['critical', 'high', 'medium', 'low']).optional().describe('Filter by priority'),
      created_by: z.string().optional().describe('Filter by creator'),
      include_drafts: z.boolean().optional().describe('Include draft intents (only your own)'),
      requesting_user: z.string().optional().describe('Your user ID (needed if include_drafts is true)'),
      limit: z.number().optional().describe('Max results (default: 20)'),
    },
    async (params) => {
      const intents = await db.listIntents(params);
      return { content: [{ type: 'text', text: JSON.stringify(intents, null, 2) }] };
    }
  );

  server.tool(
    'get_intent',
    'Get full intent details including dependencies, active claims, and recent signals.',
    {
      intent_id: z.string().describe('ID of the intent'),
    },
    async ({ intent_id }) => {
      const intent = await db.getIntent(intent_id);
      if (!intent) return { content: [{ type: 'text', text: `Intent ${intent_id} not found` }], isError: true };
      return { content: [{ type: 'text', text: JSON.stringify(intent, null, 2) }] };
    }
  );

  server.tool(
    'update_intent',
    'Update mutable fields of an intent.',
    {
      intent_id: z.string().describe('ID of the intent to update'),
      title: z.string().optional(),
      description: z.string().optional(),
      priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
      status: z.enum(['draft', 'open', 'claimed', 'blocked', 'done', 'cancelled']).optional(),
      context: z.string().optional(),
      constraints: z.array(z.string()).optional(),
      acceptance_criteria: z.array(z.string()).optional(),
      files_likely_touched: z.array(z.string()).optional(),
    },
    async (params) => {
      const intent = await db.updateIntent(params);
      return { content: [{ type: 'text', text: JSON.stringify(intent, null, 2) }] };
    }
  );

  server.tool(
    'decompose_intent',
    'Break a large intent into sub-intents. Children inherit team and creator from parent.',
    {
      intent_id: z.string().describe('ID of the parent intent to decompose'),
      sub_intents: z.array(z.object({
        title: z.string(),
        description: z.string().optional(),
        priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
        constraints: z.array(z.string()).optional(),
        acceptance_criteria: z.array(z.string()).optional(),
        files_likely_touched: z.array(z.string()).optional(),
      })).describe('Array of sub-intents to create'),
    },
    async ({ intent_id, sub_intents }) => {
      const created = await db.decomposeIntent(intent_id, sub_intents);
      return { content: [{ type: 'text', text: JSON.stringify(created, null, 2) }] };
    }
  );
}
