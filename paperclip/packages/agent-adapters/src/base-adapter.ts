import type { Task, AdapterContext } from '@paperclip/shared-types';

export type { AdapterContext };

export type AdapterStatus = 'idle' | 'busy' | 'error';

export interface AdapterResult {
  success: boolean;
  output: string;
  error?: string;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  latencyMs: number;
  metadata?: Record<string, unknown>;
}

export abstract class BaseAgentAdapter {
  abstract readonly adapterType: string;
  abstract execute(task: Task, context: AdapterContext): Promise<AdapterResult>;
  abstract getStatus(): AdapterStatus;
  abstract cancel(taskId: string): Promise<void>;
  abstract getCapabilities(): string[];
}
