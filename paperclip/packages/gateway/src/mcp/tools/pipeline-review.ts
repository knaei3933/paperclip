import type { Pool } from 'pg';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runPipelineReview } from '@paperclip/trading';

export const pipelineReviewTool = {
  name: 'pipeline_review',
  description: 'Review the deal pipeline for stalled deals, expired proposals, and customers needing follow-up',
  register(mcpServer: McpServer, pool: Pool) {
    mcpServer.registerTool(
      'pipeline_review',
      {
        description:
          'Review the deal pipeline for stalled deals, expired proposals, and customers needing follow-up. Returns a list of ActionItem objects.',
      },
      async () => {
        const actions = await runPipelineReview({ pool });
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                totalActions: actions.length,
                stalled: actions.filter(a => a.type === 'stalled').length,
                expired: actions.filter(a => a.type === 'expired').length,
                followUp: actions.filter(a => a.type === 'follow_up').length,
                actions,
              }, null, 2),
            },
          ],
        };
      }
    );
  },
};
