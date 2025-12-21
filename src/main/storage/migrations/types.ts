/**
 * Migration System Type Definitions
 *
 * Defines the interface for file-based TypeScript migrations.
 */

import type { Database } from 'better-sqlite3'

/**
 * Interface for a database migration
 *
 * Each migration represents a single schema change with forward (up)
 * and backward (down) transformations.
 */
export interface Migration {
  /**
   * Unique migration version number
   * Must be sequential and start from 1
   */
  version: number

  /**
   * Human-readable name for logging and identification
   * Should be descriptive but concise (e.g., 'add_notes', 'remove_task_title')
   */
  name: string

  /**
   * Apply the migration to the database
   *
   * This function should perform all schema changes needed to move
   * from version N-1 to version N.
   *
   * @param db - Better-sqlite3 database instance
   * @throws Error if migration fails
   */
  up(db: Database): void

  /**
   * Rollback the migration from the database
   *
   * This function should reverse all changes made by up(),
   * moving from version N to version N-1.
   *
   * Note: Some migrations may not be fully reversible (data loss).
   * In such cases, down() should do its best to restore structure
   * but may leave data empty.
   *
   * @param db - Better-sqlite3 database instance
   * @throws Error if rollback fails
   */
  down(db: Database): void
}

/**
 * Result of running a migration
 *
 * Returned by MigrationRunner to indicate success/failure
 */
export interface MigrationResult {
  /** Migration version number */
  version: number

  /** Migration name */
  name: string

  /** Direction the migration was run */
  direction: 'up' | 'down'

  /** Whether the migration succeeded */
  success: boolean

  /** Error message if migration failed */
  error?: string
}
