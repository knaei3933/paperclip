import type { EventBus, TaskCompleted, TaskFailed } from '@paperclip/shared-types';
import type { DbPool } from './experience-capture/experience-capture.service.js';
import { captureExperience } from './experience-capture/experience-capture.service.js';
import { checkAndGenerateSkill } from './skill-generator/skill-generator.service.js';
import { updateSkillSuccessRate, checkRefinementNeeded, deprecateSkill } from './skill-refinement/skill-refinement.service.js';
import { recordMetricSnapshot } from './metrics/metrics.service.js';
import { applySkills, recordSkillApplication } from './skill-applicator/skill-applicator.service.js';
import type { AdapterContext, TaskContext } from './skill-applicator/skill-applicator.service.js';

/**
 * Coordinates the learning loop by subscribing to EventBus events.
 *
 * On TaskCompleted: captureExperience -> checkAndGenerateSkill -> recordMetricSnapshot
 * On TaskFailed: captureExperience -> updateSkillSuccessRate(success=false)
 */
export class LearningCoordinator {
  private db: DbPool;
  private eventBus: EventBus;
  private taskStartTimes = new Map<string, number>();
  private taskSkillMap = new Map<string, string>();

  constructor(db: DbPool, eventBus: EventBus) {
    this.db = db;
    this.eventBus = eventBus;
  }

  /**
   * Register event handlers. Call once at startup.
   */
  start(): void {
    this.eventBus.on('TaskCompleted', (event: TaskCompleted) => {
      const { taskId, agentId, result } = event.payload;
      this.onTaskCompleted(taskId, agentId, result).catch((err) => {
        console.error('[LearningCoordinator] Error on TaskCompleted:', err);
      });
    });

    this.eventBus.on('TaskFailed', (event: TaskFailed) => {
      const { taskId, agentId, error } = event.payload;
      this.onTaskFailed(taskId, agentId, error).catch((err) => {
        console.error('[LearningCoordinator] Error on TaskFailed:', err);
      });
    });
  }

  /**
   * Track when a task starts (for timing).
   */
  trackTaskStart(taskId: string): void {
    this.taskStartTimes.set(taskId, Date.now());
  }

  /**
   * Track which skill was applied to a task (for post-execution recording).
   */
  trackSkillApplication(taskId: string, skillId: string): void {
    this.taskSkillMap.set(taskId, skillId);
  }

  /**
   * Get skill applicator context for a task. Heartbeat calls this before dispatch.
   */
  async getSkillContext(task: TaskContext): Promise<AdapterContext> {
    const context = await applySkills(this.db, task);
    if (context.skillApplied && context.skillId) {
      this.trackSkillApplication(task.taskId, context.skillId);
    }
    return context;
  }

  private async onTaskCompleted(
    taskId: string,
    agentId: string,
    result: unknown,
  ): Promise<void> {
    const startTime = this.taskStartTimes.get(taskId) ?? Date.now();
    const timeTakenMs = Date.now() - startTime;
    this.taskStartTimes.delete(taskId);

    // Capture experience
    const experience = await captureExperience(this.db, this.eventBus, {
      taskId,
      agentId,
      taskDescription: '',
      approachTaken: 'standard',
      result,
      success: true,
      timeTakenMs,
      tokenCost: 0,
      department: '',
      taskType: '',
    });

    // Check for skill generation
    if (experience.department) {
      await checkAndGenerateSkill(this.db, this.eventBus, agentId, experience.department);
    }

    // Record skill application outcome
    const appliedSkillId = this.taskSkillMap.get(taskId);
    if (appliedSkillId) {
      await recordSkillApplication(this.db, this.eventBus, appliedSkillId, taskId, agentId, true);
      this.taskSkillMap.delete(taskId);
    }

    // Record metric snapshot
    await recordMetricSnapshot(this.db, agentId);
  }

  private async onTaskFailed(
    taskId: string,
    agentId: string,
    error: string,
  ): Promise<void> {
    const startTime = this.taskStartTimes.get(taskId) ?? Date.now();
    const timeTakenMs = Date.now() - startTime;
    this.taskStartTimes.delete(taskId);

    // Capture experience
    await captureExperience(this.db, this.eventBus, {
      taskId,
      agentId,
      taskDescription: '',
      approachTaken: 'standard',
      result: { error },
      success: false,
      timeTakenMs,
      tokenCost: 0,
      department: '',
      taskType: '',
    });

    // Update skill success rate
    const appliedSkillId = this.taskSkillMap.get(taskId);
    if (appliedSkillId) {
      const skill = await updateSkillSuccessRate(this.db, appliedSkillId, false);
      await recordSkillApplication(this.db, this.eventBus, appliedSkillId, taskId, agentId, false);

      if (skill) {
        const status = await checkRefinementNeeded(this.db, appliedSkillId);
        if (status.needsDeprecation) {
          await deprecateSkill(this.db, this.eventBus, appliedSkillId, 'Consistent failure after multiple attempts');
        }
      }

      this.taskSkillMap.delete(taskId);
    }

    // Record metric snapshot
    await recordMetricSnapshot(this.db, agentId);
  }
}
