export type AgentStatus = 'idle' | 'running' | 'error' | 'inactive';

export interface AIAgent {
  id: string;
  name: string;
  role: string;
  departmentId: string;
  skills: string[];
  budgetLimit: number;
  workspaceId: string;
  status: AgentStatus;
  capabilities: string;
  adapterType: string;
  adapterConfig: Record<string, unknown>;
  proactiveRoutines: unknown[];
}
