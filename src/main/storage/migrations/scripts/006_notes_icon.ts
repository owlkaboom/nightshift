/**
 * Migration 006: Notes Icon
 *
 * Adds icon column to notes table.
 */

import type { Database } from 'better-sqlite3'
import type { Migration } from '../types'

export const migration: Migration = {
  version: 6,
  name: 'notes_icon',

  up(db: Database): void {
    // Add icon column to notes
    db.exec(`ALTER TABLE notes ADD COLUMN icon TEXT`)
  },

  down(db: Database): void {
    // Recreate notes table without icon column
    db.exec(`
      CREATE TABLE notes_rollback (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        html_content TEXT NOT NULL DEFAULT '',
        excerpt TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        project_refs TEXT NOT NULL DEFAULT '[]',
        group_refs TEXT NOT NULL DEFAULT '[]',
        tags TEXT NOT NULL DEFAULT '[]',
        primary_project_id TEXT,
        linked_task_ids TEXT NOT NULL DEFAULT '[]',
        linked_planning_ids TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        word_count INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (primary_project_id) REFERENCES projects(id) ON DELETE SET NULL
      )
    `)

    // Copy data (excluding icon)
    db.exec(`
      INSERT INTO notes_rollback
      SELECT
        id, title, content, html_content, excerpt, status,
        project_refs, group_refs, tags, primary_project_id,
        linked_task_ids, linked_planning_ids,
        created_at, updated_at, is_pinned, word_count
      FROM notes
    `)

    // Drop old table and rename
    db.exec(`DROP TABLE notes`)
    db.exec(`ALTER TABLE notes_rollback RENAME TO notes`)

    // Recreate indexes
    db.exec(`CREATE INDEX idx_notes_status ON notes(status)`)
    db.exec(`CREATE INDEX idx_notes_pinned ON notes(is_pinned) WHERE is_pinned = 1`)
    db.exec(`CREATE INDEX idx_notes_primary_project ON notes(primary_project_id)`)
    db.exec(`CREATE INDEX idx_notes_updated ON notes(updated_at DESC)`)
  }
}
