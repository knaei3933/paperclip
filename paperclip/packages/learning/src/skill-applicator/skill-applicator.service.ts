import type { Pool } from 'pg';
import type { EventBus, SkillApplied } from '@paperclip/shared-types';
import type { Skill } from '../skill-generator/skill-generator.service.js';

export interface DbPool {
  pool: Pool;
}

export interface AdapterContext {
  skillApplied: boolean;
  skillId?: string;
  enrichedPrompt: string;
  toolHints: string[];
}

export interface TaskContext {
  taskId: string;
  agentId: string;
  description: string;
  department?: string;
  taskType?: string;
}

/**
 * Query relevant skills matching task's domain/department and return
 * an enriched execution context with skill hints.
 */
export async function applySkills(
  db: DbPool,
  task: TaskContext,
): Promise<AdapterContext> {
  const { pool } = db;

  const domain = task.department ?? task.taskType ?? '';
  if (!domain) {
    return { skillApplied: false, enrichedPrompt: task.description, toolHints: [] };
  }

  // Find active (non-deprecated) skills for this agent matching the domain
  const result = await pool.query(
    `SELECT * FROM agent_skills
     WHERE agent_id = $1
       AND (domain = $2 OR $2 = ANY(applicable_contexts))
       AND deprecated_at IS NULL
     ORDER BY success_rate DESC, usage_count DESC
     LIMIT 1`,
    [task.agentId, domain],
  );

  if (result.rows.length === 0) {
    return { skillApplied: false, enrichedPrompt: task.description, toolHints: [] };
  }

  const skill = rowToSkill(result.rows[0]);

  const enrichedPrompt = [
    `## Skill Context: ${skill.name}`,
    '',
    skill.promptTemplate,
    '',
    `## Original Task:`,
    task.description,
  ].join('\n');

  return {
    skillApplied: true,
    skillId: skill.id,
    enrichedPrompt,
    toolHints: skill.toolSequence,
  };
}

/**
 * Record that a skill was applied to a task and whether the outcome was successful.
 * Updates the skill's usage_count.
 */
export async function recordSkillApplication(
  db: DbPool,
  eventBus: EventBus,
  skillId: string,
  taskId: string,
  agentId: string,
  success: boolean,
): Promise<void> {
  const { pool } = db;

  // Log the application
  await pool.query(
    `INSERT INTO skill_applications (skill_id, task_id, agent_id, success)
     VALUES ($1, $2, $3, $4)`,
    [skillId, taskId, agentId, success],
  );

  // Increment usage_count on the skill
  await pool.query(
    `UPDATE agent_skills SET usage_count = usage_count + 1 WHERE id = $1`,
    [skillId],
  );

  eventBus.emit({
    type: 'SkillApplied',
    payload: { skillId, taskId, success },
    timestamp: new Date(),
    correlationId: taskId,
  });
}

/**
 * Get the full applicator context for a task (convenience wrapper).
 */
export async function getSkillApplicatorContext(
  db: DbPool,
  task: TaskContext,
): Promise<AdapterContext> {
  return applySkills(db, task);
}

function rowToSkill(row: Record<string, unknown>): Skill {
  return {
    id: row.id as string,
    name: row.name as string,
    domain: row.domain as string,
    description: row.description as string,
    promptTemplate: row.prompt_template as string,
    toolSequence: row.tool_sequence as string[] ?? [],
    validationCriteria: row.validation_criteria as string[] ?? [],
    successRate: Number(row.success_rate),
    usageCount: row.usage_count as number,
    agentId: row.agent_id as string,
    applicableContexts: row.applicable_contexts as string[] ?? [],
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as Date ?? row.created_at as string),
    deprecatedAt: row.deprecated_at ? new Date(row.deprecated_at as string) : null,
  };
}
