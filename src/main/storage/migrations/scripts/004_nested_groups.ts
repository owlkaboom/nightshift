/**
 * Migration 004: Nested Groups
 *
 * Adds support for nested groups and project descriptions.
 */

import type { Database } from 'better-sqlite3'
import type { Migration } from '../types'

export const migration: Migration = {
  version: 4,
  name: 'nested_groups',

  up(db: Database): void {
    // Add parent_id column to groups for nesting
    db.exec(
      `ALTER TABLE groups ADD COLUMN parent_id TEXT REFERENCES groups(id) ON DELETE SET NULL`
    )

    // Create index for parent group lookups (tree traversal)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_groups_parent ON groups(parent_id)`)

    // Add description column to projects
    db.exec(`ALTER TABLE projects ADD COLUMN description TEXT`)
  },

  down(db: Database): void {
    // Recreate groups table without parent_id
    db.exec(`
      CREATE TABLE groups_rollback (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        icon TEXT,
        created_at TEXT NOT NULL
      )
    `)

    // Copy data (excluding parent_id)
    db.exec(`
      INSERT INTO groups_rollback (id, name, color, icon, created_at)
      SELECT id, name, color, icon, created_at
      FROM groups
    `)

    // Drop old table and rename
    db.exec(`DROP TABLE groups`)
    db.exec(`ALTER TABLE groups_rollback RENAME TO groups`)

    // Recreate projects table without description
    db.exec(`
      CREATE TABLE projects_rollback (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        git_url TEXT,
        default_branch TEXT,
        default_skills TEXT NOT NULL DEFAULT '[]',
        include_claude_md INTEGER NOT NULL DEFAULT 1,
        added_at TEXT NOT NULL,
        icon TEXT
      )
    `)

    // Copy data (excluding description)
    db.exec(`
      INSERT INTO projects_rollback
      SELECT id, name, git_url, default_branch, default_skills,
             include_claude_md, added_at, icon
      FROM projects
    `)

    // Drop old table and rename
    db.exec(`DROP TABLE projects`)
    db.exec(`ALTER TABLE projects_rollback RENAME TO projects`)

    // Recreate index
    db.exec(`CREATE INDEX idx_projects_git_url ON projects(git_url)`)
  }
}
