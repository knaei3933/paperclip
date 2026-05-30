import type { Pool } from 'pg';
import type { EventBus, SkillDeprecated } from '@paperclip/shared-types';
import type { Skill } from '../skill-generator/skill-generator.service.js';

export interface DbPool {
  pool: Pool;
}

export const REFINEMENT_THRESHOLD = 0.5;
export const DEPRECATION_MAX_FAILURES = 3;

/**
 * Update a skill's success rate based on the latest application result.
 * Uses a rolling average from skill_applications table.
 */
export async function updateSkillSuccessRate(
  db: DbPool,
  skillId: string,
  success: boolean,
): Promise<Skill | null> {
  const { pool } = db;

  // Calculate success rate from all applications
  const statsResult = await pool.query(
    `SELECT
       COUNT(*)::int as total,
       COUNT(*) FILTER (WHERE success = true)::int as successes
     FROM skill_applications
     WHERE skill_id = $1`,
    [skillId],
  );

  if (statsResult.rows.length === 0) return null;

  const total = statsResult.rows[0].total;
  const successes = statsResult.rows[0].successes;
  const newRate = total > 0 ? successes / total : 0;

  await pool.query(
    `UPDATE agent_skills SET success_rate = $1 WHERE id = $2`,
    [newRate, skillId],
  );

  // Fetch updated skill
  const skillResult = await pool.query(
    `SELECT * FROM agent_skills WHERE id = $1`,
    [skillId],
  );
  if (skillResult.rows.length === 0) return null;
  return rowToSkill(skillResult.rows[0]);
}

/**
 * Check if a skill needs refinement based on its success rate.
 */
export async function checkRefinementNeeded(
  db: DbPool,
  skillId: string,
): Promise<{ needsRefinement: boolean; needsDeprecation: boolean; successRate: number }> {
  const { pool } = db;

  const result = await pool.query(
    `SELECT success_rate FROM agent_skills WHERE id = $1`,
    [skillId],
  );
  if (result.rows.length === 0) {
    return { needsRefinement: false, needsDeprecation: false, successRate: 0 };
  }

  const successRate = Number(result.rows[0].success_rate);

  // Check for deprecation: zero success rate after M consecutive failures
  const recentApps = await pool.query(
    `SELECT success FROM skill_applications
     WHERE skill_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [skillId, DEPRECATION_MAX_FAILURES],
  );

  const recentAllFailures = recentApps.rows.length >= DEPRECATION_MAX_FAILURES
    && recentApps.rows.every((r) => r.success === false);

  return {
    needsRefinement: successRate < REFINEMENT_THRESHOLD && successRate > 0,
    needsDeprecation: recentAllFailures,
    successRate,
  };
}

/**
 * Refine a skill by resetting its statistics and updating from recent experiences.
 * MVP: resets success_rate to allow fresh accumulation.
 */
export async function refineSkill(
  db: DbPool,
  skillId: string,
): Promise<Skill | null> {
  const { pool } = db;

  const skillResult = await pool.query(
    `SELECT * FROM agent_skills WHERE id = $1`,
    [skillId],
  );
  if (skillResult.rows.length === 0) return null;

  // Reset usage stats and bump success rate to neutral
  await pool.query(
    `UPDATE agent_skills SET success_rate = 0.5, usage_count = 0 WHERE id = $1`,
    [skillId],
  );

  // Clear old application history for clean slate
  await pool.query(
    `DELETE FROM skill_applications WHERE skill_id = $1`,
    [skillId],
  );

  const updated = await pool.query(
    `SELECT * FROM agent_skills WHERE id = $1`,
    [skillId],
  );
  return rowToSkill(updated.rows[0]);
}

/**
 * Deprecate a skill that has failed consistently.
 */
export async function deprecateSkill(
  db: DbPool,
  eventBus: EventBus,
  skillId: string,
  reason: string,
): Promise<Skill | null> {
  const { pool } = db;

  const result = await pool.query(
    `UPDATE agent_skills SET deprecated_at = now() WHERE id = $1 RETURNING *`,
    [skillId],
  );
  if (result.rows.length === 0) return null;

  const skill = rowToSkill(result.rows[0]);

  eventBus.emit({
    type: 'SkillDeprecated',
    payload: { skillId, reason },
    timestamp: new Date(),
    correlationId: skillId,
  });

  return skill;
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
