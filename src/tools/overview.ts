import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as db from '../db/queries.js';

export function registerOverviewTools(server: McpServer): void {
  server.tool(
    'create_team',
    'Create a new team with optional conventions (coding standards, norms).',
    {
      id: z.string().describe('Team ID (short, e.g., "backend", "mobile")'),
      name: z.string().describe('Team display name'),
      conventions: z.string().optional().describe('Free-form team conventions, coding standards, norms'),
    },
    async ({ id, name, conventions }) => {
      const team = await db.createTeam(id, name, conventions);
      return { content: [{ type: 'text', text: JSON.stringify(team, null, 2) }] };
    }
  );

  server.tool(
    'list_teams',
    'List all teams.',
    {},
    async () => {
      const teams = await db.listTeams();
      return { content: [{ type: 'text', text: JSON.stringify(teams, null, 2) }] };
    }
  );

  server.tool(
    'get_team_status',
    'Get team mission control view — all active intents by status, active claims, and recent signals.',
    {
      team_id: z.string().describe('Team ID'),
    },
    async ({ team_id }) => {
      const status = await db.getTeamStatus(team_id);
      return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
    }
  );

  server.tool(
    'get_overview',
    'Get cross-team dashboard — intents by team, active conflicts, stale claims, blocked intents, recently completed work.',
    {},
    async () => {
      const overview = await db.getOverview();
      return { content: [{ type: 'text', text: JSON.stringify(overview, null, 2) }] };
    }
  );
}
