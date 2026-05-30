import type { EventBus, ApprovalThreshold, EscalationRequest } from '@paperclip/shared-types';
import type { CreatePipelineInput } from '@paperclip/core';
import {
  getThresholds,
  setThreshold,
  resetThresholds,
  approveEscalation,
  rejectEscalation,
  getPendingEscalations as getPending,
  setEscalationEventBus,
  createPipeline as coreCreatePipeline,
  listPipelines as coreListPipelines,
  getPipeline as coreGetPipeline,
  advancePipeline as coreAdvancePipeline,
} from '@paperclip/core';
import { TelegramAdapter } from './chat/telegram-adapter.js';
import { SlackAdapter } from './chat/slack-adapter.js';
import { DiscordAdapter } from './chat/discord-adapter.js';
import { EscalationRouter } from './escalation/escalation-router.js';
import { ApiServer } from './api/api-server.js';

export { TelegramAdapter } from './chat/telegram-adapter.js';
export type { TelegramConfig } from './chat/telegram-adapter.js';
export { SlackAdapter } from './chat/slack-adapter.js';
export type { SlackConfig } from './chat/slack-adapter.js';
export { DiscordAdapter } from './chat/discord-adapter.js';
export type { DiscordConfig } from './chat/discord-adapter.js';
export { EscalationRouter } from './escalation/escalation-router.js';
export { ApiServer } from './api/api-server.js';
export type { ApiServerDeps, WebSocketMessage } from './api/api-server.js';
export { requestLogger } from './api/middleware/request-logger.js';
export type { RequestLogEntry, RequestLogFn } from './api/middleware/request-logger.js';
export { errorHandler } from './api/middleware/error-handler.js';
export type { ErrorResponseBody, ErrorHandlerOptions } from './api/middleware/error-handler.js';
export { authenticateRequest, isPublicPath } from './api/auth/auth-middleware.js';
export { signToken, verifyToken, generateAccessToken, generateRefreshToken } from './api/auth/jwt.js';
export type { JwtPayload } from './api/auth/jwt.js';
export { createMcpServer, handleMcpRequest } from './mcp/index.js';

export interface GatewayConfig {
  port?: number;
  telegram?: { botToken: string; chatId: string };
  slack?: { botToken: string; channelId: string };
  discord?: { botToken: string; channelId: string };
  eventBus: EventBus;
  pool?: import('pg').Pool;
  getHealth?: () => Promise<{ status: string; adapters: Record<string, boolean> }>;
  listAgents?: () => Promise<{ agents: unknown[]; total: number }>;
  listTasks?: (filters?: Record<string, unknown>) => Promise<unknown[]>;
  createTask?: (input: Record<string, unknown>) => Promise<unknown>;
  getTaskById?: (id: string) => Promise<unknown | null>;
  getApprovals?: () => Promise<unknown[]>;
  approveEscalation?: (id: string) => Promise<unknown>;
  rejectEscalation?: (id: string) => Promise<unknown>;
  getImprovementMetrics?: () => Promise<unknown>;
  getBudgetUtilization?: () => Promise<unknown>;
  getThresholds?: () => Promise<unknown>;
  updateThresholds?: (data: Record<string, unknown>) => Promise<unknown>;
  updateAgent?: (id: string, data: Record<string, unknown>) => Promise<unknown | null>;
  deactivateAgent?: (id: string) => Promise<boolean>;
}

export interface Gateway {
  apiServer: ApiServer;
  router: EscalationRouter;
  telegram: TelegramAdapter | null;
  slack: SlackAdapter | null;
  discord: DiscordAdapter | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createGateway(config: GatewayConfig): Gateway {
  const eventBus = config.eventBus;
  setEscalationEventBus(eventBus);

  // Create chat adapters
  const telegram = config.telegram ? new TelegramAdapter(config.telegram) : null;
  const slack = config.slack ? new SlackAdapter(config.slack) : null;
  const discord = config.discord ? new DiscordAdapter(config.discord) : null;

  // Create escalation router
  const router = new EscalationRouter();
  router.setAdapters({ telegram, slack, discord });

  // Create API server
  const apiServer = new ApiServer({
    eventBus,
    getHealth: config.getHealth ?? (async () => ({
      status: 'ok',
      adapters: {
        telegram: telegram?.isRunning() ?? false,
        slack: slack?.isRunning() ?? false,
        discord: discord?.isRunning() ?? false,
      },
    })),
    listAgents: config.listAgents ?? (async () => ({ agents: [], total: 0 })),
    listTasks: config.listTasks ?? (async () => []),
    createTask: config.createTask ?? (async (input) => input),
    getTaskById: config.getTaskById ?? (async () => null),
    getPendingEscalations: async () => {
      return getPending();
    },
    approveEscalation: async (id: string) => approveEscalation(id),
    rejectEscalation: async (id: string) => rejectEscalation(id),
    getImprovementMetrics: config.getImprovementMetrics ?? (async () => ({})),
    getBudgetUtilization: config.getBudgetUtilization ?? (async () => ({})),
    getThresholds: () => getThresholds(),
    setThreshold: async (t: Record<string, unknown>) => setThreshold(t as unknown as ApprovalThreshold),
    routeEscalation: async (esc: unknown) => {
      return router.routeEscalation(esc as EscalationRequest);
    },
    createPipeline: config.pool
      ? async (input) => coreCreatePipeline(config.pool!, input as unknown as CreatePipelineInput)
      : async () => { throw new Error('Pool not configured'); },
    listPipelines: config.pool
      ? async () => coreListPipelines(config.pool!)
      : async () => [],
    getPipelineById: config.pool
      ? async (id: string) => coreGetPipeline(config.pool!, id)
      : async () => null,
    advancePipeline: config.pool
      ? async (id: string) => coreAdvancePipeline(config.pool!, id, '')
      : async () => ({ advanced: false }),
    updateAgent: config.updateAgent ?? (async () => null),
    deactivateAgent: config.deactivateAgent ?? (async () => false),
  });

  return {
    apiServer,
    router,
    telegram,
    slack,
    discord,
    async start(): Promise<void> {
      // Start each chat adapter independently - failure does not crash system
      if (telegram) {
        try {
          await telegram.start();
          console.log('[Gateway] Telegram adapter started');
        } catch (err) {
          console.error('[Gateway] Failed to start Telegram adapter:', err);
        }
      }

      if (slack) {
        try {
          await slack.start();
          console.log('[Gateway] Slack adapter started');
        } catch (err) {
          console.error('[Gateway] Failed to start Slack adapter:', err);
        }
      }

      if (discord) {
        try {
          await discord.start();
          console.log('[Gateway] Discord adapter started');
        } catch (err) {
          console.error('[Gateway] Failed to start Discord adapter:', err);
        }
      }

      console.log(`[Gateway] API server ready (adapters: ${router.getActiveChannels().join(', ') || 'none'})`);
    },
    async stop(): Promise<void> {
      if (telegram) {
        try { await telegram.stop(); } catch { /* ignore */ }
      }
      if (slack) {
        try { await slack.stop(); } catch { /* ignore */ }
      }
      if (discord) {
        try { await discord.stop(); } catch { /* ignore */ }
      }
      resetThresholds();
      console.log('[Gateway] Stopped');
    },
  };
}
