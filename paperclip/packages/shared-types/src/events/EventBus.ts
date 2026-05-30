export interface DomainEvent {
  type: string;
  payload: unknown;
  timestamp: Date;
  correlationId: string;
}

export type TaskCompleted = DomainEvent & {
  type: 'TaskCompleted';
  payload: { taskId: string; agentId: string; result: unknown };
};

export type TaskFailed = DomainEvent & {
  type: 'TaskFailed';
  payload: { taskId: string; agentId: string; error: string };
};

export type TaskTimedOut = DomainEvent & {
  type: 'TaskTimedOut';
  payload: { taskId: string; agentId: string };
};

export type EscalationCreated = DomainEvent & {
  type: 'EscalationCreated';
  payload: { escalationId: string; taskId: string };
};

export type SkillGenerated = DomainEvent & {
  type: 'SkillGenerated';
  payload: { skillId: string; agentId: string };
};

export type SkillApplied = DomainEvent & {
  type: 'SkillApplied';
  payload: { skillId: string; taskId: string; success: boolean };
};

export type SkillDeprecated = DomainEvent & {
  type: 'SkillDeprecated';
  payload: { skillId: string; reason: string };
};

export type ExperienceCaptured = DomainEvent & {
  type: 'ExperienceCaptured';
  payload: { experienceId: string; agentId: string; taskId: string };
};

export type PipelineAdvanced = DomainEvent & {
  type: 'PipelineAdvanced';
  payload: { pipelineId: string; completedTaskId: string; nextTaskId?: string };
};

export type AppDomainEvent =
  | TaskCompleted
  | TaskFailed
  | TaskTimedOut
  | EscalationCreated
  | SkillGenerated
  | SkillApplied
  | SkillDeprecated
  | ExperienceCaptured
  | PipelineAdvanced
  | { type: 'DealCreated'; dealId: string; customerId: string }
  | { type: 'DealStageChanged'; dealId: string; fromStage: string; toStage: string }
  | { type: 'DocumentGenerated'; documentId: string; templateId: string }
  | { type: 'EmailSynced'; emailId: string; dealId?: string }
  | { type: 'EmailSent'; emailId: string; dealId?: string };

export interface EventBus {
  emit(event: AppDomainEvent): void;
  on<T extends AppDomainEvent>(
    eventType: T['type'],
    handler: (event: T) => void,
  ): void;
  off<T extends AppDomainEvent>(
    eventType: T['type'],
    handler: (event: T) => void,
  ): void;
}
