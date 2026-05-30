import type { Pool } from 'pg';

export const pingTool = {
  name: 'ping',
  description: 'Health check — returns server status and current timestamp',
  register(mcpServer: import('@modelcontextprotocol/sdk/server/mcp.js').McpServer, _pool: Pool) {
    mcpServer.registerTool(
      'ping',
      { description: 'Health check — returns server status and current timestamp' },
      async () => ({
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
          },
        ],
      })
    );
  },
};
