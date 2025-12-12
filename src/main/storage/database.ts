/**
 * SQLite Database Connection Manager
 *
 * Manages the SQLite database connection for Nightshift.
 * Uses better-sqlite3 for synchronous, high-performance operations.
 */

import Database from 'better-sqlite3'
import { join } from 'path'
import { getAppDataDir } from '../utils/paths'

const DB_FILENAME = 'nightshift.db'

let db: Database.Database | null = null

/**
 * Get the database file path
 */
export function getDatabasePath(): string {
  return join(getAppDataDir(), DB_FILENAME)
}

/**
 * Get the database instance
 * Throws if database is not initialized
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.')
  }
  return db
}

/**
 * Check if database is initialized
 */
export function isDatabaseInitialized(): boolean {
  return db !== null
}

/**
 * Initialize the database connection
 * Creates the database file if it doesn't exist
 */
export function initializeDatabase(): Database.Database {
  if (db) {
    return db
  }

  const dbPath = getDatabasePath()

  db = new Database(dbPath, {
    // Verbose mode can be enabled for debugging
    // verbose: console.log
  })

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL')

  // Enable foreign keys
  db.pragma('foreign_keys = ON')

  // Optimize for performance
  db.pragma('synchronous = NORMAL')
  db.pragma('cache_size = -64000') // 64MB cache
  db.pragma('temp_store = MEMORY')

  console.log('[Database] Initialized at:', dbPath)

  return db
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    console.log('[Database] Connection closed')
  }
}

/**
 * Run a function within a transaction
 * Automatically rolls back on error
 */
export function runTransaction<T>(fn: () => T): T {
  const database = getDatabase()
  return database.transaction(fn)()
}

/**
 * Check if database file exists
 */
export function databaseExists(): boolean {
  const fs = require('fs')
  return fs.existsSync(getDatabasePath())
}

/**
 * Get database statistics for debugging
 */
export function getDatabaseStats(): {
  path: string
  exists: boolean
  initialized: boolean
  walMode: boolean
  foreignKeys: boolean
} {
  const path = getDatabasePath()
  const exists = databaseExists()
  const initialized = isDatabaseInitialized()

  let walMode = false
  let foreignKeys = false

  if (initialized && db) {
    const journalMode = db.pragma('journal_mode', { simple: true })
    walMode = journalMode === 'wal'

    const fk = db.pragma('foreign_keys', { simple: true })
    foreignKeys = fk === 1
  }

  return {
    path,
    exists,
    initialized,
    walMode,
    foreignKeys
  }
}
