/**
 * Migration 017: Note Groups
 *
 * Adds note groups table and ordering columns to notes.
 */

import type { Database } from 'better-sqlite3'
import type { Migration } from '../types'

export const migration: Migration = {
  version: 17,
  name: 'note_groups',

  up(db: Database): void {
    // Create note_groups table
    db.exec(`
      CREATE TABLE IF NOT EXISTS note_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT,
        color TEXT,
        "order" INTEGER NOT NULL DEFAULT 0,
        is_collapsed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)

    // Index for ordering groups
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_note_groups_order ON note_groups("order")
    `)

    // Check if columns already exist before adding them
    const notesColumns = db.pragma('table_info(notes)') as Array<{ name: string }>
    const notesColumnNames = notesColumns.map((c) => c.name)

    if (!notesColumnNames.includes('group_id')) {
      db.exec(
        `ALTER TABLE notes ADD COLUMN group_id TEXT REFERENCES note_groups(id) ON DELETE SET NULL`
      )
    }

    if (!notesColumnNames.includes('order')) {
      db.exec(`ALTER TABLE notes ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0`)
    }

    // Create indexes for new columns
    db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_group ON notes(group_id)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_order ON notes("order")`)
  },

  down(db: Database): void {
    // Drop indexes first
    db.exec(`DROP INDEX IF EXISTS idx_notes_order`)
    db.exec(`DROP INDEX IF EXISTS idx_notes_group`)

    // Recreate notes table without group_id and order
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
        tag_refs TEXT NOT NULL DEFAULT '[]',
        tags TEXT NOT NULL DEFAULT '[]',
        primary_project_id TEXT,
        linked_task_ids TEXT NOT NULL DEFAULT '[]',
        linked_planning_ids TEXT NOT NULL DEFAULT '[]',
        icon TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        word_count INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (primary_project_id) REFERENCES projects(id) ON DELETE SET NULL
      )
    `)

    // Copy data (excluding group_id and order)
    db.exec(`
      INSERT INTO notes_rollback
      SELECT
        id, title, content, html_content, excerpt, status,
        project_refs, group_refs, tag_refs, tags, primary_project_id,
        linked_task_ids, linked_planning_ids, icon,
        created_at, updated_at, is_pinned, word_count
      FROM notes
    `)

    // Drop old table and rename
    db.exec(`DROP TABLE notes`)
    db.exec(`ALTER TABLE notes_rollback RENAME TO notes`)

    // Recreate original indexes
    db.exec(`CREATE INDEX idx_notes_status ON notes(status)`)
    db.exec(`CREATE INDEX idx_notes_pinned ON notes(is_pinned) WHERE is_pinned = 1`)
    db.exec(`CREATE INDEX idx_notes_primary_project ON notes(primary_project_id)`)
    db.exec(`CREATE INDEX idx_notes_updated ON notes(updated_at DESC)`)

    // Drop note_groups table
    db.exec(`DROP INDEX IF EXISTS idx_note_groups_order`)
    db.exec(`DROP TABLE IF EXISTS note_groups`)
  }
}
