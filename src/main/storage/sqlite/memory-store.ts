/**
 * SQLite Project Memory Store
 *
 * High-performance project memory storage using SQLite.
 * Maintains same API as the file-based memory store for compatibility.
 */

import type {
  ProjectMemory,
  MemoryEntry,
  MemoryCategory,
  CodebaseStructure
} from '@shared/types'
import {
  createProjectMemory,
  createMemoryEntry,
  MAX_RECENT_TASKS,
  MAX_ENTRIES_PER_CATEGORY,
  CONFIDENCE_DECAY_PER_DAY,
  MIN_CONFIDENCE_THRESHOLD
} from '@shared/types'
import type { TaskSummary } from '@shared/types/project-memory'
import { getDatabase } from '../database'

// ============ Type Conversions ============

interface MemoryRow {
  project_id: string
  version: number
  entries: string
  recent_tasks: string
  structure: string | null
  last_session_id: string | null
  last_compacted_at: string
  stats: string
}

function rowToMemory(row: MemoryRow): ProjectMemory {
  return {
    projectId: row.project_id,
    version: row.version,
    entries: JSON.parse(row.entries),
    recentTasks: JSON.parse(row.recent_tasks),
    structure: row.structure ? JSON.parse(row.structure) : null,
    lastSessionId: row.last_session_id,
    lastCompactedAt: row.last_compacted_at,
    stats: JSON.parse(row.stats)
  }
}

function memoryToParams(memory: ProjectMemory): Record<string, unknown> {
  return {
    project_id: memory.projectId,
    version: memory.version,
    entries: JSON.stringify(memory.entries),
    recent_tasks: JSON.stringify(memory.recentTasks),
    structure: memory.structure ? JSON.stringify(memory.structure) : null,
    last_session_id: memory.lastSessionId,
    last_compacted_at: memory.lastCompactedAt,
    stats: JSON.stringify(memory.stats)
  }
}

// ============ Helper Functions ============

/**
 * Apply confidence decay based on time since last confirmation
 */
function applyConfidenceDecay(memory: ProjectMemory): ProjectMemory {
  const now = Date.now()

  memory.entries = memory.entries.map((entry) => {
    const lastConfirmed = new Date(entry.lastConfirmedAt).getTime()
    const daysSinceConfirmed = (now - lastConfirmed) / (1000 * 60 * 60 * 24)
    const decay = daysSinceConfirmed * CONFIDENCE_DECAY_PER_DAY
    const newConfidence = Math.max(0, entry.confidence - decay)

    return {
      ...entry,
      confidence: newConfidence
    }
  })

  return memory
}

/**
 * Check if two content strings are similar
 */
function isSimilarContent(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const normA = normalize(a)
  const normB = normalize(b)

  if (normA === normB) return true
  if (normA.includes(normB) || normB.includes(normA)) return true

  const wordsA = new Set(normA.split(' '))
  const wordsB = new Set(normB.split(' '))
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)))
  const union = new Set([...wordsA, ...wordsB])

  return intersection.size / union.size > 0.6
}

// ============ Core Operations ============

/**
 * Load project memory, creating default if it doesn't exist
 */
export async function loadProjectMemory(projectId: string): Promise<ProjectMemory> {
  const db = getDatabase()
  const row = db
    .prepare('SELECT * FROM project_memory WHERE project_id = ?')
    .get(projectId) as MemoryRow | undefined

  if (row) {
    return applyConfidenceDecay(rowToMemory(row))
  }

  return createProjectMemory(projectId)
}

/**
 * Save project memory
 */
export async function saveProjectMemory(memory: ProjectMemory): Promise<void> {
  const db = getDatabase()
  const params = memoryToParams(memory)

  db.prepare(`
    INSERT OR REPLACE INTO project_memory (
      project_id, version, entries, recent_tasks, structure,
      last_session_id, last_compacted_at, stats
    ) VALUES (
      @project_id, @version, @entries, @recent_tasks, @structure,
      @last_session_id, @last_compacted_at, @stats
    )
  `).run(params)
}

/**
 * Check if project has memory
 */
export async function hasProjectMemory(projectId: string): Promise<boolean> {
  const db = getDatabase()
  const row = db
    .prepare('SELECT 1 FROM project_memory WHERE project_id = ?')
    .get(projectId)

  return row !== undefined
}

/**
 * Add a memory entry to a project
 */
export async function addMemoryEntry(
  projectId: string,
  category: MemoryCategory,
  content: string,
  source: string
): Promise<MemoryEntry> {
  const memory = await loadProjectMemory(projectId)
  const entry = createMemoryEntry(category, content, source)

  // Check if similar entry exists
  const existingIndex = memory.entries.findIndex(
    (e) => e.category === category && isSimilarContent(e.content, content)
  )

  if (existingIndex >= 0) {
    const existing = memory.entries[existingIndex]
    memory.entries[existingIndex] = {
      ...existing,
      content,
      confidence: Math.min(1.0, existing.confidence + 0.1),
      lastConfirmedAt: new Date().toISOString(),
      useCount: existing.useCount + 1
    }
  } else {
    memory.entries.push(entry)

    // Enforce per-category limits
    const categoryEntries = memory.entries.filter((e) => e.category === category)
    if (categoryEntries.length > MAX_ENTRIES_PER_CATEGORY) {
      const toRemove = categoryEntries
        .sort((a, b) => a.confidence - b.confidence)
        .slice(0, categoryEntries.length - MAX_ENTRIES_PER_CATEGORY)
        .map((e) => e.id)

      memory.entries = memory.entries.filter((e) => !toRemove.includes(e.id))
      memory.stats.totalEntriesExpired += toRemove.length
    }

    memory.stats.totalEntriesCreated++
  }

  memory.stats.lastUsedAt = new Date().toISOString()
  await saveProjectMemory(memory)

  return existingIndex >= 0 ? memory.entries[existingIndex] : entry
}

/**
 * Add a task summary to recent tasks
 */
export async function addTaskSummary(
  projectId: string,
  summary: TaskSummary
): Promise<void> {
  const memory = await loadProjectMemory(projectId)

  memory.recentTasks.unshift(summary)

  if (memory.recentTasks.length > MAX_RECENT_TASKS) {
    memory.recentTasks = memory.recentTasks.slice(0, MAX_RECENT_TASKS)
  }

  memory.stats.lastUsedAt = new Date().toISOString()
  await saveProjectMemory(memory)
}

/**
 * Update codebase structure
 */
export async function updateCodebaseStructure(
  projectId: string,
  structure: CodebaseStructure
): Promise<void> {
  const memory = await loadProjectMemory(projectId)
  memory.structure = {
    ...structure,
    lastUpdated: new Date().toISOString()
  }
  memory.stats.lastUsedAt = new Date().toISOString()
  await saveProjectMemory(memory)
}

/**
 * Get memory entries by category
 */
export async function getEntriesByCategory(
  projectId: string,
  category: MemoryCategory
): Promise<MemoryEntry[]> {
  const memory = await loadProjectMemory(projectId)
  return memory.entries
    .filter((e) => e.category === category && e.confidence >= MIN_CONFIDENCE_THRESHOLD)
    .sort((a, b) => b.confidence - a.confidence)
}

/**
 * Get all high-confidence entries
 */
export async function getHighConfidenceEntries(
  projectId: string,
  minConfidence = 0.7
): Promise<MemoryEntry[]> {
  const memory = await loadProjectMemory(projectId)
  return memory.entries
    .filter((e) => e.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence)
}

/**
 * Build a condensed context prompt from project memory
 */
export async function buildMemoryContext(projectId: string): Promise<string> {
  const memory = await loadProjectMemory(projectId)
  const parts: string[] = []

  // Add codebase structure if available
  if (memory.structure) {
    parts.push('## Project Structure')
    if (memory.structure.directories.length > 0) {
      parts.push('Key directories:')
      for (const dir of memory.structure.directories.slice(0, 8)) {
        parts.push(`- ${dir.path}: ${dir.purpose}`)
      }
    }
    if (memory.structure.entryPoints.length > 0) {
      parts.push(`Entry points: ${memory.structure.entryPoints.join(', ')}`)
    }
  }

  // Add high-confidence knowledge organized by category
  const categories: MemoryCategory[] = [
    'conventions',
    'architecture',
    'gotchas',
    'testing',
    'dependencies'
  ]

  for (const category of categories) {
    const entries = memory.entries
      .filter((e) => e.category === category && e.confidence >= 0.6)
      .sort((a, b) => b.useCount - a.useCount)
      .slice(0, 5)

    if (entries.length > 0) {
      const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1)
      parts.push(`\n## ${categoryLabel}`)
      for (const entry of entries) {
        parts.push(`- ${entry.content}`)
      }
    }
  }

  // Add recent task context
  const recentAccepted = memory.recentTasks
    .filter((t) => t.wasAccepted)
    .slice(0, 3)

  if (recentAccepted.length > 0) {
    parts.push('\n## Recent Changes')
    for (const task of recentAccepted) {
      const files = task.modifiedFiles.slice(0, 3).join(', ')
      const moreFiles =
        task.modifiedFiles.length > 3
          ? ` (+${task.modifiedFiles.length - 3} more)`
          : ''
      parts.push(`- ${task.summary} (${files}${moreFiles})`)
    }
  }

  if (parts.length === 0) {
    return ''
  }

  return `# Project Memory (cached knowledge)

${parts.join('\n')}

Note: This is cached context from previous tasks. Verify critical details if uncertain.
`
}

/**
 * Store session ID for potential resumption
 */
export async function storeSessionId(
  projectId: string,
  sessionId: string
): Promise<void> {
  const memory = await loadProjectMemory(projectId)
  memory.lastSessionId = sessionId
  await saveProjectMemory(memory)
}

/**
 * Get last session ID for resumption
 */
export async function getLastSessionId(projectId: string): Promise<string | null> {
  const memory = await loadProjectMemory(projectId)
  return memory.lastSessionId
}

/**
 * Clear session ID
 */
export async function clearSessionId(projectId: string): Promise<void> {
  const memory = await loadProjectMemory(projectId)
  memory.lastSessionId = null
  await saveProjectMemory(memory)
}

/**
 * Compact memory by removing stale entries
 */
export async function compactMemory(projectId: string): Promise<number> {
  const memory = await loadProjectMemory(projectId)
  const before = memory.entries.length

  memory.entries = memory.entries.filter((e) => e.confidence >= MIN_CONFIDENCE_THRESHOLD)

  const removed = before - memory.entries.length
  memory.stats.totalEntriesExpired += removed
  memory.lastCompactedAt = new Date().toISOString()

  await saveProjectMemory(memory)
  return removed
}

/**
 * Clear all memory for a project
 */
export async function clearProjectMemory(projectId: string): Promise<void> {
  const memory = createProjectMemory(projectId)
  await saveProjectMemory(memory)
}

/**
 * Get memory statistics
 */
export async function getMemoryStats(
  projectId: string
): Promise<
  ProjectMemory['stats'] & {
    entryCount: number
    recentTaskCount: number
    hasStructure: boolean
    hasSessionId: boolean
  }
> {
  const memory = await loadProjectMemory(projectId)
  return {
    ...memory.stats,
    entryCount: memory.entries.length,
    recentTaskCount: memory.recentTasks.length,
    hasStructure: memory.structure !== null,
    hasSessionId: memory.lastSessionId !== null
  }
}
