import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Pool } from 'pg';
import { verifyToken } from '../api/auth/jwt.js';
import { pingTool } from './tools/ping.js';
import { pipelineReviewTool } from './tools/pipeline-review.js';
import { proposalDraftTool } from './tools/proposal-draft.js';
import { emailCheckTool } from './tools/email-check.js';

export function createMcpServer(pool: Pool): McpServer {
  const mcp = new McpServer(
    { name: 'paperclip-trading', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  // Register built-in tools
  pingTool.register(mcp, pool);
  pipelineReviewTool.register(mcp, pool);
  proposalDraftTool.register(mcp, pool);
  emailCheckTool.register(mcp, pool);

  return mcp;
}

export function handleMcpRequest(pool: Pool): (req: IncomingMessage, res: ServerResponse) => void {
  const sseTransports = new Map<string, SSEServerTransport>();

  return (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    // JWT validation — get token from query param or Authorization header
    const token =
      url.searchParams.get('token') ??
      req.headers.authorization?.replace('Bearer ', '');
    if (!token || !verifyToken(token)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    // SSE endpoint — client connects here
    if (url.pathname === '/mcp/sse' && req.method === 'GET') {
      const mcp = createMcpServer(pool);
      const transport = new SSEServerTransport('/mcp/rpc', res);
      sseTransports.set(transport.sessionId, transport);

      mcp.connect(transport as Transport);

      req.on('close', () => {
        sseTransports.delete(transport.sessionId);
      });
      return;
    }

    // JSON-RPC POST endpoint — client sends messages here
    if (url.pathname === '/mcp/rpc' && req.method === 'POST') {
      const sessionId = url.searchParams.get('sessionId');
      if (!sessionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing sessionId' }));
        return;
      }
      const transport = sseTransports.get(sessionId);
      if (!transport) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session not found' }));
        return;
      }
      transport.handlePostMessage(req as IncomingMessage & { body?: string }, res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  };
}
