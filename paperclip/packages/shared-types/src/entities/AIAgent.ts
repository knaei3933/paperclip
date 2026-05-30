export type AgentStatus = 'idle' | 'running' | 'error';

export interface AIAgent {
  id: string;
  name: string;
  role: string;
  departmentId: string;
  skills: string[];
  budgetLimit: number;
  workspaceId: string;
  status: AgentStatus;
}
