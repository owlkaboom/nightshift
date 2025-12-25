/**
 * Migration 022: Remove Skills System
 *
 * Removes the deprecated skills system in favor of CLAUDE.md-based guidance.
 * - Drops skills table
 * - Removes enabled_skills column from tasks table
 * - Removes default_skills column from projects table
 *
 * Note: Uses ALTER TABLE DROP COLUMN (SQLite 3.35.0+, supported by better-sqlite3)
 */

import type { Database } from 'better-sqlite3'
import type { Migration } from '../types'

export const migration: Migration = {
  version: 22,
  name: 'remove_skills',

  up(db: Database): void {
    // Drop skills table if it exists
    db.exec(`DROP TABLE IF EXISTS skills`)

    // Remove enabled_skills column from tasks table if it exists
    const taskColumns = db.pragma('table_info(tasks)') as Array<{ name: string }>
    if (taskColumns.some((c) => c.name === 'enabled_skills')) {
      db.exec(`ALTER TABLE tasks DROP COLUMN enabled_skills`)
    }

    // Remove default_skills column from projects table if it exists
    const projectColumns = db.pragma('table_info(projects)') as Array<{ name: string }>
    if (projectColumns.some((c) => c.name === 'default_skills')) {
      db.exec(`ALTER TABLE projects DROP COLUMN default_skills`)
    }
  },

  down(db: Database): void {
    // Recreate skills table
    db.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        instructions TEXT NOT NULL,
        category TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0,
        is_builtin INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_skills_enabled ON skills(enabled)`)

    // Add enabled_skills back to tasks table
    const taskColumns = db.pragma('table_info(tasks)') as Array<{ name: string }>
    if (!taskColumns.some((c) => c.name === 'enabled_skills')) {
      db.exec(`ALTER TABLE tasks ADD COLUMN enabled_skills TEXT NOT NULL DEFAULT '[]'`)
    }

    // Add default_skills back to projects table
    const projectColumns = db.pragma('table_info(projects)') as Array<{ name: string }>
    if (!projectColumns.some((c) => c.name === 'default_skills')) {
      db.exec(`ALTER TABLE projects ADD COLUMN default_skills TEXT NOT NULL DEFAULT '[]'`)
    }
  }
}
