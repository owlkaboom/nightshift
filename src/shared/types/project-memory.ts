/**
 * Project Memory types for Nightshift
 *
 * Project memory stores accumulated knowledge about a project's codebase
 * to reduce token consumption by avoiding repeated discovery.
 */

/**
 * A learned fact about the project
 */
export interface MemoryEntry {
  /** Unique identifier */
  id: string

  /** Category of the memory entry */
  category: MemoryCategory

  /** The actual content/knowledge */
  content: string

  /** Confidence score (0-1) - how certain we are this is still accurate */
  confidence: number

  /** When this was first learned */
  createdAt: string

  /** When this was last confirmed/updated */
  lastConfirmedAt: string

  /** Number of times this knowledge was used/confirmed */
  useCount: number

  /** Source of this knowledge (task ID, auto-discovered, manual) */
  source: string
}

/**
 * Categories for organizing memory entries
 */
export type MemoryCategory =
  | 'structure'      // Codebase structure (directories, file patterns)
  | 'conventions'    // Code conventions (naming, patterns)
  | 'architecture'   // Architectural decisions
  | 'dependencies'   // Key dependencies and their usage
  | 'testing'        // Testing patterns and locations
  | 'build'          // Build and deployment info
  | 'gotchas'        // Common pitfalls or non-obvious behaviors

/**
 * Summary of recent task for context continuity
 */
export interface TaskSummary {
  /** Task ID */
  taskId: string

  /** Brief description of what was done */
  summary: string

  /** Files that were modified */
  modifiedFiles: string[]

  /** When the task completed */
  completedAt: string

  /** Whether the changes were accepted */
  wasAccepted: boolean
}

/**
 * Codebase structure snapshot
 */
export interface CodebaseStructure {
  /** Key directories and their purposes */
  directories: {
    path: string
    purpose: string
  }[]

  /** Important file patterns (e.g., glob patterns for tests) */
  filePatterns: {
    pattern: string
    description: string
  }[]

  /** Entry points and main files */
  entryPoints: string[]

  /** When this was last updated */
  lastUpdated: string
}

/**
 * Project memory stored in ~/.nightshift/memory/{projectId}/memory.json
 */
export interface ProjectMemory {
  /** Project ID this memory belongs to */
  projectId: string

  /** Schema version for migrations */
  version: number

  /** Accumulated knowledge entries */
  entries: MemoryEntry[]

  /** Recent task summaries for context continuity */
  recentTasks: TaskSummary[]

  /** Cached codebase structure */
  structure: CodebaseStructure | null

  /** Last Claude Code session ID for potential resumption */
  lastSessionId: string | null

  /** When memory was last cleaned/compacted */
  lastCompactedAt: string

  /** Statistics for monitoring */
  stats: {
    totalEntriesCreated: number
    totalEntriesExpired: number
    lastUsedAt: string
  }
}

/**
 * Create empty project memory
 */
export function createProjectMemory(projectId: string): ProjectMemory {
  const now = new Date().toISOString()
  return {
    projectId,
    version: 1,
    entries: [],
    recentTasks: [],
    structure: null,
    lastSessionId: null,
    lastCompactedAt: now,
    stats: {
      totalEntriesCreated: 0,
      totalEntriesExpired: 0,
      lastUsedAt: now
    }
  }
}

/**
 * Generate a unique memory entry ID
 */
export function generateMemoryEntryId(): string {
  return `mem_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Create a new memory entry
 */
export function createMemoryEntry(
  category: MemoryCategory,
  content: string,
  source: string
): MemoryEntry {
  const now = new Date().toISOString()
  return {
    id: generateMemoryEntryId(),
    category,
    content,
    confidence: 1.0,
    createdAt: now,
    lastConfirmedAt: now,
    useCount: 1,
    source
  }
}

/**
 * Maximum number of recent tasks to keep
 */
export const MAX_RECENT_TASKS = 10

/**
 * Maximum number of memory entries per category
 */
export const MAX_ENTRIES_PER_CATEGORY = 20

/**
 * Confidence decay rate per day of non-use
 */
export const CONFIDENCE_DECAY_PER_DAY = 0.05

/**
 * Minimum confidence before entry is considered stale
 */
export const MIN_CONFIDENCE_THRESHOLD = 0.3
