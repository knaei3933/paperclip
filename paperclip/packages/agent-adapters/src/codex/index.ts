import type { Task } from '@paperclip/shared-types';
import { BaseAgentAdapter } from '../base-adapter.js';
import type { AdapterContext, AdapterResult, AdapterStatus } from '../base-adapter.js';

export class CodexAdapter extends BaseAgentAdapter {
  readonly adapterType = 'codex';

  async execute(_task: Task, _context: AdapterContext): Promise<AdapterResult> {
    throw new Error('Not implemented: CodexAdapter is a placeholder for future implementation');
  }

  getStatus(): AdapterStatus {
    return 'idle';
  }

  async cancel(_taskId: string): Promise<void> {
    throw new Error('Not implemented: CodexAdapter is a placeholder for future implementation');
  }

  getCapabilities(): string[] {
    return [];
  }
}
