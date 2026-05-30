export interface MetricsSnapshot {
  timestamp: Date;
  accuracy: number;
  efficiency: number;
  taskCompletionRate: number;
}

export interface SkillUpdate {
  skillId: string;
  action: 'created' | 'updated' | 'deprecated';
  delta: Record<string, number>;
}

export interface SelfImprovement {
  id: string;
  agentId: string;
  cycleCount: number;
  metricsHistory: MetricsSnapshot[];
  skillUpdates: SkillUpdate[];
}
