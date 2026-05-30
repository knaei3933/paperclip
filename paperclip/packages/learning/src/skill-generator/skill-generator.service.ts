import type { Pool } from 'pg';
import type { EventBus, SkillGenerated } from '@paperclip/shared-types';
import type { ExperienceRecord } from '../experience-capture/experience-capture.service.js';

export interface DbPool {
  pool: Pool;
}

export interface Skill {
  id: string;
  name: string;
  domain: string;
  description: string;
  promptTemplate: string;
  toolSequence: string[];
  validationCriteria: string[];
  successRate: number;
  usageCount: number;
  agentId: string;
  applicableContexts: string[];
  createdAt: Date;
  updatedAt: Date;
  deprecatedAt: Date | null;
}

export const SKILL_GENERATION_THRESHOLD = 5;

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

/**
 * Check if an agent has enough experiences in a domain to generate a skill.
 * If so, generate it. Returns the generated skill or null.
 */
export async function checkAndGenerateSkill(
  db: DbPool,
  eventBus: EventBus,
  agentId: string,
  domain: string,
  threshold = SKILL_GENERATION_THRESHOLD,
): Promise<Skill | null> {
  const { pool } = db;

  const result = await pool.query(
    `SELECT COUNT(*)::int as count FROM experiences
     WHERE agent_id = $1 AND department = $2 AND success_flag = true`,
    [agentId, domain],
  );

  const count = result.rows[0].count;
  if (count < threshold) return null;

  // Check if a skill already exists for this agent+domain
  const existing = await pool.query(
    `SELECT * FROM agent_skills WHERE agent_id = $1 AND domain = $2 AND deprecated_at IS NULL LIMIT 1`,
    [agentId, domain],
  );
  if (existing.rows.length > 0) return null;

  // Fetch the successful experiences to synthesize from
  const expResult = await pool.query(
    `SELECT * FROM experiences
     WHERE agent_id = $1 AND department = $2 AND success_flag = true
     ORDER BY created_at DESC LIMIT $3`,
    [agentId, domain, threshold],
  );

  const experiences = expResult.rows.map(rowToExperience);
  return generateSkill(db, eventBus, experiences, agentId, domain);
}

/**
 * Generate a skill from a set of successful experiences.
 * MVP: template-based synthesis from experience patterns.
 */
export async function generateSkill(
  db: DbPool,
  eventBus: EventBus,
  experiences: ExperienceRecord[],
  agentId: string,
  domain: string,
): Promise<Skill> {
  const { pool } = db;

  // Synthesize skill from experience patterns
  const approaches = experiences.map((e) => e.approachTaken);
  const lessons = experiences.flatMap((e) => e.lessons);
  const avgTime = experiences.reduce((sum, e) => sum + e.timeTakenMs, 0) / experiences.length;
  const avgCost = experiences.reduce((sum, e) => sum + e.tokenCost, 0) / experiences.length;

  const mostCommonApproach = findMostFrequent(approaches);
  const uniqueLessons = [...new Set(lessons)].slice(0, 5);

  const name = `${domain}-automation-skill`;
  const description = `Auto-generated skill for ${domain} tasks based on ${experiences.length} successful experiences`;
  const promptTemplate = buildPromptTemplate(domain, mostCommonApproach, uniqueLessons);
  const toolSequence = extractToolSequence(experiences);
  const validationCriteria = [
    `Average completion time under ${Math.round(avgTime * 1.2)}ms`,
    `Average token cost under ${Math.round(avgCost * 1.2)}`,
    `Task outcome is success`,
  ];

  // Ensure agent has a memory record
  let memoryId: string | null = null;
  const memResult = await pool.query(
    `SELECT id FROM agent_memories WHERE agent_id = $1 LIMIT 1`,
    [agentId],
  );
  if (memResult.rows.length > 0) {
    memoryId = memResult.rows[0].id;
  } else {
    const insertMem = await pool.query(
      `INSERT INTO agent_memories (agent_id) VALUES ($1) RETURNING id`,
      [agentId],
    );
    memoryId = insertMem.rows[0].id;
  }

  const result = await pool.query(
    `INSERT INTO agent_skills
       (memory_id, agent_id, name, description, domain, prompt_template, tool_sequence,
        validation_criteria, applicable_contexts, success_rate, usage_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1.0, 0)
     RETURNING *`,
    [
      memoryId,
      agentId,
      name,
      description,
      domain,
      promptTemplate,
      toolSequence,
      validationCriteria,
      [domain],
    ],
  );

  const skill = rowToSkill(result.rows[0]);

  eventBus.emit({
    type: 'SkillGenerated',
    payload: { skillId: skill.id, agentId },
    timestamp: new Date(),
    correlationId: skill.id,
  });

  return skill;
}

export async function getSkills(
  db: DbPool,
  agentId: string,
): Promise<Skill[]> {
  const { pool } = db;
  const result = await pool.query(
    `SELECT * FROM agent_skills WHERE agent_id = $1 AND deprecated_at IS NULL ORDER BY created_at DESC`,
    [agentId],
  );
  return result.rows.map(rowToSkill);
}

export async function getSkillById(
  db: DbPool,
  skillId: string,
): Promise<Skill | null> {
  const { pool } = db;
  const result = await pool.query(
    `SELECT * FROM agent_skills WHERE id = $1`,
    [skillId],
  );
  if (result.rows.length === 0) return null;
  return rowToSkill(result.rows[0]);
}

function findMostFrequent(items: string[]): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  let max = 0;
  let result = items[0] ?? '';
  for (const [item, count] of counts) {
    if (count > max) {
      max = count;
      result = item;
    }
  }
  return result;
}

function buildPromptTemplate(
  domain: string,
  approach: string,
  lessons: string[],
): string {
  const lessonStr = lessons.map((l) => `- ${l}`).join('\n');
  return [
    `Execute ${domain} task using the following approach:`,
    `Approach: ${approach}`,
    `Key lessons learned:`,
    lessonStr || '- No specific lessons recorded',
    `Follow the tool sequence and validate results against criteria.`,
  ].join('\n');
}

function extractToolSequence(experiences: ExperienceRecord[]): string[] {
  // MVP: derive tool sequence from approach descriptions
  const tools = new Set<string>();
  for (const exp of experiences) {
    const approach = exp.approachTaken.toLowerCase();
    if (approach.includes('query')) tools.add('database_query');
    if (approach.includes('fetch') || approach.includes('api')) tools.add('api_call');
    if (approach.includes('transform') || approach.includes('process')) tools.add('data_transform');
    if (approach.includes('validate') || approach.includes('check')) tools.add('validation');
    if (approach.includes('write') || approach.includes('save')) tools.add('write_output');
    if (approach.includes('read') || approach.includes('load')) tools.add('read_input');
    if (approach.includes('analyze')) tools.add('analysis');
  }
  return [...tools];
}

function rowToExperience(row: Record<string, unknown>): ExperienceRecord {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    agentId: row.agent_id as string,
    taskDescription: row.task_description as string,
    approachTaken: row.approach_taken as string,
    result: row.result,
    success: Boolean(row.success),
    timeTakenMs: row.time_taken_ms as number,
    tokenCost: Number(row.token_cost),
    department: row.department as string,
    taskType: row.task_type as string,
    lessons: row.lessons as string[] ?? [],
    createdAt: new Date(row.created_at as string),
  };
}
