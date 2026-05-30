import type { Task } from '@paperclip/shared-types';
import { BaseAgentAdapter, } from '../base-adapter.js';
import type { AdapterContext, AdapterResult, AdapterStatus } from '../base-adapter.js';
import { spawn } from 'child_process';

export interface ClaudeCodeConfig {
  command?: string;
  outputFormat?: string;
  timeoutMs?: number;
  cwd?: string;
}

interface ResolvedConfig {
  command: string;
  outputFormat: string;
  timeoutMs: number;
  cwd: string | undefined;
}

const DEFAULT_CONFIG: ResolvedConfig = {
  command: 'claude',
  outputFormat: 'json',
  timeoutMs: 10 * 60 * 1_000, // 10 minutes
  cwd: undefined,
};

export class ClaudeCodeAdapter extends BaseAgentAdapter {
  readonly adapterType = 'claude-code';
  private config: ResolvedConfig;
  private status: AdapterStatus = 'idle';
  private activeProcess: ReturnType<typeof spawn> | null = null;

  constructor(config?: ClaudeCodeConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async execute(task: Task, context: AdapterContext): Promise<AdapterResult> {
    this.status = 'busy';
    const start = Date.now();

    const prompt = context.enrichedPrompt ?? task.description;

    return new Promise<AdapterResult>((resolve) => {
      const args = [
        '--output-format', this.config.outputFormat,
        '-p', prompt,
      ];

      const proc = spawn(this.config.command, args, {
        cwd: this.config.cwd || process.env.VAULT_ROOT_PATH,
        timeout: this.config.timeoutMs,
        shell: true,
      });
      this.activeProcess = proc;

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code: number | null) => {
        this.activeProcess = null;
        this.status = 'idle';
        const latencyMs = Date.now() - start;

        if (code !== 0) {
          resolve({
            success: false,
            output: '',
            error: stderr || `Process exited with code ${code}`,
            latencyMs,
            metadata: { exitCode: code },
          });
          return;
        }

        try {
          const parsed = JSON.parse(stdout);
          const result = parsed as { result?: string; usage?: { input_tokens?: number; output_tokens?: number } };
          resolve({
            success: true,
            output: result.result ?? stdout,
            tokenUsage: {
              prompt: result.usage?.input_tokens ?? 0,
              completion: result.usage?.output_tokens ?? 0,
              total: (result.usage?.input_tokens ?? 0) + (result.usage?.output_tokens ?? 0),
            },
            latencyMs,
            metadata: { rawResponse: parsed },
          });
        } catch {
          // Non-JSON output — return raw
          resolve({
            success: true,
            output: stdout,
            latencyMs,
          });
        }
      });

      proc.on('error', (err) => {
        this.activeProcess = null;
        this.status = 'error';
        resolve({
          success: false,
          output: '',
          error: err.message,
          latencyMs: Date.now() - start,
        });
      });
    });
  }

  getStatus(): AdapterStatus {
    return this.status;
  }

  async cancel(taskId: string): Promise<void> {
    if (this.activeProcess) {
      this.activeProcess.kill('SIGTERM');
      this.activeProcess = null;
    }
    this.status = 'idle';
  }

  getCapabilities(): string[] {
    return ['code-generation', 'code-analysis', 'tool-use', 'structured-output'];
  }
}
