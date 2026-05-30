import 'dotenv/config';
import { getPool, closePool, createEventBus } from '@paperclip/core';
import { getOrCreateCEO, listAgentsByDepartment } from '@paperclip/core';
import { HeartbeatEngine } from '@paperclip/core';
import { registerAdapter, clearAdapters } from '@paperclip/core';
import { setEscalationEventBus, setEscalationPool } from '@paperclip/core';
import { setMasterKey } from '@paperclip/core';
import { createTask, getTasks, getTaskById, transitionStatus } from '@paperclip/core';
import { CronRoutineScheduler } from '@paperclip/core';
import { LearningCoordinator } from '@paperclip/learning';
import { ClaudeCodeAdapter, GenericCliAdapter } from '@paperclip/agent-adapters';
import { createGateway } from '@paperclip/gateway';
import type { EventBus } from '@paperclip/shared-types';

const PORT = parseInt(process.env.PORT ?? '3100', 10);
const DB_URL = process.env.DATABASE_URL ?? 'postgres://paperclip:paperclip@localhost:5432/paperclip';

let httpServer: import('node:http').Server | null = null;
let heartbeat: HeartbeatEngine | null = null;
let learningCoordinator: LearningCoordinator | null = null;
let gateway: ReturnType<typeof createGateway> | null = null;
let cronScheduler: CronRoutineScheduler | null = null;
let wss: import('ws').WebSocketServer | null = null;
let wsHeartbeat: ReturnType<typeof setInterval> | null = null;

async function startup(): Promise<void> {
  console.log('[Main] Starting Paperclip Enterprise AI System...');

  // 1. Connect to PostgreSQL
  console.log('[Main] Connecting to PostgreSQL...');
  const pool = getPool();
  await pool.query('SELECT 1');
  console.log('[Main] PostgreSQL connected');

  const db = { pool };
  const eventBus: EventBus = createEventBus();

  // 2. Run migrations (execute SQL files directly)
  console.log('[Main] Running migrations...');
  try {
    const { readdir, readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const migrationDirs = [
      join(process.cwd(), 'packages', 'core', 'src', 'db', 'migrations'),
      join(process.cwd(), 'packages', 'trading', 'src', 'db', 'migrations'),
    ];
    const fileEntries: Array<{ dir: string; name: string }> = [];
    for (const dir of migrationDirs) {
      const files = await readdir(dir).catch(() => [] as string[]);
      for (const f of files.filter(f => f.endsWith('.sql'))) {
        fileEntries.push({ dir, name: f });
      }
    }
    fileEntries.sort((a, b) => a.name.localeCompare(b.name));

    // Idempotent migration tracking
    await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);

    for (const entry of fileEntries) {
      const already = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [entry.name]);
      if (already.rows.length > 0) {
        console.log(`[Main] Skipping already-applied migration: ${entry.name}`);
        continue;
      }
      const sql = await readFile(join(entry.dir, entry.name), 'utf-8');
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [entry.name]);
      console.log(`[Main] Applied migration: ${entry.name}`);
    }
    if (fileEntries.length === 0) {
      // Try schema.sql as fallback
      const schemaPath = join(process.cwd(), 'packages', 'core', 'src', 'db', 'schema.sql');
      const schema = await readFile(schemaPath, 'utf-8');
      await pool.query(schema);
      console.log('[Main] Applied schema.sql');
    }
    console.log('[Main] Migrations complete');
  } catch (err) {
    console.warn('[Main] Migration warning (may already be up):', err instanceof Error ? err.message : err);
  }

  // 3. Seed default company + CEO if not exists
  console.log('[Main] Ensuring CEO exists...');
  await getOrCreateCEO(db);

  // 4. Register agent adapters
  console.log('[Main] Registering agent adapters...');
  clearAdapters();
  registerAdapter(new ClaudeCodeAdapter({ cwd: process.cwd() }));
  registerAdapter(new GenericCliAdapter('generic-cli', { commandTemplate: 'echo "{{task}}"' }));
  console.log('[Main] Adapters registered: claude-code (default), generic-cli');

  // 5. Start heartbeat engine
  console.log('[Main] Starting heartbeat engine...');
  heartbeat = new HeartbeatEngine(db, eventBus, {
    pollIntervalMs: 5_000,
    timeoutMs: 30 * 60 * 1_000,
    defaultAdapterType: 'claude-code',
  });
  await heartbeat.start();
  console.log('[Main] Heartbeat engine started');

  // 6. Start learning coordinator
  console.log('[Main] Starting learning coordinator...');
  learningCoordinator = new LearningCoordinator(db, eventBus);
  learningCoordinator.start();
  console.log('[Main] Learning coordinator started');

  // 7. Set up escalation DB pool
  setEscalationPool(pool);

  // 8. Start HTTP server (gateway API)
  console.log('[Main] Starting gateway...');

  // Telegram config from .env
  const telegramConfig = process.env.TELEGRAM_BOT_TOKEN
    ? { botToken: process.env.TELEGRAM_BOT_TOKEN, chatId: process.env.TELEGRAM_CHAT_ID ?? '' }
    : undefined;

  gateway = createGateway({
    port: PORT,
    eventBus,
    pool,
    telegram: telegramConfig,
    getHealth: async () => ({
      status: 'ok',
      adapters: {
        'claude-code': true,
        'generic-cli': true,
        telegram: gateway?.telegram?.isRunning() ?? false,
        slack: gateway?.slack?.isRunning() ?? false,
        discord: gateway?.discord?.isRunning() ?? false,
      },
    }),
    listAgents: async () => {
      const result = await pool.query('SELECT * FROM agents');
      return { agents: result.rows, total: result.rows.length };
    },
    listTasks: async (filters?: Record<string, unknown>) => {
      const status = filters?.status as string | undefined;
      const query = status
        ? 'SELECT * FROM tasks WHERE status = $1 ORDER BY priority DESC, created_at ASC'
        : 'SELECT * FROM tasks ORDER BY priority DESC, created_at ASC';
      const result = status ? await pool.query(query, [status]) : await pool.query(query);
      return result.rows;
    },
    createTask: async (data: Record<string, unknown>) => {
      const result = await pool.query(
        'INSERT INTO tasks (id, title, description, status, priority, budget_allocated, budget_used, retry_count, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 0, 0, NOW(), NOW()) RETURNING *',
        [data.title, data.description ?? '', 'queued', data.priority ?? 5, data.budget ?? 10]
      );
      return result.rows[0];
    },
    getApprovals: async () => {
      const result = await pool.query("SELECT * FROM escalation_requests WHERE status = 'pending'");
      return result.rows;
    },
    approveEscalation: async (id: string) => {
      await pool.query("UPDATE escalation_requests SET status = 'approved', resolved_at = NOW() WHERE id = $1", [id]);
    },
    rejectEscalation: async (id: string) => {
      await pool.query("UPDATE escalation_requests SET status = 'rejected', resolved_at = NOW() WHERE id = $1", [id]);
    },
    getImprovementMetrics: async () => {
      const result = await pool.query('SELECT * FROM self_improvement_history ORDER BY recorded_at DESC LIMIT 50');
      return result.rows;
    },
    getBudgetUtilization: async () => {
      const result = await pool.query('SELECT * FROM budgets');
      return result.rows;
    },
    getThresholds: async () => {
      const result = await pool.query('SELECT * FROM approval_thresholds');
      return result.rows;
    },
    updateThresholds: async (data: Record<string, unknown>) => {
      // Simple upsert
      return data;
    },
  });

  // Mount trading API router
  const { TradingApiRouter } = await import('@paperclip/trading');
  const tradingRouter = new TradingApiRouter(pool);
  gateway.apiServer.mount('/api/trading', tradingRouter);
  console.log('[Main] Trading API router mounted at /api/trading');

  // Start chat bots independently
  await gateway.start();

  // Subscribe router to task events for Telegram notification
  gateway.router.subscribeToEvents(eventBus);

  // Start CronRoutineScheduler
  console.log('[Main] Starting cron routine scheduler...');
  cronScheduler = new CronRoutineScheduler(pool);
  await cronScheduler.start();
  console.log('[Main] Cron routine scheduler started');

  // Start HTTP server using Node http module
  const { createServer } = await import('node:http');
  const apiServer = gateway.apiServer;

  // Determine dashboard static files path
  const path = await import('node:path');
  const dashboardDistPath = path.resolve(process.cwd(), 'packages/dashboard/dist-spa');

  const { readFile, stat } = await import('node:fs/promises');

  // Create MCP handler once so SSE sessions persist across requests
  let mcpHandler: ((req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void) | null = null;
  if (process.env.MCP_ENABLED === 'true') {
    const { handleMcpRequest } = await import('@paperclip/gateway');
    mcpHandler = handleMcpRequest(pool);
  }

  httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const pathname = url.pathname;

    // MCP SSE routes (has its own JWT auth)
    if (mcpHandler && pathname.startsWith('/mcp/')) {
      return mcpHandler(req, res);
    }

    // API routes
    if (pathname.startsWith('/api')) {
      try {
        const webHeaders = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (value) webHeaders.set(key, Array.isArray(value) ? value[0] : value);
        }
        const webRequest = new Request(`http://localhost:${PORT}${pathname}${url.search}`, {
          method: req.method,
          headers: webHeaders,
          body: req.method !== 'GET' && req.method !== 'HEAD' ? await readBody(req) : undefined,
        });
        const webResponse = await apiServer.handleRequest(webRequest);
        res.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()));
        const body = await webResponse.arrayBuffer();
        res.end(Buffer.from(body));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
      return;
    }

    // Dashboard static files
    try {
      let filePath = path.join(dashboardDistPath, pathname === '/' ? 'index.html' : pathname);
      const exists = await stat(filePath).catch(() => null);
      if (exists && exists.isFile()) {
        const content = await readFile(filePath);
        const ext = path.extname(filePath);
        const mimeTypes: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] ?? 'application/octet-stream' });
        res.end(content);
        return;
      }
      // SPA fallback: serve index.html for unknown non-API routes
      const indexContent = await readFile(path.join(dashboardDistPath, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(indexContent);
    } catch {
      // No dashboard built — serve minimal status page
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Paperclip System Running</h1><p>Dashboard not built. API available at /api/*</p></body></html>');
    }
  });

  // WebSocket server
  const { WebSocketServer: WSServer } = await import('ws');
  wss = new WSServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    console.log(`[WS] Upgrade request: ${req.url}`);
    const wsUrl = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    if (wsUrl.pathname === '/ws') {
      // WebSocket auth: validate token from query param
      const authToken = process.env.API_AUTH_TOKEN;
      if (authToken) {
        const token = wsUrl.searchParams.get('token');
        if (token !== authToken) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
      }
      wss!.handleUpgrade(req, socket, head, (ws) => {
        console.log('[WS] Client connected');
        apiServer.addWsClient(ws);
        ws.on('close', () => {
          console.log('[WS] Client disconnected');
          apiServer.removeWsClient(ws);
        });
        ws.on('ping', () => ws.pong());
      });
    } else {
      socket.destroy();
    }
  });

  // Heartbeat: detect dead connections every 30s
  wsHeartbeat = setInterval(() => {
    for (const client of wss!.clients) {
      if ((client as any).isAlive === false) {
        console.log('[WS] Terminating dead connection');
        apiServer.removeWsClient(client);
        client.terminate();
      }
      (client as any).isAlive = false;
      client.ping();
    }
  }, 30_000);

  wss.on('connection', (ws) => {
    (ws as any).isAlive = true;
    ws.on('pong', () => { (ws as any).isAlive = true; });
    // Browser WebSocket doesn't respond to ping frames — keep alive via message
    ws.on('message', () => { (ws as any).isAlive = true; });
  });

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Main] Port ${PORT} is already in use. Exiting.`);
      process.exit(1);
    }
    throw err;
  });

  httpServer.listen(PORT, () => {
    console.log(`[Main] HTTP server listening on port ${PORT}`);
    console.log(`[Main] WebSocket server ready at ws://localhost:${PORT}/ws`);
  });

  // 8. Set up escalation event bus
  setEscalationEventBus(eventBus);

  // 9. Set up secrets master key
  const masterKey = process.env.SECRETS_MASTER_KEY;
  if (masterKey) {
    setMasterKey(masterKey);
  }

  // 10. Log startup summary
  console.log('[Main] ==========================================');
  console.log('[Main] Paperclip Enterprise AI System is running');
  console.log(`[Main] HTTP: http://localhost:${PORT}`);
  console.log(`[Main] API: http://localhost:${PORT}/api/health`);
  console.log(`[Main] Telegram: ${gateway.telegram ? (gateway.telegram.isRunning() ? 'connected' : 'failed') : 'not configured'}`);
  console.log(`[Main] Slack: ${gateway.slack ? (gateway.slack.isRunning() ? 'connected' : 'failed') : 'not configured'}`);
  console.log(`[Main] Discord: ${gateway.discord ? (gateway.discord.isRunning() ? 'connected' : 'failed') : 'not configured'}`);
  console.log('[Main] ==========================================');
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function shutdown(): Promise<void> {
  console.log('[Main] Shutting down gracefully...');

  if (wsHeartbeat) {
    clearInterval(wsHeartbeat);
  }

  if (wss) {
    wss.close();
    console.log('[Main] WebSocket server closed');
  }

  if (heartbeat) {
    await heartbeat.stop();
    console.log('[Main] Heartbeat stopped');
  }

  if (gateway) {
    await gateway.stop();
    console.log('[Main] Gateway stopped');
  }

  if (cronScheduler) {
    await cronScheduler.stop();
    console.log('[Main] Cron scheduler stopped');
  }

  await closePool();
  console.log('[Main] Database pool closed');

  console.log('[Main] Goodbye');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startup().catch((err) => {
  console.error('[Main] Fatal startup error:', err);
  process.exit(1);
});
