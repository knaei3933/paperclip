import type { Task, TaskStatus } from '../entities/Task.js';
import type { AIAgent } from '../entities/AIAgent.js';

// Task API
export interface TaskCreateRequest {
  title: string;
  description: string;
  priority: number;
  budgetAllocated?: number;
  assigneeId?: string;
}

export interface TaskCreateResponse {
  task: Task;
}

export interface TaskListResponse {
  tasks: Task[];
  total: number;
}

// Approval API
export interface ApprovalActionRequest {
  escalationId: string;
  action: 'approve' | 'reject';
  reason?: string;
}

export interface ApprovalActionResponse {
  success: boolean;
  escalationId: string;
  newStatus: string;
}

// Agent API
export interface AgentListResponse {
  agents: AIAgent[];
  total: number;
}
