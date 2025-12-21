/**
 * Migration 002: Add Notes
 *
 * Creates notes table with full-text search support.
 */

import type { Database } from 'better-sqlite3'
import type { Migration } from '../types'

export const migration: Migration = {
  version: 2,
  name: 'add_notes',

  up(db: Database): void {
    // Create notes table
    db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
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

    // Create indexes
    db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status)`)
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned) WHERE is_pinned = 1`
    )
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_notes_primary_project ON notes(primary_project_id)`
    )
    db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC)`)

    // Create FTS table
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        id UNINDEXED,
        title,
        content,
        tags,
        content='notes',
        content_rowid='rowid'
      )
    `)

    // Create FTS triggers
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(rowid, id, title, content, tags)
        VALUES (new.rowid, new.id, new.title, new.content, new.tags);
      END
    `)

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, id, title, content, tags)
        VALUES ('delete', old.rowid, old.id, old.title, old.content, old.tags);
      END
    `)

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, id, title, content, tags)
        VALUES ('delete', old.rowid, old.id, old.title, old.content, old.tags);
        INSERT INTO notes_fts(rowid, id, title, content, tags)
        VALUES (new.rowid, new.id, new.title, new.content, new.tags);
      END
    `)
  },

  down(db: Database): void {
    // Drop triggers first
    db.exec(`DROP TRIGGER IF EXISTS notes_au`)
    db.exec(`DROP TRIGGER IF EXISTS notes_ad`)
    db.exec(`DROP TRIGGER IF EXISTS notes_ai`)

    // Drop FTS table
    db.exec(`DROP TABLE IF EXISTS notes_fts`)

    // Drop indexes
    db.exec(`DROP INDEX IF EXISTS idx_notes_updated`)
    db.exec(`DROP INDEX IF EXISTS idx_notes_primary_project`)
    db.exec(`DROP INDEX IF EXISTS idx_notes_pinned`)
    db.exec(`DROP INDEX IF EXISTS idx_notes_status`)

    // Drop table
    db.exec(`DROP TABLE IF EXISTS notes`)
  }
}
