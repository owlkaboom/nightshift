/**
 * IPC handlers for Claude configuration operations
 *
 * Handles management of .claude/ directory structure including
 * sub-agents, skills, commands, and CLAUDE.md file.
 */

import { ipcMain } from 'electron'
import type {
  ClaudeAgent,
  ClaudeSkill,
  ClaudeCommand,
  ClaudeProjectConfig,
  CreateClaudeAgentData,
  CreateClaudeSkillData,
  CreateClaudeCommandData
} from '@shared/types'
import { claudeConfigManager } from '@main/agents/claude-config-manager'
import { getProjectPath } from '@main/storage/local-state-store'
import { logger } from '@main/utils/logger'

/**
 * Helper to get project path from project ID
 */
async function getPath(projectId: string): Promise<string> {
  const path = await getProjectPath(projectId)
  if (!path) {
    throw new Error(`Project not found: ${projectId}`)
  }
  return path
}

/**
 * Register Claude config IPC handlers
 */
export function registerClaudeConfigHandlers(): void {
  // ============ Project Scanning ============

  /**
   * Scan a project for Claude configuration
   */
  ipcMain.handle(
    'claudeConfig:scan',
    async (_, projectId: string): Promise<ClaudeProjectConfig> => {
      const projectPath = await getPath(projectId)
      return claudeConfigManager.scanProject(projectPath)
    }
  )

  /**
   * Get agents for a project
   */
  ipcMain.handle(
    'claudeConfig:getAgents',
    async (_, projectId: string): Promise<ClaudeAgent[]> => {
      const projectPath = await getPath(projectId)
      return claudeConfigManager.getAgents(projectPath)
    }
  )

  /**
   * Get skills for a project
   */
  ipcMain.handle(
    'claudeConfig:getSkills',
    async (_, projectId: string): Promise<ClaudeSkill[]> => {
      const projectPath = await getPath(projectId)
      return claudeConfigManager.getSkills(projectPath)
    }
  )

  /**
   * Get commands for a project
   */
  ipcMain.handle(
    'claudeConfig:getCommands',
    async (_, projectId: string): Promise<ClaudeCommand[]> => {
      const projectPath = await getPath(projectId)
      return claudeConfigManager.getCommands(projectPath)
    }
  )

  // ============ Agent Operations ============

  /**
   * Create a new agent
   */
  ipcMain.handle(
    'claudeConfig:createAgent',
    async (_, projectId: string, data: CreateClaudeAgentData): Promise<ClaudeAgent> => {
      const projectPath = await getPath(projectId)
      return claudeConfigManager.createAgent(projectPath, data)
    }
  )

  /**
   * Update an existing agent
   */
  ipcMain.handle(
    'claudeConfig:updateAgent',
    async (
      _,
      projectId: string,
      name: string,
      updates: Partial<CreateClaudeAgentData>
    ): Promise<ClaudeAgent> => {
      const projectPath = await getPath(projectId)
      return claudeConfigManager.updateAgent(projectPath, name, updates)
    }
  )

  /**
   * Delete an agent
   */
  ipcMain.handle(
    'claudeConfig:deleteAgent',
    async (_, projectId: string, name: string): Promise<void> => {
      const projectPath = await getPath(projectId)
      return claudeConfigManager.deleteAgent(projectPath, name)
    }
  )

  // ============ Skill Operations ============

  /**
   * Create a new skill
   */
  ipcMain.handle(
    'claudeConfig:createSkill',
    async (_, projectId: string, data: CreateClaudeSkillData): Promise<ClaudeSkill> => {
      const projectPath = await getPath(projectId)
      return claudeConfigManager.createSkill(projectPath, data)
    }
  )

  /**
   * Update an existing skill
   */
  ipcMain.handle(
    'claudeConfig:updateSkill',
    async (
      _,
      projectId: string,
      name: string,
      updates: Partial<CreateClaudeSkillData>
    ): Promise<ClaudeSkill> => {
      const projectPath = await getPath(projectId)
      return claudeConfigManager.updateSkill(projectPath, name, updates)
    }
  )

  /**
   * Delete a skill
   */
  ipcMain.handle(
    'claudeConfig:deleteSkill',
    async (_, projectId: string, name: string): Promise<void> => {
      const projectPath = await getPath(projectId)
      return claudeConfigManager.deleteSkill(projectPath, name)
    }
  )

  /**
   * Toggle a skill's enabled state
   */
  ipcMain.handle(
    'claudeConfig:toggleSkill',
    async (_, projectId: string, name: string, enabled: boolean): Promise<ClaudeSkill> => {
      const projectPath = await getPath(projectId)
      return claudeConfigManager.toggleSkill(projectPath, name, enabled)
    }
  )

  // ============ Command Operations ============

  /**
   * Create a new command
   */
  ipcMain.handle(
    'claudeConfig:createCommand',
    async (_, projectId: string, data: CreateClaudeCommandData): Promise<ClaudeCommand> => {
      const projectPath = await getPath(projectId)
      return claudeConfigManager.createCommand(projectPath, data)
    }
  )

  /**
   * Update an existing command
   */
  ipcMain.handle(
    'claudeConfig:updateCommand',
    async (
      _,
      projectId: string,
      name: string,
      updates: Partial<CreateClaudeCommandData>
    ): Promise<ClaudeCommand> => {
      const projectPath = await getPath(projectId)
      return claudeConfigManager.updateCommand(projectPath, name, updates)
    }
  )

  /**
   * Delete a command
   */
  ipcMain.handle(
    'claudeConfig:deleteCommand',
    async (_, projectId: string, name: string): Promise<void> => {
      const projectPath = await getPath(projectId)
      return claudeConfigManager.deleteCommand(projectPath, name)
    }
  )

  // ============ CLAUDE.md Operations ============

  /**
   * Update CLAUDE.md file
   */
  ipcMain.handle(
    'claudeConfig:updateClaudeMd',
    async (_, projectId: string, content: string): Promise<void> => {
      const projectPath = await getPath(projectId)
      return claudeConfigManager.updateClaudeMd(projectPath, content)
    }
  )

  /**
   * Delete CLAUDE.md file
   */
  ipcMain.handle(
    'claudeConfig:deleteClaudeMd',
    async (_, projectId: string): Promise<void> => {
      const projectPath = await getPath(projectId)
      return claudeConfigManager.deleteClaudeMd(projectPath)
    }
  )

  logger.debug('[ClaudeConfig] Handlers registered')
}
