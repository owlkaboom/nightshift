/**
 * Project Analysis types for Nightshift
 *
 * Provides types for analyzing project codebases to detect technologies,
 * patterns, and suggest appropriate Claude Code skills.
 */

/**
 * Technology category classification
 */
export type TechCategory =
  | 'language' // TypeScript, Python, Go, Rust
  | 'framework' // React, Next.js, Express, FastAPI
  | 'library' // lodash, axios, zod
  | 'tool' // ESLint, Prettier, Jest, Vitest
  | 'platform' // Node.js, Deno, Bun
  | 'database' // PostgreSQL, MongoDB, SQLite
  | 'infrastructure' // Docker, Kubernetes, Terraform
  | 'ci-cd' // GitHub Actions, CircleCI

/**
 * Detected technology in a project
 */
export interface DetectedTechnology {
  /** Technology category */
  category: TechCategory

  /** Technology name (e.g., "TypeScript", "React") */
  name: string

  /** Version if detected */
  version?: string

  /** Confidence level (0-1) based on signals */
  confidence: number

  /** What indicated this technology (package.json, file patterns, etc.) */
  signals: string[]
}

/**
 * Detected coding pattern/practice in a project
 */
export interface DetectedPattern {
  /** Pattern identifier */
  id: string

  /** Pattern name */
  name: string

  /** Description of the pattern */
  description: string

  /** Confidence level (0-1) */
  confidence: number

  /** File paths or code snippets demonstrating the pattern */
  examples: string[]
}

/**
 * Priority level for skill recommendations
 */
export type SkillPriority = 'high' | 'medium' | 'low'

/**
 * Skill recommendation based on analysis
 */
export interface SkillRecommendation {
  /** Unique recommendation identifier */
  id: string

  /** Suggested skill name */
  name: string

  /** Description of what the skill provides */
  description: string

  /** Why this skill is recommended */
  reason: string

  /** Priority level */
  priority: SkillPriority

  /** The suggested prompt content for the skill */
  suggestedPrompt: string

  /** Which technologies/patterns triggered this recommendation */
  basedOn: string[]

  /** Whether this recommendation was selected by user */
  selected?: boolean
}

/**
 * Complete project analysis result
 */
export interface ProjectAnalysis {
  /** Project identifier */
  projectId: string

  /** Project path that was analyzed */
  projectPath: string

  /** When the analysis was performed (ISO string) */
  analyzedAt: string

  /** Detected technologies */
  technologies: DetectedTechnology[]

  /** Detected coding patterns */
  patterns: DetectedPattern[]

  /** Skill recommendations based on analysis */
  recommendations: SkillRecommendation[]

  /** Summary of the project analysis */
  summary?: string
}

/**
 * Status of an analysis operation
 */
export type AnalysisStatus =
  | 'idle'
  | 'detecting-technologies'
  | 'detecting-patterns'
  | 'generating-recommendations'
  | 'complete'
  | 'error'

/**
 * Analysis progress update
 */
export interface AnalysisProgress {
  /** Current status */
  status: AnalysisStatus

  /** Progress message */
  message: string

  /** Progress percentage (0-100) */
  progress: number
}

/**
 * Skill template for mapping technologies to skills
 */
export interface SkillTemplate {
  /** Technology name this template is for */
  technology: string

  /** Skill name */
  name: string

  /** Short description */
  description: string

  /** The prompt template content */
  promptTemplate: string

  /** Default priority when recommending */
  defaultPriority: SkillPriority

  /** Related technologies that strengthen this recommendation */
  relatedTechnologies?: string[]
}

/**
 * Package file analysis result
 */
export interface PackageAnalysis {
  /** Package manager type */
  type: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'cargo' | 'go' | 'maven' | 'gradle' | 'composer' | 'bundler'

  /** Path to the package file */
  path: string

  /** Dependencies detected */
  dependencies: Array<{
    name: string
    version?: string
    isDev: boolean
  }>
}

/**
 * Config file detection result
 */
export interface ConfigFileAnalysis {
  /** Config file path */
  path: string

  /** What technology/tool this config is for */
  forTechnology: string

  /** Confidence that this indicates the technology is used */
  confidence: number
}

/**
 * File pattern analysis result
 */
export interface FilePatternAnalysis {
  /** Pattern that matched */
  pattern: string

  /** Files that matched */
  matchingFiles: string[]

  /** What technology this indicates */
  indicatesTechnology: string

  /** Confidence level */
  confidence: number
}

/**
 * Data for creating skills from recommendations
 */
export interface CreateSkillsFromRecommendationsData {
  /** Project ID */
  projectId: string

  /** Recommendation IDs to create skills from */
  recommendationIds: string[]
}

/**
 * Generate a unique analysis ID
 */
export function generateAnalysisId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 7)
  return `analysis_${timestamp}${random}`
}

/**
 * Generate a unique recommendation ID
 */
export function generateRecommendationId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 7)
  return `rec_${timestamp}${random}`
}

/**
 * Generate a unique pattern ID
 */
export function generatePatternId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 7)
  return `pattern_${timestamp}${random}`
}

/**
 * Create a new project analysis result
 */
export function createProjectAnalysis(
  projectId: string,
  projectPath: string,
  options: Partial<ProjectAnalysis> = {}
): ProjectAnalysis {
  return {
    projectId,
    projectPath,
    analyzedAt: new Date().toISOString(),
    technologies: [],
    patterns: [],
    recommendations: [],
    ...options
  }
}

/**
 * Create a skill recommendation
 */
export function createSkillRecommendation(
  name: string,
  description: string,
  suggestedPrompt: string,
  options: Partial<SkillRecommendation> = {}
): SkillRecommendation {
  return {
    id: generateRecommendationId(),
    name,
    description,
    reason: '',
    priority: 'medium',
    suggestedPrompt,
    basedOn: [],
    selected: false,
    ...options
  }
}

/**
 * Create a detected pattern
 */
export function createDetectedPattern(
  name: string,
  description: string,
  options: Partial<DetectedPattern> = {}
): DetectedPattern {
  return {
    id: generatePatternId(),
    name,
    description,
    confidence: 0.5,
    examples: [],
    ...options
  }
}

/**
 * Get human-readable label for a technology category
 */
export function getTechCategoryLabel(category: TechCategory): string {
  switch (category) {
    case 'language':
      return 'Language'
    case 'framework':
      return 'Framework'
    case 'library':
      return 'Library'
    case 'tool':
      return 'Tool'
    case 'platform':
      return 'Platform'
    case 'database':
      return 'Database'
    case 'infrastructure':
      return 'Infrastructure'
    case 'ci-cd':
      return 'CI/CD'
    default:
      return category
  }
}

/**
 * Get human-readable label for skill priority
 */
export function getSkillPriorityLabel(priority: SkillPriority): string {
  switch (priority) {
    case 'high':
      return 'High Priority'
    case 'medium':
      return 'Medium Priority'
    case 'low':
      return 'Low Priority'
    default:
      return priority
  }
}

/**
 * Sort technologies by confidence (descending)
 */
export function sortTechnologiesByConfidence(
  technologies: DetectedTechnology[]
): DetectedTechnology[] {
  return [...technologies].sort((a, b) => b.confidence - a.confidence)
}

/**
 * Sort recommendations by priority
 */
export function sortRecommendationsByPriority(
  recommendations: SkillRecommendation[]
): SkillRecommendation[] {
  const priorityOrder: Record<SkillPriority, number> = {
    high: 0,
    medium: 1,
    low: 2
  }
  return [...recommendations].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  )
}

/**
 * Filter technologies by minimum confidence
 */
export function filterByConfidence(
  technologies: DetectedTechnology[],
  minConfidence: number
): DetectedTechnology[] {
  return technologies.filter((t) => t.confidence >= minConfidence)
}

/**
 * Group technologies by category
 */
export function groupTechnologiesByCategory(
  technologies: DetectedTechnology[]
): Record<TechCategory, DetectedTechnology[]> {
  const groups: Record<TechCategory, DetectedTechnology[]> = {
    language: [],
    framework: [],
    library: [],
    tool: [],
    platform: [],
    database: [],
    infrastructure: [],
    'ci-cd': []
  }

  for (const tech of technologies) {
    groups[tech.category].push(tech)
  }

  return groups
}
