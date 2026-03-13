import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as db from '../db/queries.js';

export function registerConflictTools(server: McpServer): void {
  server.tool(
    'check_conflicts',
    'Check if any active claims are touching the given files. THE key safety check — call this before starting work.',
    {
      files: z.array(z.string()).describe('File paths you are about to modify'),
    },
    async ({ files }) => {
      const conflicts = await db.findConflicts(files);
      if (conflicts.length === 0) {
        return { content: [{ type: 'text', text: '✅ No conflicts. These files are clear to work on.' }] };
      }
      return {
        content: [{
          type: 'text',
          text: `⚠️ ${conflicts.length} conflict(s) found:\n${JSON.stringify(conflicts, null, 2)}`
        }]
      };
    }
  );
}
