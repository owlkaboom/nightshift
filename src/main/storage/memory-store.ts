/**
 * Project Memory Store
 *
 * Manages persistent memory for projects to reduce token consumption
 * by caching learned knowledge about codebases.
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
import { getProjectMemoryPath, getProjectMemoryDir } from '@main/utils/paths'
import { readJson, writeJson, ensureDir, fileExists } from './file-store'

/**
 * Load project memory, creating default if it doesn't exist
 */
export async function loadProjectMemory(projectId: string): Promise<ProjectMemory> {
  const path = getProjectMemoryPath(projectId)
  const memory = await readJson<ProjectMemory>(path)

  if (memory) {
    // Apply confidence decay to entries
    return applyConfidenceDecay(memory)
  }

  return createProjectMemory(projectId)
}

/**
 * Save project memory
 */
export async function saveProjectMemory(memory: ProjectMemory): Promise<void> {
  await ensureDir(getProjectMemoryDir(memory.projectId))
  const path = getProjectMemoryPath(memory.projectId)
  await writeJson(path, memory)
}

/**
 * Check if project has memory
 */
export async function hasProjectMemory(projectId: string): Promise<boolean> {
  const path = getProjectMemoryPath(projectId)
  return fileExists(path)
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

  // Check if similar entry exists - update instead of duplicate
  const existingIndex = memory.entries.findIndex(
    (e) => e.category === category && isSimilarContent(e.content, content)
  )

  if (existingIndex >= 0) {
    // Update existing entry
    const existing = memory.entries[existingIndex]
    memory.entries[existingIndex] = {
      ...existing,
      content, // Update with new content
      confidence: Math.min(1.0, existing.confidence + 0.1), // Boost confidence
      lastConfirmedAt: new Date().toISOString(),
      useCount: existing.useCount + 1
    }
  } else {
    // Add new entry
    memory.entries.push(entry)

    // Enforce per-category limits
    const categoryEntries = memory.entries.filter((e) => e.category === category)
    if (categoryEntries.length > MAX_ENTRIES_PER_CATEGORY) {
      // Remove lowest confidence entries
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

  // Add to beginning of list
  memory.recentTasks.unshift(summary)

  // Enforce limit
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
 * This is the main function used to reduce token consumption
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

  // Add recent task context (last 3 accepted tasks)
  const recentAccepted = memory.recentTasks
    .filter((t) => t.wasAccepted)
    .slice(0, 3)

  if (recentAccepted.length > 0) {
    parts.push('\n## Recent Changes')
    for (const task of recentAccepted) {
      const files = task.modifiedFiles.slice(0, 3).join(', ')
      const moreFiles = task.modifiedFiles.length > 3 ? ` (+${task.modifiedFiles.length - 3} more)` : ''
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
 * Clear session ID (e.g., when context is invalidated)
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

  // Remove entries below confidence threshold
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
export async function getMemoryStats(projectId: string): Promise<ProjectMemory['stats'] & {
  entryCount: number
  recentTaskCount: number
  hasStructure: boolean
  hasSessionId: boolean
}> {
  const memory = await loadProjectMemory(projectId)
  return {
    ...memory.stats,
    entryCount: memory.entries.length,
    recentTaskCount: memory.recentTasks.length,
    hasStructure: memory.structure !== null,
    hasSessionId: memory.lastSessionId !== null
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
 * Check if two content strings are similar (simple heuristic)
 */
function isSimilarContent(a: string, b: string): boolean {
  // Normalize strings
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const normA = normalize(a)
  const normB = normalize(b)

  // Check for high overlap
  if (normA === normB) return true

  // Check if one contains the other
  if (normA.includes(normB) || normB.includes(normA)) return true

  // Simple word overlap check
  const wordsA = new Set(normA.split(' '))
  const wordsB = new Set(normB.split(' '))
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)))
  const union = new Set([...wordsA, ...wordsB])

  // Jaccard similarity > 0.6
  return intersection.size / union.size > 0.6
}
