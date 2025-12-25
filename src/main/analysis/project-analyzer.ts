/**
 * Project Analyzer Service
 *
 * Main service for analyzing projects to detect technologies,
 * patterns, and generate skill recommendations.
 */

import { BrowserWindow } from 'electron'
import { logger } from '@main/utils/logger'
import type {
  ProjectAnalysis,
  DetectedTechnology,
  DetectedPattern,
  SkillRecommendation,
  AnalysisProgress,
  AnalysisStatus
} from '@shared/types'
import { createProjectAnalysis } from '@shared/types'
import { detectTechnologies } from './tech-detector'
import { detectPatterns } from './pattern-detector'

/**
 * Cache for analysis results
 * Key: projectId, Value: { analysis, timestamp }
 */
const analysisCache = new Map<string, { analysis: ProjectAnalysis; timestamp: number }>()

/**
 * Cache TTL in milliseconds (30 minutes)
 */
const CACHE_TTL = 30 * 60 * 1000

/**
 * Broadcast analysis progress to all windows
 */
function broadcastProgress(projectId: string, progress: AnalysisProgress): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send('analysis:progress', { projectId, progress })
  })
}

/**
 * Create a progress update
 */
function createProgress(status: AnalysisStatus, message: string, progress: number): AnalysisProgress {
  return { status, message, progress }
}

/**
 * Get cached analysis if still valid
 */
export function getCachedAnalysis(projectId: string): ProjectAnalysis | null {
  const cached = analysisCache.get(projectId)

  if (!cached) return null

  // Check if cache is still valid
  const age = Date.now() - cached.timestamp
  if (age > CACHE_TTL) {
    analysisCache.delete(projectId)
    return null
  }

  return cached.analysis
}

/**
 * Clear cached analysis for a project
 */
export function clearAnalysisCache(projectId: string): void {
  analysisCache.delete(projectId)
}

/**
 * Clear all cached analyses
 */
export function clearAllAnalysisCache(): void {
  analysisCache.clear()
}

/**
 * Generate a summary of the analysis
 */
function generateSummary(
  technologies: DetectedTechnology[],
  patterns: DetectedPattern[],
  recommendations: SkillRecommendation[]
): string {
  const parts: string[] = []

  // Technology summary
  const highConfidenceTechs = technologies.filter((t) => t.confidence >= 0.8)
  if (highConfidenceTechs.length > 0) {
    const techNames = highConfidenceTechs.slice(0, 5).map((t) => t.name)
    parts.push(`Technologies: ${techNames.join(', ')}`)
  }

  // Pattern summary
  const strongPatterns = patterns.filter((p) => p.confidence >= 0.6)
  if (strongPatterns.length > 0) {
    const patternNames = strongPatterns.slice(0, 3).map((p) => p.name)
    parts.push(`Patterns: ${patternNames.join(', ')}`)
  }

  // Recommendation summary
  const highPriorityRecs = recommendations.filter((r) => r.priority === 'high')
  parts.push(`${recommendations.length} skill recommendations (${highPriorityRecs.length} high priority)`)

  return parts.join('. ')
}

/**
 * Analyze a project and return analysis results
 *
 * @param projectId The project ID to analyze
 * @param projectPath The local filesystem path to the project
 * @param forceRefresh If true, skip cache and re-analyze
 * @returns ProjectAnalysis result
 */
export async function analyzeProject(
  projectId: string,
  projectPath: string,
  forceRefresh: boolean = false
): Promise<ProjectAnalysis> {
  // Check cache first
  if (!forceRefresh) {
    const cached = getCachedAnalysis(projectId)
    if (cached) {
      logger.debug('[ProjectAnalyzer] Returning cached analysis for', projectId)
      return cached
    }
  }

  if (!projectPath) {
    throw new Error(
      `Project path not provided. Please ensure the project has a valid local path.`
    )
  }
  logger.debug('[ProjectAnalyzer] Analyzing project:', projectPath)

  // Start analysis
  broadcastProgress(projectId, createProgress('detecting-technologies', 'Detecting technologies...', 10))

  // Detect technologies
  let technologies: DetectedTechnology[]
  try {
    technologies = await detectTechnologies(projectPath)
    logger.debug('[ProjectAnalyzer] Detected technologies:', technologies.length)
  } catch (error) {
    console.error('[ProjectAnalyzer] Error detecting technologies:', error)
    technologies = []
  }

  broadcastProgress(projectId, createProgress('detecting-patterns', 'Detecting patterns...', 40))

  // Detect patterns
  let patterns: DetectedPattern[]
  try {
    patterns = await detectPatterns(projectPath)
    logger.debug('[ProjectAnalyzer] Detected patterns:', patterns.length)
  } catch (error) {
    console.error('[ProjectAnalyzer] Error detecting patterns:', error)
    patterns = []
  }

  broadcastProgress(
    projectId,
    createProgress('generating-recommendations', 'Generating skill recommendations...', 70)
  )

  // Skill recommendations removed - skills feature has been removed from the codebase
  const recommendations: SkillRecommendation[] = []

  // Generate summary
  const summary = generateSummary(technologies, patterns, recommendations)

  // Create analysis result
  const analysis = createProjectAnalysis(projectId, projectPath, {
    technologies,
    patterns,
    recommendations,
    summary
  })

  // Cache the result
  analysisCache.set(projectId, { analysis, timestamp: Date.now() })

  broadcastProgress(projectId, createProgress('complete', 'Analysis complete', 100))

  return analysis
}

/**
 * Detect technologies for a project
 * @param projectPath The local filesystem path to the project
 */
export async function detectProjectTechnologies(projectPath: string): Promise<DetectedTechnology[]> {
  if (!projectPath) {
    throw new Error(`Project path not provided.`)
  }

  return detectTechnologies(projectPath)
}

/**
 * Detect patterns for a project
 * @param projectPath The local filesystem path to the project
 */
export async function detectProjectPatterns(projectPath: string): Promise<DetectedPattern[]> {
  if (!projectPath) {
    throw new Error(`Project path not provided.`)
  }

  return detectPatterns(projectPath)
}

/**
 * Get skill recommendations for a project
 *
 * Uses cached analysis - throws if not available
 */
export function getProjectRecommendations(projectId: string): SkillRecommendation[] {
  const cached = getCachedAnalysis(projectId)
  if (!cached) {
    throw new Error('No analysis found. Please run analysis first.')
  }
  return cached.recommendations
}

/**
 * Create Claude skills from selected recommendations
 *
 * This function creates skill files in the project's .claude/skills/ directory
 * @param projectId - The project ID (used to get cached analysis)
 * @param recommendationIds - The recommendation IDs to create skills from
 * @param createSkillFn - Callback to create a skill (receives skill data, returns the created skill)
 */
export async function createSkillsFromRecommendations(
  _projectId: string,
  _recommendationIds: string[],
  _createSkillFn: (data: any) => Promise<any>
): Promise<any[]> {
  // Skills feature has been removed from the codebase
  throw new Error('Skills feature has been removed from the codebase')
}

/**
 * Update recommendations selection state
 */
export function updateRecommendationSelection(
  projectId: string,
  recommendationId: string,
  selected: boolean
): ProjectAnalysis | null {
  const cached = analysisCache.get(projectId)
  if (!cached) return null

  const rec = cached.analysis.recommendations.find((r) => r.id === recommendationId)
  if (rec) {
    rec.selected = selected
  }

  return cached.analysis
}

/**
 * Select/deselect all recommendations
 */
export function selectAllRecommendations(
  projectId: string,
  selected: boolean
): ProjectAnalysis | null {
  const cached = analysisCache.get(projectId)
  if (!cached) return null

  for (const rec of cached.analysis.recommendations) {
    rec.selected = selected
  }

  return cached.analysis
}

/**
 * Get selected recommendation IDs
 */
export function getSelectedRecommendationIds(projectId: string): string[] {
  const cached = analysisCache.get(projectId)
  if (!cached) return []

  return cached.analysis.recommendations.filter((r) => r.selected).map((r) => r.id)
}
