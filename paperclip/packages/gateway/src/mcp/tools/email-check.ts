import { z } from 'zod';
import type { Pool } from 'pg';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { checkEmails } from '@paperclip/trading';

const emailCheckSchema = z.object({});

async function handleEmailCheck(_args: Record<string, unknown>, pool: Pool) {
  const db = { pool };
  const drafts = await checkEmails(db);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ emails: drafts, count: drafts.length }, null, 2),
      },
    ],
  };
}

export const emailCheckTool = {
  name: 'email_check',
  description: 'Check for new customer emails via IMAP. Returns email drafts with language detection (ko/ja/en) and deal context. Does NOT generate replies — Claude Code generates replies after user review.',
  inputSchema: emailCheckSchema,
  handler: handleEmailCheck,
  register(mcpServer: McpServer, pool: Pool) {
    (mcpServer as any).registerTool(
      'email_check',
      {
        description: 'Check for new customer emails via IMAP. Returns email drafts with language detection (ko/ja/en) and deal context. Does NOT generate replies — Claude Code generates replies after user review.',
      },
      async () => handleEmailCheck({}, pool)
    );
  },
};
