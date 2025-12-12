/**
 * IPC handlers for skill operations
 */

import { ipcMain } from 'electron'
import type { CreateSkillData, GithubSkillData } from '@shared/ipc-types'
import type { Skill } from '@shared/types'
import {
  getAllSkills,
  getSkill,
  getSkillsByIds,
  getEnabledSkills,
  addSkill,
  updateSkill,
  deleteSkill,
  toggleSkill,
  setSkillsEnabled,
  buildSkillPrompt,
  resetSkills
} from '../storage/skill-store'
import { fetchSkillsFromGithub } from '../skills/github-importer'

export function registerSkillHandlers(): void {
  // List all skills
  ipcMain.handle('skill:list', async (): Promise<Skill[]> => {
    return getAllSkills()
  })

  // Get a single skill
  ipcMain.handle('skill:get', async (_, id: string): Promise<Skill | null> => {
    return getSkill(id)
  })

  // Get skills by IDs
  ipcMain.handle('skill:getByIds', async (_, ids: string[]): Promise<Skill[]> => {
    return getSkillsByIds(ids)
  })

  // Get enabled skills
  ipcMain.handle('skill:getEnabled', async (): Promise<Skill[]> => {
    return getEnabledSkills()
  })

  // Create a new skill
  ipcMain.handle('skill:create', async (_, data: CreateSkillData): Promise<Skill> => {
    return addSkill(data.name, data.description, data.prompt, {
      icon: data.icon,
      category: data.category
    })
  })

  // Update a skill
  ipcMain.handle(
    'skill:update',
    async (_, id: string, updates: Partial<Skill>): Promise<Skill | null> => {
      return updateSkill(id, updates)
    }
  )

  // Delete a skill
  ipcMain.handle('skill:delete', async (_, id: string): Promise<boolean> => {
    return deleteSkill(id)
  })

  // Toggle a skill's enabled state
  ipcMain.handle('skill:toggle', async (_, id: string): Promise<Skill | null> => {
    return toggleSkill(id)
  })

  // Set multiple skills' enabled state
  ipcMain.handle(
    'skill:setEnabled',
    async (_, ids: string[], enabled: boolean): Promise<void> => {
      return setSkillsEnabled(ids, enabled)
    }
  )

  // Build combined prompt from skills
  ipcMain.handle('skill:buildPrompt', async (_, ids: string[]): Promise<string> => {
    return buildSkillPrompt(ids)
  })

  // Reset skills to defaults
  ipcMain.handle('skill:reset', async (): Promise<Skill[]> => {
    const registry = await resetSkills()
    return registry.skills
  })

  // Fetch skills from GitHub repository
  ipcMain.handle('skill:fetchFromGithub', async (_, githubUrl: string): Promise<GithubSkillData[]> => {
    return fetchSkillsFromGithub(githubUrl)
  })
}
