export type TaskStatus =
  | 'queued'
  | 'assigned'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timed_out';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assigneeId: string;
  budgetAllocated: number;
  budgetUsed: number;
  priority: number;
  result: unknown;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}
