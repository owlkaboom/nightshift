/**
 * Migration 010: Project Tag IDs
 *
 * Adds tag_ids column to projects table.
 */

import type { Database } from 'better-sqlite3'
import type { Migration } from '../types'

export const migration: Migration = {
  version: 10,
  name: 'project_tag_ids',

  up(db: Database): void {
    // Add tag_ids column to projects
    db.exec(`ALTER TABLE projects ADD COLUMN tag_ids TEXT NOT NULL DEFAULT '[]'`)
  },

  down(db: Database): void {
    // Recreate projects table without tag_ids
    db.exec(`
      CREATE TABLE projects_rollback (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        git_url TEXT,
        default_branch TEXT,
        default_skills TEXT NOT NULL DEFAULT '[]',
        include_claude_md INTEGER NOT NULL DEFAULT 1,
        added_at TEXT NOT NULL,
        icon TEXT
      )
    `)

    // Copy data (excluding tag_ids)
    db.exec(`
      INSERT INTO projects_rollback
      SELECT
        id, name, description, git_url, default_branch,
        default_skills, include_claude_md, added_at, icon
      FROM projects
    `)

    // Drop old table and rename
    db.exec(`DROP TABLE projects`)
    db.exec(`ALTER TABLE projects_rollback RENAME TO projects`)

    // Recreate index
    db.exec(`CREATE INDEX idx_projects_git_url ON projects(git_url)`)
  }
}
