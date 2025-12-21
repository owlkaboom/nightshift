/**
 * Migration 019: Rename Local Path
 *
 * Renames local_path to path in projects table.
 */

import type { Database } from 'better-sqlite3'
import type { Migration } from '../types'

export const migration: Migration = {
  version: 19,
  name: 'rename_local_path',

  up(db: Database): void {
    // Check if we need to do the rename
    const projectColumns = db.pragma('table_info(projects)') as Array<{ name: string }>
    const projectColumnNames = projectColumns.map((c) => c.name)

    if (projectColumnNames.includes('local_path') && !projectColumnNames.includes('path')) {
      // SQLite doesn't support RENAME COLUMN before 3.25.0, so we need to recreate the table

      // 1. Create new projects table with path instead of local_path
      db.exec(`
        CREATE TABLE projects_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          git_url TEXT,
          default_branch TEXT,
          default_skills TEXT NOT NULL DEFAULT '[]',
          include_claude_md INTEGER NOT NULL DEFAULT 1,
          tag_ids TEXT NOT NULL DEFAULT '[]',
          integration_ids TEXT NOT NULL DEFAULT '[]',
          added_at TEXT NOT NULL,
          icon TEXT,
          path TEXT
        )
      `)

      // 2. Copy data from old table
      db.exec(`
        INSERT INTO projects_new (
          id, name, description, git_url, default_branch, default_skills,
          include_claude_md, tag_ids, integration_ids, added_at, icon, path
        )
        SELECT
          id, name, description, git_url, default_branch, default_skills,
          include_claude_md, tag_ids, integration_ids, added_at, icon, local_path
        FROM projects
      `)

      // 3. Drop old table
      db.exec(`DROP TABLE projects`)

      // 4. Rename new table to original name
      db.exec(`ALTER TABLE projects_new RENAME TO projects`)

      // 5. Recreate index
      db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_git_url ON projects(git_url)`)
    } else if (projectColumnNames.includes('path')) {
      // Path column already exists, no action needed
      console.log('[Migration] path column already exists, skipping rename')
    } else {
      // Neither column exists, add path
      db.exec(`ALTER TABLE projects ADD COLUMN path TEXT`)
    }
  },

  down(db: Database): void {
    // Rename path back to local_path
    const projectColumns = db.pragma('table_info(projects)') as Array<{ name: string }>
    const projectColumnNames = projectColumns.map((c) => c.name)

    if (projectColumnNames.includes('path')) {
      // Create new projects table with local_path instead of path
      db.exec(`
        CREATE TABLE projects_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          git_url TEXT,
          default_branch TEXT,
          default_skills TEXT NOT NULL DEFAULT '[]',
          include_claude_md INTEGER NOT NULL DEFAULT 1,
          tag_ids TEXT NOT NULL DEFAULT '[]',
          integration_ids TEXT NOT NULL DEFAULT '[]',
          added_at TEXT NOT NULL,
          icon TEXT,
          local_path TEXT
        )
      `)

      // Copy data from old table
      db.exec(`
        INSERT INTO projects_new (
          id, name, description, git_url, default_branch, default_skills,
          include_claude_md, tag_ids, integration_ids, added_at, icon, local_path
        )
        SELECT
          id, name, description, git_url, default_branch, default_skills,
          include_claude_md, tag_ids, integration_ids, added_at, icon, path
        FROM projects
      `)

      // Drop old table
      db.exec(`DROP TABLE projects`)

      // Rename new table to original name
      db.exec(`ALTER TABLE projects_new RENAME TO projects`)

      // Recreate index
      db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_git_url ON projects(git_url)`)
    }
  }
}
