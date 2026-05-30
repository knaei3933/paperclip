// Experience Capture
export {
  captureExperience,
  getExperiences,
  getExperienceCount,
} from './experience-capture/experience-capture.service.js';
export type {
  ExperienceRecord,
  CaptureExperienceInput,
  ExperienceFilters,
  DbPool as ExperienceDbPool,
} from './experience-capture/experience-capture.service.js';

// Memory Store
export {
  searchExperiences,
  getRelevantExperiences,
  summarizeExperiences,
} from './memory-store/memory-store.service.js';
export type {
  SearchResult,
  DbPool as MemoryStoreDbPool,
} from './memory-store/memory-store.service.js';

// Skill Generator
export {
  checkAndGenerateSkill,
  generateSkill,
  getSkills,
  getSkillById,
  SKILL_GENERATION_THRESHOLD,
} from './skill-generator/skill-generator.service.js';
export type {
  Skill,
  DbPool as SkillGeneratorDbPool,
} from './skill-generator/skill-generator.service.js';

// Skill Applicator
export {
  applySkills,
  recordSkillApplication,
  getSkillApplicatorContext,
} from './skill-applicator/skill-applicator.service.js';
export type {
  AdapterContext,
  TaskContext,
  DbPool as SkillApplicatorDbPool,
} from './skill-applicator/skill-applicator.service.js';

// Skill Refinement
export {
  updateSkillSuccessRate,
  checkRefinementNeeded,
  refineSkill,
  deprecateSkill,
  REFINEMENT_THRESHOLD,
  DEPRECATION_MAX_FAILURES,
} from './skill-refinement/skill-refinement.service.js';
export type {
  DbPool as SkillRefinementDbPool,
} from './skill-refinement/skill-refinement.service.js';

// User Modeling
export {
  recordApprovalDecision,
  getApprovalPatterns,
  getPreferenceModel,
  adjustEscalationSensitivity,
} from './user-modeling/user-modeling.service.js';
export type {
  ApprovalDecision,
  ApprovalPattern,
  PreferenceModel,
  DbPool as UserModelingDbPool,
} from './user-modeling/user-modeling.service.js';

// Metrics
export {
  computeAgentMetrics,
  getImprovementTrend,
  recordMetricSnapshot,
  getMetricsDashboard,
} from './metrics/metrics.service.js';
export type {
  AgentMetrics,
  ImprovementTrend,
  MetricSnapshot,
  DbPool as MetricsDbPool,
} from './metrics/metrics.service.js';

// Learning Coordinator
export { LearningCoordinator } from './learning-coordinator.js';
