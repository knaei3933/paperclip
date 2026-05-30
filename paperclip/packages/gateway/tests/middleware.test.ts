import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiServer } from '../src/api/api-server.js';
import type { ApiServerDeps } from '../src/api/api-server.js';
import { requestLogger } from '../src/api/middleware/request-logger.js';
import { errorHandler } from '../src/api/middleware/error-handler.js';
import { InProcessEventBus } from '@paperclip/core';

function createTestDeps(): ApiServerDeps {
  const bus = new InProcessEventBus();
  return {
    eventBus: bus,
    getHealth: async () => ({ status: 'ok', adapters: {} }),
    listAgents: async () => ({ agents: [], total: 0 }),
    listTasks: async () => [],
    createTask: async (input) => input,
    getTaskById: async () => null,
    getPendingEscalations: async () => [],
    approveEscalation: async () => ({}),
    rejectEscalation: async () => ({}),
    getImprovementMetrics: async () => ({}),
    getBudgetUtilization: async () => ({}),
    getThresholds: () => [],
    setThreshold: async () => {},
    routeEscalation: async () => [],
    createPipeline: async (input) => input,
    listPipelines: async () => [],
    getPipelineById: async () => null,
    advancePipeline: async () => ({ advanced: false }),
    updateAgent: async () => null,
    deactivateAgent: async () => false,
  };
}

function makeRequest(method: string, path: string): Request {
  return new Request(`http://localhost${path}`, { method });
}

// --- Request Logger Tests ---

describe('requestLogger middleware', () => {
  it('generates correlation ID and attaches to response header', async () => {
    const server = new ApiServer(createTestDeps());
    const res = await server.handleRequest(makeRequest('GET', '/api/health'));

    expect(res.headers.has('X-Correlation-Id')).toBe(true);
    const correlationId = res.headers.get('X-Correlation-Id')!;
    // UUID format: 8-4-4-4-12 hex chars
    expect(correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('logs method, path, status, and duration', async () => {
    const logEntries: Array<Record<string, unknown>> = [];
    const logger = requestLogger((entry) => {
      logEntries.push({ ...entry });
    });

    const req = new Request('http://localhost/test/path', { method: 'POST' });
    const response = await logger(req, async () => new Response(null, { status: 201 }));

    expect(response.headers.get('X-Correlation-Id')).toBeDefined();
    expect(logEntries).toHaveLength(1);
    expect(logEntries[0]!['method']).toBe('POST');
    expect(logEntries[0]!['path']).toBe('/test/path');
    expect(logEntries[0]!['status']).toBe(201);
    expect(typeof logEntries[0]!['durationMs']).toBe('number');
    expect(typeof logEntries[0]!['correlationId']).toBe('string');
  });

  it('sets correlation ID on the request object', async () => {
    let capturedId: string | undefined;
    const logger = requestLogger(() => {});

    const req = new Request('http://localhost/test', { method: 'GET' });
    await logger(req, async (innerReq) => {
      capturedId = (innerReq as Request & { correlationId?: string }).correlationId;
      return new Response(null, { status: 200 });
    });

    expect(capturedId).toBeDefined();
    expect(capturedId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

// --- Error Handler Tests ---

describe('errorHandler middleware', () => {
  it('catches thrown errors and returns structured 500 response', async () => {
    const deps = createTestDeps();
    deps.getHealth = async () => {
      throw new Error('Database connection failed');
    };
    const server = new ApiServer(deps);

    const res = await server.handleRequest(makeRequest('GET', '/api/health'));
    expect(res.status).toBe(500);

    const body = (await res.json()) as {
      error: string;
      message: string;
      requestId: string;
    };
    expect(body.error).toBe('Error');
    expect(body.message).toBe('Database connection failed');
    expect(body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('hides error details in production mode', () => {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';

    const handler = errorHandler();
    const err = new Error('secret internal details');
    const response = handler(err, 'test-request-id');

    process.env['NODE_ENV'] = originalEnv;

    expect(response.status).toBe(500);
    // Need to read the body from the cloned response
    return response.json().then((body: unknown) => {
      const typed = body as { error: string; message: string };
      expect(typed.error).toBe('InternalError');
      expect(typed.message).toBe('Internal server error');
    });
  });

  it('handles non-Error thrown values', async () => {
    const deps = createTestDeps();
    deps.getHealth = async () => {
      throw 'string error';
    };
    const server = new ApiServer(deps);

    const res = await server.handleRequest(makeRequest('GET', '/api/health'));
    expect(res.status).toBe(500);

    const body = (await res.json()) as {
      error: string;
      message: string;
      requestId: string;
    };
    expect(body.message).toBe('Internal server error');
    expect(body.requestId).toBeDefined();
  });
});

// --- Integration: correlation ID present on normal responses ---

describe('Integration: middleware pipeline in ApiServer', () => {
  it('attaches X-Correlation-Id to successful responses', async () => {
    const server = new ApiServer(createTestDeps());
    const res = await server.handleRequest(makeRequest('GET', '/api/agents'));

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Correlation-Id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
