import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import type { IdentityDbPool } from '@paperclip/core';
import { registerAgent, updateAgent, getAgentById } from '@paperclip/core';
import { createDepartment } from '@paperclip/core';
import type { CronRoutineScheduler } from '@paperclip/core';

interface RoutineTemplate {
  name: string;
  schedule: string;
  task_template: { title: string; description: string; priority?: number; budget?: number };
}

interface AgentTemplate {
  name: string;
  role: string;
  department: string;
  capabilities: string;
  skills: string[];
  adapter_type: string;
  adapter_config: Record<string, unknown>;
  routines: RoutineTemplate[];
}

interface TradingTemplate {
  departments: Array<{ name: string; type: string }>;
  agents: AgentTemplate[];
}

export async function loadTradingTemplate(
  db: IdentityDbPool,
  cronScheduler: CronRoutineScheduler,
): Promise<void> {
  const { pool } = db;

  // Load and parse YAML template
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const templatePath = join(__dirname, '..', '..', 'templates', 'trading-company.yaml');
  let template: TradingTemplate;
  try {
    const raw = readFileSync(templatePath, 'utf-8');
    template = yaml.load(raw) as TradingTemplate;
  } catch (err) {
    console.warn('[TemplateLoader] No template file found, skipping:', err instanceof Error ? err.message : err);
    return;
  }

  // Find existing company
  const companyResult = await pool.query('SELECT id FROM companies LIMIT 1');
  if (companyResult.rows.length === 0) {
    console.warn('[TemplateLoader] No company found, skipping template load');
    return;
  }
  const companyId = companyResult.rows[0].id;

  // Create departments, tracking name->id mapping
  const deptMap = new Map<string, string>();
  for (const dept of template.departments) {
    const existing = await pool.query(
      'SELECT id FROM departments WHERE name = $1 AND company_id = $2',
      [dept.name, companyId],
    );
    if (existing.rows.length > 0) {
      deptMap.set(dept.name, existing.rows[0].id);
    } else {
      const created = await createDepartment(db, dept.name, dept.type, companyId);
      deptMap.set(dept.name, created.id);
    }
  }

  // Create or update agents
  for (const agentTpl of template.agents) {
    const departmentId = deptMap.get(agentTpl.department);
    if (!departmentId) {
      console.warn(`[TemplateLoader] Department "${agentTpl.department}" not found for agent "${agentTpl.name}"`);
      continue;
    }

    // Check if agent already exists
    const existing = await pool.query(
      'SELECT id, capabilities FROM agents WHERE name = $1 AND department_id = $2',
      [agentTpl.name, departmentId],
    );

    let agentId: string;
    if (existing.rows.length > 0) {
      agentId = existing.rows[0].id;
      // Update existing agents that have empty capabilities
      if (!existing.rows[0].capabilities || existing.rows[0].capabilities === '') {
        await updateAgent(db, agentId, {
          capabilities: agentTpl.capabilities,
          skills: agentTpl.skills,
          adapterType: agentTpl.adapter_type,
          adapterConfig: agentTpl.adapter_config,
        });
        console.log(`[TemplateLoader] Updated agent "${agentTpl.name}" with capabilities`);
      }
    } else {
      const agent = await registerAgent(db, {
        name: agentTpl.name,
        role: agentTpl.role,
        departmentId,
        skills: agentTpl.skills,
        capabilities: agentTpl.capabilities,
        adapterType: agentTpl.adapter_type,
        adapterConfig: agentTpl.adapter_config,
      });
      agentId = agent.id;
      console.log(`[TemplateLoader] Registered agent "${agentTpl.name}" (${agentTpl.role})`);
    }

    // Register routines with agent binding
    for (const routine of agentTpl.routines) {
      await cronScheduler.seedRoutine({
        name: routine.name,
        schedule: routine.schedule,
        task_template: routine.task_template,
        department: agentTpl.department,
        agent_id: agentId,
      });
      console.log(`[TemplateLoader] Seeded routine "${routine.name}" for agent "${agentTpl.name}"`);
    }
  }

  console.log('[TemplateLoader] Trading template loaded successfully');
}
