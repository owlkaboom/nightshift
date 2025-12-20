/**
 * Project Analysis IPC handlers
 *
 * Handles IPC communication for project analysis, technology detection,
 * and skill recommendations between main and renderer processes.
 */

import { ipcMain } from 'electron'
import type {
  ProjectAnalysis,
  DetectedTechnology,
  DetectedPattern,
  SkillRecommendation,
  ClaudeSkill,
  CreateClaudeSkillData
} from '@shared/types'
import { logger } from '@main/utils/logger'
import {
  analyzeProject,
  getCachedAnalysis,
  clearAnalysisCache,
  detectProjectTechnologies,
  detectProjectPatterns,
  getProjectRecommendations,
  createSkillsFromRecommendations
} from '@main/analysis'
import { claudeConfigManager } from '@main/agents/claude-config-manager'

/**
 * Helper function to create a skill via claudeConfigManager
 */
function createSkillForProjectPath(
  projectPath: string,
  data: CreateClaudeSkillData
): Promise<ClaudeSkill> {
  return claudeConfigManager.createSkill(projectPath, data)
}

/**
 * Register all analysis IPC handlers
 */
export function registerAnalysisHandlers(): void {
  /**
   * Analyze a project to detect technologies and suggest skills
   * @param projectId - The project ID
   * @param projectPath - The local filesystem path to the project
   */
  ipcMain.handle(
    'analysis:analyze',
    async (_, projectId: string, projectPath: string): Promise<ProjectAnalysis> => {
      logger.debug('[AnalysisHandlers] Analyzing project:', projectId, 'at path:', projectPath)
      return analyzeProject(projectId, projectPath)
    }
  )

  /**
   * Get cached analysis for a project (if available)
   */
  ipcMain.handle(
    'analysis:getCached',
    async (_, projectId: string): Promise<ProjectAnalysis | null> => {
      return getCachedAnalysis(projectId)
    }
  )

  /**
   * Detect technologies in a project
   * @param projectPath - The local filesystem path to the project
   */
  ipcMain.handle(
    'analysis:detectTechnologies',
    async (_, projectPath: string): Promise<DetectedTechnology[]> => {
      logger.debug('[AnalysisHandlers] Detecting technologies for:', projectPath)
      return detectProjectTechnologies(projectPath)
    }
  )

  /**
   * Detect coding patterns in a project
   * @param projectPath - The local filesystem path to the project
   */
  ipcMain.handle(
    'analysis:detectPatterns',
    async (_, projectPath: string): Promise<DetectedPattern[]> => {
      logger.debug('[AnalysisHandlers] Detecting patterns for:', projectPath)
      return detectProjectPatterns(projectPath)
    }
  )

  /**
   * Get skill recommendations based on analysis
   */
  ipcMain.handle(
    'analysis:getRecommendations',
    async (_, projectId: string): Promise<SkillRecommendation[]> => {
      logger.debug('[AnalysisHandlers] Getting recommendations for:', projectId)
      return getProjectRecommendations(projectId)
    }
  )

  /**
   * Create Claude skills from selected recommendations
   * @param projectId - The project ID
   * @param projectPath - The local filesystem path to the project
   * @param recommendationIds - The recommendation IDs to create skills from
   */
  ipcMain.handle(
    'analysis:createSkills',
    async (
      _,
      projectId: string,
      projectPath: string,
      recommendationIds: string[]
    ): Promise<ClaudeSkill[]> => {
      logger.debug(
        '[AnalysisHandlers] Creating skills from recommendations:',
        recommendationIds.length
      )

      return createSkillsFromRecommendations(
        projectId,
        recommendationIds,
        (data) => createSkillForProjectPath(projectPath, data)
      )
    }
  )

  /**
   * Clear cached analysis for a project
   */
  ipcMain.handle(
    'analysis:clearCache',
    async (_, projectId: string): Promise<void> => {
      logger.debug('[AnalysisHandlers] Clearing cache for:', projectId)
      clearAnalysisCache(projectId)
    }
  )
}
