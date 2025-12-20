/**
 * SQLite Skill Store
 *
 * High-performance skill storage using SQLite.
 * Maintains same API as the file-based skill store for compatibility.
 */

import type { Skill, SkillsRegistry, SkillCategory } from '@shared/types'
import {
  createDefaultSkillsRegistry,
  BUILT_IN_SKILLS,
  createSkill
} from '@shared/types'
import { getDatabase, runTransaction } from '@main/storage/database'

// ============ Type Conversions ============

interface SkillRow {
  id: string
  name: string
  description: string
  prompt: string
  icon: string
  category: string
  enabled: number
  is_built_in: number
  created_at: string
  updated_at: string
}

function rowToSkill(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    prompt: row.prompt,
    icon: row.icon,
    category: row.category as SkillCategory,
    enabled: row.enabled === 1,
    isBuiltIn: row.is_built_in === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function skillToParams(skill: Skill): Record<string, unknown> {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    prompt: skill.prompt,
    icon: skill.icon,
    category: skill.category,
    enabled: skill.enabled ? 1 : 0,
    is_built_in: skill.isBuiltIn ? 1 : 0,
    created_at: skill.createdAt,
    updated_at: skill.updatedAt
  }
}

// ============ Core Operations ============

/**
 * Initialize built-in skills if they don't exist
 * Updates existing built-in skills while preserving enabled state
 */
function ensureBuiltInSkills(db: ReturnType<typeof getDatabase>): void {
  const builtInIds = BUILT_IN_SKILLS.map((s) => s.id)

  // Get existing enabled states for built-in skills
  const existingRows = db
    .prepare(
      `SELECT id, enabled FROM skills WHERE id IN (${builtInIds.map(() => '?').join(',')})`
    )
    .all(...builtInIds) as { id: string; enabled: number }[]

  const enabledMap = new Map(existingRows.map((r) => [r.id, r.enabled === 1]))

  // Upsert built-in skills
  const upsertStmt = db.prepare(`
    INSERT OR REPLACE INTO skills (
      id, name, description, prompt, icon, category,
      enabled, is_built_in, created_at, updated_at
    ) VALUES (
      @id, @name, @description, @prompt, @icon, @category,
      @enabled, @is_built_in, @created_at, @updated_at
    )
  `)

  for (const builtIn of BUILT_IN_SKILLS) {
    const params = skillToParams({
      ...builtIn,
      // Preserve existing enabled state if skill exists
      enabled: enabledMap.has(builtIn.id) ? enabledMap.get(builtIn.id)! : builtIn.enabled
    })
    upsertStmt.run(params)
  }
}

/**
 * Load the skills registry
 */
export async function loadSkillsRegistry(): Promise<SkillsRegistry> {
  const db = getDatabase()

  // Ensure built-in skills are present
  ensureBuiltInSkills(db)

  const rows = db.prepare('SELECT * FROM skills').all() as SkillRow[]
  const skills = rows.map(rowToSkill)

  return {
    skills,
    version: 1
  }
}

/**
 * Save the skills registry
 */
export async function saveSkillsRegistry(registry: SkillsRegistry): Promise<void> {
  const db = getDatabase()

  runTransaction(() => {
    // Clear all skills
    db.prepare('DELETE FROM skills').run()

    // Insert all skills
    const insertStmt = db.prepare(`
      INSERT INTO skills (
        id, name, description, prompt, icon, category,
        enabled, is_built_in, created_at, updated_at
      ) VALUES (
        @id, @name, @description, @prompt, @icon, @category,
        @enabled, @is_built_in, @created_at, @updated_at
      )
    `)

    for (const skill of registry.skills) {
      insertStmt.run(skillToParams(skill))
    }
  })
}

/**
 * Get all skills
 */
export async function getAllSkills(): Promise<Skill[]> {
  const registry = await loadSkillsRegistry()
  return registry.skills
}

/**
 * Get a skill by ID
 */
export async function getSkill(skillId: string): Promise<Skill | null> {
  const db = getDatabase()
  const row = db
    .prepare('SELECT * FROM skills WHERE id = ?')
    .get(skillId) as SkillRow | undefined

  return row ? rowToSkill(row) : null
}

/**
 * Get skills by IDs
 */
export async function getSkillsByIds(skillIds: string[]): Promise<Skill[]> {
  if (skillIds.length === 0) return []

  const db = getDatabase()
  const placeholders = skillIds.map(() => '?').join(',')
  const rows = db
    .prepare(`SELECT * FROM skills WHERE id IN (${placeholders})`)
    .all(...skillIds) as SkillRow[]

  return rows.map(rowToSkill)
}

/**
 * Get enabled skills
 */
export async function getEnabledSkills(): Promise<Skill[]> {
  const db = getDatabase()
  const rows = db
    .prepare('SELECT * FROM skills WHERE enabled = 1')
    .all() as SkillRow[]

  return rows.map(rowToSkill)
}

/**
 * Create a new skill
 */
export async function addSkill(
  name: string,
  description: string,
  prompt: string,
  options: Partial<Skill> = {}
): Promise<Skill> {
  const db = getDatabase()
  const skill = createSkill(name, description, prompt, options)

  db.prepare(`
    INSERT INTO skills (
      id, name, description, prompt, icon, category,
      enabled, is_built_in, created_at, updated_at
    ) VALUES (
      @id, @name, @description, @prompt, @icon, @category,
      @enabled, @is_built_in, @created_at, @updated_at
    )
  `).run(skillToParams(skill))

  return skill
}

/**
 * Update an existing skill
 */
export async function updateSkill(
  skillId: string,
  updates: Partial<Omit<Skill, 'id' | 'isBuiltIn' | 'createdAt'>>
): Promise<Skill | null> {
  const db = getDatabase()
  const existing = await getSkill(skillId)

  if (!existing) {
    return null
  }

  // Don't allow modifying the prompt of built-in skills
  let finalUpdates = updates
  if (existing.isBuiltIn && updates.prompt !== undefined) {
    const { prompt: _ignored, ...allowedUpdates } = updates
    finalUpdates = allowedUpdates
  }

  const updated: Skill = {
    ...existing,
    ...finalUpdates,
    updatedAt: new Date().toISOString()
  }

  db.prepare(`
    UPDATE skills SET
      name = @name,
      description = @description,
      prompt = @prompt,
      icon = @icon,
      category = @category,
      enabled = @enabled,
      updated_at = @updated_at
    WHERE id = @id
  `).run(skillToParams(updated))

  return updated
}

/**
 * Delete a skill (only custom skills can be deleted)
 */
export async function deleteSkill(skillId: string): Promise<boolean> {
  const db = getDatabase()
  const skill = await getSkill(skillId)

  if (!skill || skill.isBuiltIn) {
    return false
  }

  const result = db.prepare('DELETE FROM skills WHERE id = ?').run(skillId)
  return result.changes > 0
}

/**
 * Toggle a skill's enabled state
 */
export async function toggleSkill(skillId: string): Promise<Skill | null> {
  const skill = await getSkill(skillId)

  if (!skill) {
    return null
  }

  return updateSkill(skillId, { enabled: !skill.enabled })
}

/**
 * Set multiple skills' enabled state at once
 */
export async function setSkillsEnabled(
  skillIds: string[],
  enabled: boolean
): Promise<void> {
  if (skillIds.length === 0) return

  const db = getDatabase()
  const placeholders = skillIds.map(() => '?').join(',')
  const now = new Date().toISOString()

  db.prepare(`
    UPDATE skills SET enabled = ?, updated_at = ? WHERE id IN (${placeholders})
  `).run(enabled ? 1 : 0, now, ...skillIds)
}

/**
 * Build the combined prompt from selected skills
 */
export async function buildSkillPrompt(skillIds: string[]): Promise<string> {
  if (skillIds.length === 0) {
    return ''
  }

  const skills = await getSkillsByIds(skillIds)
  const enabledSkills = skills.filter((s) => s.enabled)

  if (enabledSkills.length === 0) {
    return ''
  }

  const skillPrompts = enabledSkills
    .map((skill) => `## ${skill.name}\n${skill.prompt}`)
    .join('\n\n')

  return `
# Active Skills

The following specialized instructions are active for this task:

${skillPrompts}
`
}

/**
 * Reset skills to defaults
 */
export async function resetSkills(): Promise<SkillsRegistry> {
  const defaultRegistry = createDefaultSkillsRegistry()
  await saveSkillsRegistry(defaultRegistry)
  return defaultRegistry
}
