/**
 * Skills store for ~/.nightshift/sync/skills.json
 */

import type { Skill, SkillsRegistry } from '@shared/types'
import { createDefaultSkillsRegistry, BUILT_IN_SKILLS, createSkill } from '@shared/types'
import { getSkillsPath } from '../utils/paths'
import { readJsonWithDefault, writeJson } from './file-store'

/**
 * Load the skills registry
 * Returns default registry with built-in skills if file doesn't exist
 */
export async function loadSkillsRegistry(): Promise<SkillsRegistry> {
  const path = getSkillsPath()
  const registry = await readJsonWithDefault(path, createDefaultSkillsRegistry())

  // Ensure built-in skills are always present and up to date
  const builtInIds = new Set(BUILT_IN_SKILLS.map((s) => s.id))
  const existingBuiltIns = new Map(registry.skills.filter((s) => s.isBuiltIn).map((s) => [s.id, s]))

  // Update built-in skills and keep their enabled state
  const updatedBuiltIns = BUILT_IN_SKILLS.map((builtIn) => {
    const existing = existingBuiltIns.get(builtIn.id)
    return existing ? { ...builtIn, enabled: existing.enabled } : builtIn
  })

  // Keep custom skills
  const customSkills = registry.skills.filter((s) => !s.isBuiltIn && !builtInIds.has(s.id))

  return {
    ...registry,
    skills: [...updatedBuiltIns, ...customSkills]
  }
}

/**
 * Save the skills registry
 */
export async function saveSkillsRegistry(registry: SkillsRegistry): Promise<void> {
  const path = getSkillsPath()
  await writeJson(path, registry)
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
  const registry = await loadSkillsRegistry()
  return registry.skills.find((s) => s.id === skillId) ?? null
}

/**
 * Get skills by IDs
 */
export async function getSkillsByIds(skillIds: string[]): Promise<Skill[]> {
  const registry = await loadSkillsRegistry()
  const idSet = new Set(skillIds)
  return registry.skills.filter((s) => idSet.has(s.id))
}

/**
 * Get enabled skills
 */
export async function getEnabledSkills(): Promise<Skill[]> {
  const registry = await loadSkillsRegistry()
  return registry.skills.filter((s) => s.enabled)
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
  const registry = await loadSkillsRegistry()
  const skill = createSkill(name, description, prompt, options)
  registry.skills.push(skill)
  await saveSkillsRegistry(registry)
  return skill
}

/**
 * Update an existing skill
 */
export async function updateSkill(
  skillId: string,
  updates: Partial<Omit<Skill, 'id' | 'isBuiltIn' | 'createdAt'>>
): Promise<Skill | null> {
  const registry = await loadSkillsRegistry()
  const index = registry.skills.findIndex((s) => s.id === skillId)

  if (index === -1) {
    return null
  }

  const skill = registry.skills[index]

  // Don't allow modifying the prompt of built-in skills
  if (skill.isBuiltIn && updates.prompt !== undefined) {
    const { prompt: _ignored, ...allowedUpdates } = updates
    registry.skills[index] = {
      ...skill,
      ...allowedUpdates,
      updatedAt: new Date().toISOString()
    }
  } else {
    registry.skills[index] = {
      ...skill,
      ...updates,
      updatedAt: new Date().toISOString()
    }
  }

  await saveSkillsRegistry(registry)
  return registry.skills[index]
}

/**
 * Delete a skill (only custom skills can be deleted)
 */
export async function deleteSkill(skillId: string): Promise<boolean> {
  const registry = await loadSkillsRegistry()
  const skill = registry.skills.find((s) => s.id === skillId)

  if (!skill || skill.isBuiltIn) {
    return false
  }

  registry.skills = registry.skills.filter((s) => s.id !== skillId)
  await saveSkillsRegistry(registry)
  return true
}

/**
 * Toggle a skill's enabled state
 */
export async function toggleSkill(skillId: string): Promise<Skill | null> {
  const registry = await loadSkillsRegistry()
  const skill = registry.skills.find((s) => s.id === skillId)

  if (!skill) {
    return null
  }

  return updateSkill(skillId, { enabled: !skill.enabled })
}

/**
 * Set multiple skills' enabled state at once
 */
export async function setSkillsEnabled(skillIds: string[], enabled: boolean): Promise<void> {
  const registry = await loadSkillsRegistry()
  const idSet = new Set(skillIds)

  registry.skills = registry.skills.map((skill) => {
    if (idSet.has(skill.id)) {
      return { ...skill, enabled, updatedAt: new Date().toISOString() }
    }
    return skill
  })

  await saveSkillsRegistry(registry)
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

  const skillPrompts = enabledSkills.map((skill) => `## ${skill.name}\n${skill.prompt}`).join('\n\n')

  return `
# Active Skills

The following specialized instructions are active for this task:

${skillPrompts}
`
}

/**
 * Reset skills to defaults (removes custom skills, resets built-in enabled states)
 */
export async function resetSkills(): Promise<SkillsRegistry> {
  const defaultRegistry = createDefaultSkillsRegistry()
  await saveSkillsRegistry(defaultRegistry)
  return defaultRegistry
}
