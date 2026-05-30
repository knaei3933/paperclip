// Base
export { BaseAgentAdapter } from './base-adapter.js';
export type { AdapterContext, AdapterResult, AdapterStatus } from './base-adapter.js';

// Claude Code adapter
export { ClaudeCodeAdapter } from './claude-code/claude-code-adapter.js';
export type { ClaudeCodeConfig } from './claude-code/claude-code-adapter.js';

// Generic CLI adapter
export { GenericCliAdapter } from './generic-cli/generic-cli-adapter.js';
export type { GenericCliConfig } from './generic-cli/generic-cli-adapter.js';

// Codex adapter (stub)
export { CodexAdapter } from './codex/index.js';
