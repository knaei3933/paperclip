import { describe, it, expect } from 'vitest';
import { pingTool } from '../src/mcp/tools/ping.js';
import { pipelineReviewTool } from '../src/mcp/tools/pipeline-review.js';
import { proposalDraftTool } from '../src/mcp/tools/proposal-draft.js';
import { emailCheckTool } from '../src/mcp/tools/email-check.js';
import { z } from 'zod';

function createMockMcpServer() {
  const registeredTools: Array<{ name: string; description?: string; handler?: Function }> = [];
  return {
    registeredTools,
    registerTool(name: string, opts: any, handler?: Function) {
      registeredTools.push({ name, description: opts?.description, handler });
    },
  };
}

describe('MCP Tool Definitions', () => {
  describe('pingTool', () => {
    it('has name "ping"', () => {
      expect(pingTool.name).toBe('ping');
    });

    it('has a description', () => {
      expect(pingTool.description).toBeTypeOf('string');
      expect(pingTool.description.length).toBeGreaterThan(0);
    });

    it('registers a tool named "ping"', () => {
      const mockServer = createMockMcpServer();
      pingTool.register(mockServer as any, {} as any);
      expect(mockServer.registeredTools).toHaveLength(1);
      expect(mockServer.registeredTools[0].name).toBe('ping');
    });

    it('returns ok status from handler', async () => {
      const mockServer = createMockMcpServer();
      pingTool.register(mockServer as any, {} as any);
      const handler = mockServer.registeredTools[0].handler!;
      const result = await handler();
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe('ok');
      expect(parsed.timestamp).toBeDefined();
    });
  });

  describe('pipelineReviewTool', () => {
    it('has name "pipeline_review"', () => {
      expect(pipelineReviewTool.name).toBe('pipeline_review');
    });

    it('has a description', () => {
      expect(pipelineReviewTool.description).toBeTypeOf('string');
      expect(pipelineReviewTool.description.length).toBeGreaterThan(0);
    });

    it('registers a tool named "pipeline_review"', () => {
      const mockServer = createMockMcpServer();
      pipelineReviewTool.register(mockServer as any, {} as any);
      expect(mockServer.registeredTools).toHaveLength(1);
      expect(mockServer.registeredTools[0].name).toBe('pipeline_review');
    });
  });

  describe('proposalDraftTool', () => {
    it('has name "proposal_draft"', () => {
      expect(proposalDraftTool.name).toBe('proposal_draft');
    });

    it('has inputSchema with customerId, dealId, pdfFilePath', () => {
      const schema = proposalDraftTool.inputSchema;
      expect(schema).toBeInstanceOf(z.ZodObject);
      const shape = schema.shape;
      expect(shape.customerId).toBeDefined();
      expect(shape.dealId).toBeDefined();
      expect(shape.pdfFilePath).toBeDefined();
    });

    it('validates correct input', () => {
      const result = proposalDraftTool.inputSchema.safeParse({
        customerId: 'cust-1',
        dealId: 'deal-1',
        pdfFilePath: '/path/to/file.pdf',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing required fields', () => {
      const result = proposalDraftTool.inputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('has a handler function', () => {
      expect(proposalDraftTool.handler).toBeTypeOf('function');
    });
  });

  describe('emailCheckTool', () => {
    it('has name "email_check"', () => {
      expect(emailCheckTool.name).toBe('email_check');
    });

    it('has a description', () => {
      expect(emailCheckTool.description).toBeTypeOf('string');
      expect(emailCheckTool.description.length).toBeGreaterThan(0);
    });

    it('has a handler function', () => {
      expect(emailCheckTool.handler).toBeTypeOf('function');
    });

    it('has inputSchema', () => {
      expect(emailCheckTool.inputSchema).toBeDefined();
    });
  });
});
