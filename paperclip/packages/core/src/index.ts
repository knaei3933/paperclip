// Database
export { getPool, query, closePool } from './db/connection.js';

// EventBus
export { InProcessEventBus, createEventBus, resetEventBus } from './event-bus/in-process-event-bus.js';

// Identity & Access
export {
  getOrCreateCEO,
  registerAgent,
  getAgentById,
  listAgentsByDepartment,
} from './identity/identity.service.js';
export type { RegisterAgentInput, DbPool as IdentityDbPool } from './identity/identity.service.js';

// Org Chart & Agents
export {
  createCompany,
  createDepartment,
  assignAgentToDepartment,
  getOrgChart,
} from './org-chart/org-chart.service.js';
export type { OrgChart, DbPool as OrgChartDbPool } from './org-chart/org-chart.service.js';

// Tasks
export {
  createTask,
  assignTask,
  transitionStatus,
  getTasks,
  getTaskById,
} from './tasks/task.service.js';
export type { TaskFilters, DbPool as TaskDbPool } from './tasks/task.service.js';

// Task State Machine
export {
  isValidTransition,
  getValidTransitions,
  isTerminalStatus,
  validateTransition,
  InvalidTransitionError,
} from './tasks/task-state-machine.js';

// Heartbeat Engine
export { HeartbeatEngine } from './heartbeat/heartbeat.engine.js';
export type { HeartbeatConfig, DbPool as HeartbeatDbPool } from './heartbeat/heartbeat.engine.js';

// Workspaces
export {
  createWorkspace,
  getWorkspace,
  assignAgentToWorkspace,
} from './workspaces/workspace.service.js';
export type { DbPool as WorkspaceDbPool } from './workspaces/workspace.service.js';

// Activity & Events
export {
  logActivity,
  getActivityLog,
  getActivityForEntity,
} from './activity/activity.service.js';
export type { ActivityLogEntry, ActivityFilters, DbPool as ActivityDbPool } from './activity/activity.service.js';

// Plugin Registry
export {
  registerAdapter,
  getAdapter,
  listAdapters,
  clearAdapters,
} from './plugins/adapter-registry.js';

// Budget & Cost Control
export {
  allocateBudget,
  trackSpend,
  checkBudget,
  getBudgetUtilization,
  convertTokensToCost,
  resetBudgets,
} from './budget/budget.service.js';
export type { BudgetRecord, TokenUsage } from './budget/budget.service.js';
export { DEFAULT_COST_MODELS } from './budget/cost-model.js';
export type { CostModel } from './budget/cost-model.js';

// Governance
export {
  setThreshold,
  getThresholds,
  getThreshold,
  evaluateAction,
  isAutoApproved,
  resetThresholds,
} from './governance/governance.service.js';
export type { ThresholdDimension, ProposedAction, EvaluationResult } from './governance/governance.service.js';

// Escalation
export {
  setEventBus as setEscalationEventBus,
  setPool as setEscalationPool,
  createEscalation,
  approveEscalation,
  rejectEscalation,
  checkExpiredEscalations,
  getPendingEscalations,
  getEscalationById,
  getAllEscalations,
  resetEscalations,
} from './governance/escalation.service.js';
export type { CreateEscalationInput } from './governance/escalation.service.js';

// Routines
export {
  createRoutine,
  deleteRoutine,
  getRoutines,
  getRoutineById,
  getNextRun,
  resetRoutines,
} from './routines/routines.service.js';
export type { Routine, CreateRoutineInput } from './routines/routines.service.js';

// Cron Routines
export { CronRoutineScheduler } from './routines/cron-routines.service.js';

// Secrets
export {
  setMasterKey,
  setSecret,
  getSecret,
  deleteSecret,
  listSecretNames,
  resetSecrets,
} from './secrets/secrets.service.js';

// Pipelines
export {
  createPipeline,
  getPipeline,
  listPipelines,
  advancePipeline,
  failPipeline,
} from './pipelines/pipeline.service.js';
export type { Pipeline, PipelineStep, CreatePipelineInput } from './pipelines/pipeline.service.js';
