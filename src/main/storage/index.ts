/**
 * Storage layer for Nightshift
 * Provides access to all SQLite-based storage operations
 */

import { getRequiredDirs } from '@main/utils/paths'
import { ensureDir } from './file-store'
import {
  initializeDatabase,
  closeDatabase,
  isDatabaseInitialized,
  getDatabaseStats,
  getDatabasePath,
  getDatabase,
  runTransaction
} from './database'
import { ensureSchema, hasSchema } from './migrations'
import { logger } from '@main/utils/logger'

// Re-export SQLite-based stores
export * from './sqlite/config-store'
export * from './sqlite/local-state-store'
export * from './sqlite/project-store'
export * from './sqlite/task-store'
export * from './sqlite/memory-store'
export * from './sqlite/secure-store'

// Re-export file-store for log operations
export { ensureDir, appendToFile, readText, fileExists } from './file-store'

// Re-export database utilities
export {
  initializeDatabase,
  closeDatabase,
  isDatabaseInitialized,
  getDatabaseStats,
  getDatabasePath,
  getDatabase,
  runTransaction
}

/**
 * Initialize the storage layer
 * Creates required directories, initializes SQLite, and migrates from JSON if needed
 */
export async function initializeStorage(): Promise<void> {
  // Create required directories (for log files)
  const dirs = getRequiredDirs()
  for (const dir of dirs) {
    await ensureDir(dir)
  }

  // Initialize SQLite database
  const db = initializeDatabase()

  // Ensure schema is up to date (handles fresh installs and migrations)
  ensureSchema(db)

  const dbHasData = hasSchema(db)
  if (dbHasData) {
    logger.debug('[Storage] Using existing database')
  } else {
    logger.debug('[Storage] Created fresh database')
  }
}

/**
 * Storage initialization status
 */
export interface StorageStatus {
  initialized: boolean
  configLoaded: boolean
  localStateLoaded: boolean
  projectCount: number
  groupCount: number
  taskCount: number
  databasePath: string
  error: string | null
}

/**
 * Get storage status for debugging
 */
export async function getStorageStatus(): Promise<StorageStatus> {
  try {
    // Import here to avoid circular dependencies
    const { loadConfig } = await import('./sqlite/config-store')
    const { loadLocalState } = await import('./sqlite/local-state-store')
    const { loadProjects } = await import('./sqlite/project-store')
    const { loadAllTasks } = await import('./sqlite/task-store')

    const config = await loadConfig()
    const localState = await loadLocalState()
    const projects = await loadProjects()
    const tasks = await loadAllTasks()

    return {
      initialized: isDatabaseInitialized(),
      configLoaded: !!config,
      localStateLoaded: !!localState,
      projectCount: projects.length,
      groupCount: 0, // Deprecated - groups migrated to tags
      taskCount: tasks.length,
      databasePath: getDatabasePath(),
      error: null
    }
  } catch (error) {
    return {
      initialized: false,
      configLoaded: false,
      localStateLoaded: false,
      projectCount: 0,
      groupCount: 0,
      taskCount: 0,
      databasePath: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Shutdown storage layer
 * Call this on app quit to properly close database
 */
export function shutdownStorage(): void {
  closeDatabase()
  logger.debug('[Storage] Shutdown complete')
}
