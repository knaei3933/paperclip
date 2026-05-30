import type { Task } from '@paperclip/shared-types';
import { BaseAgentAdapter } from '../base-adapter.js';
import type { AdapterContext, AdapterResult, AdapterStatus } from '../base-adapter.js';
import { exec, type ExecException } from 'child_process';

export interface GenericCliConfig {
  /** Command template. Use {{task}} as placeholder for task description. */
  commandTemplate: string;
  timeoutMs?: number;
}

export class GenericCliAdapter extends BaseAgentAdapter {
  private static readonly SHELL_METACHAR_REGEX = /[;&|`$(){}[\]><!#~]/;
  private static readonly DANGEROUS_PATTERNS = /\$\(|`|&&|\|\||>/;

  readonly adapterType: string;
  private config: GenericCliConfig;
  private status: AdapterStatus = 'idle';

  constructor(adapterType: string, config: GenericCliConfig) {
    super();
    this.adapterType = adapterType;
    this.config = config;
    if (GenericCliAdapter.DANGEROUS_PATTERNS.test(config.commandTemplate)) {
      throw new Error(`Command template contains shell metacharacters: ${config.commandTemplate}`);
    }
  }

  async execute(task: Task, context: AdapterContext): Promise<AdapterResult> {
    this.status = 'busy';
    const start = Date.now();

    const prompt = context.enrichedPrompt ?? task.description;
    if (GenericCliAdapter.SHELL_METACHAR_REGEX.test(prompt)) {
      this.status = 'idle';
      return {
        success: false,
        output: '',
        error: 'Task description contains disallowed characters',
        latencyMs: Date.now() - start,
        metadata: { exitCode: 1 },
      };
    }
    const command = this.config.commandTemplate.replace(/\{\{task\}\}/g, prompt.replace(/"/g, '\\"'));
    const timeoutMs = this.config.timeoutMs ?? 60_000;

    return new Promise<AdapterResult>((resolve) => {
      exec(command, { timeout: timeoutMs }, (error: ExecException | null, stdout: string, stderr: string) => {
        this.status = 'idle';
        const latencyMs = Date.now() - start;

        if (error) {
          resolve({
            success: false,
            output: stdout,
            error: stderr || error.message,
            latencyMs,
            metadata: { exitCode: error.code ?? 1 },
          });
          return;
        }

        resolve({
          success: true,
          output: stdout.trim(),
          latencyMs,
        });
      });
    });
  }

  getStatus(): AdapterStatus {
    return this.status;
  }

  async cancel(_taskId: string): Promise<void> {
    this.status = 'idle';
  }

  getCapabilities(): string[] {
    return ['shell-execution'];
  }
}
