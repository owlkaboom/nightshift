/**
 * Migration System Entry Point
 *
 * Provides the main interface for database schema migrations.
 */

import type { Database } from 'better-sqlite3'
import { MigrationRunner } from './runner'
import { migrations } from './scripts'
import { logger } from '@main/utils/logger'

// Re-export types and runner for external use
export { MigrationRunner } from './runner'
export type { Migration, MigrationResult } from './types'

/**
 * Current schema version (latest migration)
 */
export const SCHEMA_VERSION = Math.max(...migrations.map((m) => m.version), 0)

/**
 * Ensure database schema is up to date
 *
 * Runs all pending migrations to bring the database to the current schema version.
 * Safe to call multiple times - will only run migrations that haven't been applied yet.
 *
 * @param db - Better-sqlite3 database instance
 * @throws Error if any migration fails
 */
export function ensureSchema(db: Database): void {
  const runner = new MigrationRunner(db, migrations)
  const currentVersion = runner.getCurrentVersion()

  logger.debug(
    `[Schema] Current version: ${currentVersion}, Target: ${SCHEMA_VERSION}`
  )

  if (currentVersion < SCHEMA_VERSION) {
    const results = runner.migrateUp()

    const failed = results.find((r) => !r.success)
    if (failed) {
      throw new Error(
        `Migration ${failed.version}_${failed.name} failed: ${failed.error}`
      )
    }

    logger.debug(`[Schema] Ran ${results.length} migrations successfully`)
  } else {
    logger.debug('[Schema] Database is up to date')
  }
}

/**
 * Get current schema version from database
 *
 * @param db - Better-sqlite3 database instance
 * @returns Current schema version (0 if database not initialized)
 */
export function getSchemaVersion(db: Database): number {
  const runner = new MigrationRunner(db, migrations)
  return runner.getCurrentVersion()
}

/**
 * Check if database has been initialized with schema
 *
 * @param db - Better-sqlite3 database instance
 * @returns True if database has schema, false otherwise
 */
export function hasSchema(db: Database): boolean {
  return getSchemaVersion(db) > 0
}

/**
 * Verify that all expected columns exist in the database
 *
 * This is a sanity check to ensure migrations ran correctly.
 * Use after running migrations to verify schema integrity.
 *
 * @param db - Better-sqlite3 database instance
 * @returns Object with validation status and any errors found
 */
export function verifySchema(db: Database): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  try {
    // Verify tasks table columns
    const taskColumns = db.pragma('table_info(tasks)') as Array<{ name: string }>
    const taskColumnNames = taskColumns.map((c) => c.name)

    const requiredTaskColumns = [
      'id',
      'project_id',
      'prompt',
      'status',
      'queue_position',
      'external_issue_id',
      'external_issue_url',
      'integration_id',
      'tag_ids',
      'thinking_mode',
      'session_id'
    ]

    for (const col of requiredTaskColumns) {
      if (!taskColumnNames.includes(col)) {
        errors.push(`Missing column in tasks table: ${col}`)
      }
    }

    // Verify projects table columns
    const projectColumns = db.pragma('table_info(projects)') as Array<{ name: string }>
    const projectColumnNames = projectColumns.map((c) => c.name)

    const requiredProjectColumns = [
      'id',
      'name',
      'git_url',
      'integration_ids',
      'tag_ids',
      'description',
      'path'
    ]

    for (const col of requiredProjectColumns) {
      if (!projectColumnNames.includes(col)) {
        errors.push(`Missing column in projects table: ${col}`)
      }
    }

    // Verify note_groups table exists
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>
    const tableNames = tables.map((t) => t.name)

    if (!tableNames.includes('note_groups')) {
      errors.push('Missing table: note_groups')
    }

    if (errors.length > 0) {
      console.error('[Schema] Verification failed:', errors)
      return { valid: false, errors }
    }

    logger.debug('[Schema] Verification passed - all expected columns exist')
    return { valid: true, errors: [] }
  } catch (error) {
    const errorMsg = `Verification error: ${error}`
    console.error('[Schema]', errorMsg)
    return { valid: false, errors: [errorMsg] }
  }
}
