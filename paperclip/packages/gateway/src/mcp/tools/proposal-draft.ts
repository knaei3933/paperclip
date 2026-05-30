import { z } from 'zod';
import type { Pool } from 'pg';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createProposalDraft } from '@paperclip/trading';

const proposalDraftShape = {
  customerId: z.string().describe('Customer ID'),
  dealId: z.string().describe('Deal ID'),
  pdfFilePath: z.string().describe('Path to the manufacturer PDF quotation file'),
};

const proposalDraftSchema = z.object(proposalDraftShape);

async function handleProposalDraft(args: { customerId: string; dealId: string; pdfFilePath: string }, pool: Pool) {
  const result = await createProposalDraft({ pool }, {
    customerId: args.customerId,
    dealId: args.dealId,
    pdfFilePath: args.pdfFilePath,
  });
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

export const proposalDraftTool = {
  name: 'proposal_draft',
  description: 'Create a proposal draft from a manufacturer PDF quotation. Extracts specs, calculates margins, and returns a draft proposal. Returns raw specs with translationNeeded flag — translation happens outside this tool.',
  inputSchema: proposalDraftSchema,
  handler: handleProposalDraft,
  register(mcpServer: McpServer, pool: Pool) {
    (mcpServer as any).tool(
      'proposal_draft',
      'Create a proposal draft from a manufacturer PDF quotation. Extracts specs, calculates margins, and returns a draft proposal. Returns raw specs with translationNeeded flag — translation happens outside this tool.',
      proposalDraftShape,
      async (args: { customerId: string; dealId: string; pdfFilePath: string }) => handleProposalDraft(args, pool)
    );
  },
};
