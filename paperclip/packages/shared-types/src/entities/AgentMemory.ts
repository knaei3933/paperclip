export interface Experience {
  id: string;
  taskId: string;
  outcome: 'success' | 'failure' | 'partial';
  lessons: string[];
  timestamp: Date;
}

export interface LearnedSkill {
  id: string;
  name: string;
  description: string;
  applicableContexts: string[];
  successRate: number;
  createdAt: Date;
  deprecatedAt: Date | null;
}

export interface PerformanceMetrics {
  period: string;
  tasksCompleted: number;
  tasksFailed: number;
  averageDurationMs: number;
  budgetEfficiency: number;
}

export interface AgentMemory {
  id: string;
  agentId: string;
  experiences: Experience[];
  learnedSkills: LearnedSkill[];
  performanceMetrics: PerformanceMetrics[];
}
