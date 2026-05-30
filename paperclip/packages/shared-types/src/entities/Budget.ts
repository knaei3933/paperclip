export interface Budget {
  id: string;
  agentId: string;
  taskId: string;
  limit: number;
  spent: number;
  remaining: number;
  currency: string;
}
