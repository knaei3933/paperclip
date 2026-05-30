import { randomUUID, createHash } from 'node:crypto';
import type { EventBus } from '@paperclip/shared-types';
import type { Pool } from 'pg';
import { requestLogger } from './middleware/request-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { caseTransformMiddleware } from './middleware/case-transform.js';
import { authenticateRequest } from './auth/auth-middleware.js';
import { generateAccessToken, generateRefreshToken, storeRefreshToken, consumeRefreshToken, verifyToken } from './auth/jwt.js';

export interface ApiServerDeps {
  eventBus: EventBus;
  pool?: Pool;
  getHealth: () => Promise<{ status: string; adapters: Record<string, boolean> }>;
  listAgents: () => Promise<{ agents: unknown[]; total: number }>;
  listTasks: (filters?: Record<string, unknown>) => Promise<unknown[]>;
  createTask: (input: Record<string, unknown>) => Promise<unknown>;
  getTaskById: (id: string) => Promise<unknown | null>;
  getPendingEscalations: () => Promise<unknown[]>;
  approveEscalation: (id: string) => Promise<unknown>;
  rejectEscalation: (id: string) => Promise<unknown>;
  updateAgent: (id: string, data: Record<string, unknown>) => Promise<unknown | null>;
  deactivateAgent: (id: string) => Promise<boolean>;
  getImprovementMetrics: () => Promise<unknown>;
  getBudgetUtilization: () => Promise<unknown>;
  getThresholds: () => unknown[];
  setThreshold: (threshold: Record<string, unknown>) => Promise<void>;
  routeEscalation: (escalation: unknown) => Promise<string[]>;
  createPipeline: (input: Record<string, unknown>) => Promise<unknown>;
  listPipelines: () => Promise<unknown[]>;
  getPipelineById: (id: string) => Promise<unknown | null>;
  advancePipeline: (id: string) => Promise<{ advanced: boolean; nextTaskId?: string }>;
}

export interface WebSocketMessage {
  type: 'agent_status_changed' | 'task_updated' | 'escalation_created';
  data: unknown;
}

type RouteHandler = (request: Request, params: Record<string, string>) => Promise<Response>;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

export class ApiServer {
  private routes: Route[] = [];
  private wsClients: Set<{ send: (msg: string) => void }> = new Set();
  private deps: ApiServerDeps;
  private loggerMiddleware: ReturnType<typeof requestLogger>;
  private errorMiddleware: ReturnType<typeof errorHandler>;
  private caseMiddleware: ReturnType<typeof caseTransformMiddleware>;

  constructor(deps: ApiServerDeps) {
    this.deps = deps;
    this.loggerMiddleware = requestLogger();
    this.errorMiddleware = errorHandler();
    this.caseMiddleware = caseTransformMiddleware();
    this.registerRoutes();

    // Security startup warnings
    if (!process.env.TELEGRAM_WEBHOOK_SECRET) {
      console.warn('[API] Webhook verification disabled -- set TELEGRAM_WEBHOOK_SECRET and call setWebhook with secret_token');
    }
    if (process.env.JWT_SECRET) {
      console.log('[API] JWT authentication enabled');
      if (!process.env.AUTH_USERNAME || !process.env.AUTH_PASSWORD) {
        console.warn('[API] JWT_SECRET set but AUTH_USERNAME/AUTH_PASSWORD not configured -- login endpoint will return 503');
      }
    } else if (process.env.API_AUTH_TOKEN) {
      console.log('[API] Legacy Bearer token authentication enabled');
    } else {
      console.warn('[API] Authentication disabled -- set JWT_SECRET (recommended) or API_AUTH_TOKEN to enable');
    }

    // Listen for domain events to push over WebSocket
    this.deps.eventBus.on('TaskCompleted', (event) => {
      this.broadcast({ type: 'task_updated', data: (event as any).payload });
    });
    this.deps.eventBus.on('TaskFailed', (event) => {
      this.broadcast({ type: 'task_updated', data: (event as any).payload });
    });
    this.deps.eventBus.on('EscalationCreated', async (event) => {
      const payload = (event as any).payload as { escalationId: string; taskId: string };
      this.broadcast({ type: 'escalation_created', data: payload });
    });
  }

  private registerRoutes(): void {
    this.addRoute('GET', '/api/health', async () => {
      const health = await this.deps.getHealth();
      return Response.json(health);
    });

    this.addRoute('GET', '/api/agents', async () => {
      const result = await this.deps.listAgents();
      return Response.json(result);
    });

    this.addRoute('PUT', '/api/agents/:id', async (req, params) => {
      const body = await req.json() as Record<string, unknown>;
      const agent = await this.deps.updateAgent(params.id, body);
      if (!agent) return Response.json({ error: 'Agent not found' }, { status: 404 });
      return Response.json({ agent });
    });

    this.addRoute('DELETE', '/api/agents/:id', async (_req, params) => {
      const success = await this.deps.deactivateAgent(params.id);
      if (!success) return Response.json({ error: 'Agent not found' }, { status: 404 });
      return Response.json({ success: true });
    });

    this.addRoute('GET', '/api/tasks', async (req) => {
      const url = new URL(req.url);
      const filters: Record<string, string> = {};
      for (const [k, v] of url.searchParams.entries()) {
        filters[k] = v;
      }
      const tasks = await this.deps.listTasks(filters);
      return Response.json({ tasks, total: Array.isArray(tasks) ? tasks.length : 0 });
    });

    this.addRoute('POST', '/api/tasks', async (req) => {
      const body = await req.json() as Record<string, unknown>;
      const task = await this.deps.createTask(body);
      return Response.json({ task }, { status: 201 });
    });

    this.addRoute('GET', '/api/tasks/:id', async (_req, params) => {
      const task = await this.deps.getTaskById(params.id);
      if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });
      return Response.json({ task });
    });

    this.addRoute('GET', '/api/approvals', async () => {
      const escalations = await this.deps.getPendingEscalations();
      return Response.json({ escalations });
    });

    this.addRoute('POST', '/api/approvals/:id/approve', async (_req, params) => {
      try {
        const result = await this.deps.approveEscalation(params.id);
        return Response.json({ success: true, escalation: result });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return Response.json({ success: false, error: message }, { status: 400 });
      }
    });

    this.addRoute('POST', '/api/approvals/:id/reject', async (_req, params) => {
      try {
        const result = await this.deps.rejectEscalation(params.id);
        return Response.json({ success: true, escalation: result });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return Response.json({ success: false, error: message }, { status: 400 });
      }
    });

    this.addRoute('GET', '/api/metrics/improvement', async () => {
      const metrics = await this.deps.getImprovementMetrics();
      return Response.json(metrics);
    });

    this.addRoute('GET', '/api/budget', async () => {
      const budget = await this.deps.getBudgetUtilization();
      return Response.json(budget);
    });

    this.addRoute('GET', '/api/settings/thresholds', async () => {
      const thresholds = this.deps.getThresholds();
      return Response.json({ thresholds });
    });

    this.addRoute('PUT', '/api/settings/thresholds', async (req) => {
      const body = await req.json() as Record<string, unknown>;
      await this.deps.setThreshold(body);
      return Response.json({ success: true });
    });

    // Pipeline routes
    this.addRoute('POST', '/api/pipelines', async (req) => {
      const body = await req.json() as Record<string, unknown>;
      const pipeline = await this.deps.createPipeline(body);
      return Response.json(pipeline, { status: 201 });
    });

    this.addRoute('GET', '/api/pipelines', async () => {
      const pipelines = await this.deps.listPipelines();
      return Response.json({ pipelines });
    });

    this.addRoute('GET', '/api/pipelines/:id', async (_req, params) => {
      const pipeline = await this.deps.getPipelineById(params.id);
      if (!pipeline) return Response.json({ error: 'Pipeline not found' }, { status: 404 });
      return Response.json(pipeline);
    });

    this.addRoute('POST', '/api/pipelines/:id/advance', async (_req, params) => {
      const result = await this.deps.advancePipeline(params.id);
      return Response.json(result);
    });

    // Auth routes
    this.addRoute('POST', '/api/auth/login', async (req) => {
      try {
        const body = await req.json() as Record<string, string>;
        const { username, password } = body;

        const validUser = process.env.AUTH_USERNAME;
        const validPass = process.env.AUTH_PASSWORD;

        if (!validUser || !validPass) {
          return Response.json({ error: 'Authentication not configured' }, { status: 503 });
        }

        if (username !== validUser || password !== validPass) {
          return Response.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const userId = createHash('sha256').update(username).digest('hex').slice(0, 16);
        const accessToken = generateAccessToken(userId, 'admin');
        const refreshResult = generateRefreshToken(userId, 'admin');
        const refreshTtl = parseInt(process.env.JWT_REFRESH_EXPIRY ?? '604800', 10);
        storeRefreshToken(refreshResult.jti, userId, 'admin', refreshTtl);

        return Response.json({
          accessToken,
          refreshToken: refreshResult.token,
          expiresIn: parseInt(process.env.JWT_ACCESS_EXPIRY ?? '900', 10),
          tokenType: 'Bearer',
        });
      } catch {
        return Response.json({ error: 'Invalid request body' }, { status: 400 });
      }
    });

    this.addRoute('POST', '/api/auth/refresh', async (req) => {
      try {
        const body = await req.json() as Record<string, string>;
        const { refreshToken } = body;
        if (!refreshToken) {
          return Response.json({ error: 'Refresh token required' }, { status: 400 });
        }

        const payload = verifyToken(refreshToken);
        if (!payload || payload.type !== 'refresh' || !payload.jti) {
          return Response.json({ error: 'Invalid refresh token' }, { status: 401 });
        }

        const consumed = consumeRefreshToken(payload.jti);
        if (!consumed) {
          return Response.json({ error: 'Refresh token revoked or expired' }, { status: 401 });
        }

        const accessToken = generateAccessToken(consumed.userId, consumed.role);
        const refreshResult = generateRefreshToken(consumed.userId, consumed.role);
        const refreshTtl = parseInt(process.env.JWT_REFRESH_EXPIRY ?? '604800', 10);
        storeRefreshToken(refreshResult.jti, consumed.userId, consumed.role, refreshTtl);

        return Response.json({
          accessToken,
          refreshToken: refreshResult.token,
          expiresIn: parseInt(process.env.JWT_ACCESS_EXPIRY ?? '900', 10),
          tokenType: 'Bearer',
        });
      } catch {
        return Response.json({ error: 'Invalid request body' }, { status: 400 });
      }
    });

    this.addRoute('GET', '/api/auth/me', async (_req) => {
      const header = _req.headers.get('authorization');
      if (!header?.startsWith('Bearer ')) {
        return Response.json({ error: 'Not authenticated' }, { status: 401 });
      }
      const payload = verifyToken(header.slice(7));
      if (!payload) {
        return Response.json({ error: 'Invalid token' }, { status: 401 });
      }
      return Response.json({ userId: payload.sub, role: payload.role, expiresAt: new Date(payload.exp * 1000).toISOString() });
    });

    // Telegram webhook
    this.addRoute('POST', '/api/telegram/webhook', async (req) => {
      try {
        // Verify Telegram secret token header
        const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
        if (webhookSecret) {
          const headerToken = req.headers.get('x-telegram-bot-api-secret-token');
          if (headerToken !== webhookSecret) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
          }
        }
        const body = await req.json();
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const pool = this.deps.pool;
        if (token && pool) {
          const { createTelegramWebhookHandler } = await import('../chat/telegram-webhook.js');
          const handler = createTelegramWebhookHandler({ botToken: token, pool });
          await handler.handleWebhook(body);
        }
        return Response.json({ ok: true });
      } catch (err) {
        console.error('[API] Telegram webhook error:', err);
        return Response.json({ ok: true });
      }
    });
  }

  mount(prefix: string, router: { routes: Array<{ method: string; pattern: RegExp; paramNames: string[]; handler: RouteHandler }> }): void {
    for (const route of router.routes) {
      const source = route.pattern.source.replace(/^\^/, '').replace(/\$$/, '');
      this.routes.push({
        method: route.method,
        pattern: new RegExp(`^${prefix}${source}$`),
        paramNames: route.paramNames,
        handler: route.handler,
      });
    }
  }

  private addRoute(method: string, path: string, handler: RouteHandler): void {
    const paramNames: string[] = [];
    const pattern = path.replace(/:([^/]+)/g, (_match, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    this.routes.push({
      method,
      pattern: new RegExp(`^${pattern}$`),
      paramNames,
      handler,
    });
  }

  async handleRequest(request: Request): Promise<Response> {
    const correlationId = randomUUID();
    request.correlationId = correlationId;

    // Auth check (before logging middleware)
    const authResult = authenticateRequest(request);
    if (!authResult.authenticated) {
      return new Response(JSON.stringify({ error: authResult.error ?? 'Unauthorized' }), {
        status: 401,
        headers: { 'WWW-Authenticate': 'Bearer', 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    return this.loggerMiddleware(request, async (req) => {
      const url = new URL(req.url);
      const path = url.pathname;

      for (const route of this.routes) {
        if (route.method !== req.method) continue;
        const match = path.match(route.pattern);
        if (!match) continue;

        const params: Record<string, string> = {};
        for (let i = 0; i < route.paramNames.length; i++) {
          params[route.paramNames[i]] = match[i + 1];
        }

        try {
          const response = await route.handler(req, params);
          return this.caseMiddleware(req, async () => response);
        } catch (err) {
          return this.errorMiddleware(err, correlationId);
        }
      }

      return Response.json({ error: 'Not found' }, { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    });
  }

  addWsClient(client: { send: (msg: string) => void }): void {
    this.wsClients.add(client);
  }

  removeWsClient(client: { send: (msg: string) => void }): void {
    this.wsClients.delete(client);
  }

  broadcast(message: WebSocketMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.wsClients) {
      try {
        client.send(data);
      } catch {
        this.wsClients.delete(client);
      }
    }
  }
}
