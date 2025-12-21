/**
 * Migration Runner
 *
 * Executes database migrations in order, tracking state and handling rollbacks.
 */

import type { Database } from 'better-sqlite3'
import type { Migration, MigrationResult } from './types'
import { logger } from '@main/utils/logger'

/**
 * Manages and executes database migrations
 *
 * Handles:
 * - Running pending migrations (up)
 * - Rolling back migrations (down)
 * - Transaction management
 * - Version tracking
 */
export class MigrationRunner {
  private db: Database
  private migrations: Migration[]

  /**
   * Create a new migration runner
   *
   * @param db - Better-sqlite3 database instance
   * @param migrations - Array of migration definitions (will be sorted by version)
   */
  constructor(db: Database, migrations: Migration[]) {
    this.db = db
    this.migrations = migrations.sort((a, b) => a.version - b.version)
  }

  /**
   * Get current schema version from database
   *
   * @returns Current version number (0 if no schema exists)
   */
  getCurrentVersion(): number {
    try {
      const result = this.db
        .prepare('SELECT version FROM schema_version WHERE id = 1')
        .get() as { version: number } | undefined
      return result?.version ?? 0
    } catch {
      // Table doesn't exist yet
      return 0
    }
  }

  /**
   * Run all pending migrations up to a target version
   *
   * @param targetVersion - Version to migrate to (default: latest)
   * @returns Array of migration results
   */
  migrateUp(targetVersion?: number): MigrationResult[] {
    const currentVersion = this.getCurrentVersion()
    const target = targetVersion ?? this.getLatestVersion()
    const results: MigrationResult[] = []

    if (currentVersion === 0) {
      // Fresh database - ensure schema_version table exists
      this.ensureSchemaVersionTable()
    }

    // Find migrations that need to run
    const pendingMigrations = this.migrations.filter(
      (m) => m.version > currentVersion && m.version <= target
    )

    if (pendingMigrations.length === 0) {
      logger.debug('[MigrationRunner] No pending migrations')
      return results
    }

    logger.debug(
      `[MigrationRunner] Running ${pendingMigrations.length} migrations from v${currentVersion} to v${target}`
    )

    // Run each migration in order
    for (const migration of pendingMigrations) {
      const result = this.runMigration(migration, 'up')
      results.push(result)

      if (!result.success) {
        // Stop on first failure
        console.error(
          `[MigrationRunner] Migration failed, stopping at v${migration.version - 1}`
        )
        break
      }
    }

    return results
  }

  /**
   * Rollback migrations to a specific version
   *
   * @param targetVersion - Version to rollback to
   * @returns Array of migration results
   */
  migrateDown(targetVersion: number): MigrationResult[] {
    const currentVersion = this.getCurrentVersion()
    const results: MigrationResult[] = []

    if (targetVersion >= currentVersion) {
      logger.debug('[MigrationRunner] No migrations to rollback')
      return results
    }

    // Get migrations to rollback in reverse order
    const migrationsToRollback = this.migrations
      .filter((m) => m.version <= currentVersion && m.version > targetVersion)
      .sort((a, b) => b.version - a.version) // Reverse order

    logger.debug(
      `[MigrationRunner] Rolling back ${migrationsToRollback.length} migrations from v${currentVersion} to v${targetVersion}`
    )

    // Run each migration in reverse
    for (const migration of migrationsToRollback) {
      const result = this.runMigration(migration, 'down')
      results.push(result)

      if (!result.success) {
        // Stop on first failure
        console.error(
          `[MigrationRunner] Rollback failed, stopping at v${migration.version}`
        )
        break
      }
    }

    return results
  }

  /**
   * Run a single migration in a transaction
   *
   * @param migration - Migration to run
   * @param direction - Direction to run (up or down)
   * @returns Migration result
   */
  private runMigration(migration: Migration, direction: 'up' | 'down'): MigrationResult {
    const result: MigrationResult = {
      version: migration.version,
      name: migration.name,
      direction,
      success: false
    }

    logger.debug(
      `[MigrationRunner] Running ${direction}: ${migration.version}_${migration.name}`
    )

    try {
      // Run migration in a transaction
      this.db.exec('BEGIN TRANSACTION')

      if (direction === 'up') {
        migration.up(this.db)
        this.updateVersion(migration.version)
      } else {
        migration.down(this.db)
        // When rolling back, set version to previous migration
        this.updateVersion(migration.version - 1)
      }

      this.db.exec('COMMIT')
      result.success = true

      logger.debug(
        `[MigrationRunner] Completed ${direction}: ${migration.version}_${migration.name}`
      )
    } catch (error) {
      // Rollback on error
      this.db.exec('ROLLBACK')
      result.error = error instanceof Error ? error.message : String(error)
      console.error(
        `[MigrationRunner] Failed ${direction}: ${migration.version}_${migration.name}`,
        error
      )
    }

    return result
  }

  /**
   * Ensure schema_version table exists
   *
   * Creates the table if it doesn't exist and initializes it to version 0
   */
  private ensureSchemaVersionTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        version INTEGER NOT NULL,
        migrated_at TEXT NOT NULL
      )
    `)

    this.db
      .prepare(
        `
      INSERT OR IGNORE INTO schema_version (id, version, migrated_at)
      VALUES (1, 0, ?)
    `
      )
      .run(new Date().toISOString())
  }

  /**
   * Update the schema version in the database
   *
   * @param version - New version number
   */
  private updateVersion(version: number): void {
    this.db
      .prepare(
        `
      UPDATE schema_version
      SET version = ?, migrated_at = ?
      WHERE id = 1
    `
      )
      .run(version, new Date().toISOString())
  }

  /**
   * Get the latest migration version
   *
   * @returns Highest migration version number
   */
  private getLatestVersion(): number {
    return Math.max(...this.migrations.map((m) => m.version), 0)
  }
}
