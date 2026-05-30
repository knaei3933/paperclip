// Entities
export type { HumanDecisionMaker, ApprovalThreshold } from './entities/HumanDecisionMaker.js';
export type { AIAgent, AgentStatus } from './entities/AIAgent.js';
export type { Company } from './entities/Company.js';
export type { Department } from './entities/Department.js';
export type { Task, TaskStatus } from './entities/Task.js';
export type { EscalationRequest, EscalationStatus, EscalationUrgency } from './entities/EscalationRequest.js';
export type { AgentMemory, Experience, LearnedSkill, PerformanceMetrics } from './entities/AgentMemory.js';
export type { SelfImprovement, MetricsSnapshot, SkillUpdate } from './entities/SelfImprovement.js';
export type { Dashboard, AgentStatusEntry, TaskProgressEntry, DashboardMetric } from './entities/Dashboard.js';
export type { MultiChannel, PlatformConfig, ActiveConnection } from './entities/MultiChannel.js';
export type { Workspace } from './entities/Workspace.js';
export type { Budget } from './entities/Budget.js';
export type { AdapterContext } from './entities/AdapterContext.js';

// Events
export type {
  DomainEvent,
  TaskCompleted,
  TaskFailed,
  TaskTimedOut,
  EscalationCreated,
  SkillGenerated,
  SkillApplied,
  SkillDeprecated,
  ExperienceCaptured,
  PipelineAdvanced,
  AppDomainEvent,
  EventBus,
} from './events/EventBus.js';

// Utils
export { snakeToCamel } from './utils/transform.js';
export { detectMojibake, validateText, validateRecordTexts } from './utils/text-validation.js';
export type { TextValidationResult } from './utils/text-validation.js';

// API
export type {
  TaskCreateRequest,
  TaskCreateResponse,
  TaskListResponse,
  ApprovalActionRequest,
  ApprovalActionResponse,
  AgentListResponse,
} from './api/ApiTypes.js';
