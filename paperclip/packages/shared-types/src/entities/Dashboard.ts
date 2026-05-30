export interface AgentStatusEntry {
  agentId: string;
  name: string;
  status: string;
  currentTaskId: string | null;
  lastHeartbeat: Date;
}

export interface TaskProgressEntry {
  taskId: string;
  title: string;
  status: string;
  progress: number;
  assigneeId: string;
}

export interface DashboardMetric {
  key: string;
  value: number;
  unit: string;
  updatedAt: Date;
}

export interface Dashboard {
  id: string;
  companyId: string;
  agentStatuses: AgentStatusEntry[];
  taskProgress: TaskProgressEntry[];
  metrics: DashboardMetric[];
}
