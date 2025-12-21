/**
 * Migration 003: Add Thinking Mode
 *
 * Adds thinking_mode column to tasks table for extended thinking support.
 */

import type { Database } from 'better-sqlite3'
import type { Migration } from '../types'

export const migration: Migration = {
  version: 3,
  name: 'add_thinking_mode',

  up(db: Database): void {
    // Add thinking_mode column (nullable, null = use global default)
    db.exec(`ALTER TABLE tasks ADD COLUMN thinking_mode INTEGER`)
  },

  down(db: Database): void {
    // SQLite doesn't support DROP COLUMN easily before 3.35.0
    // For rollback, we recreate the table without the column

    // Create new table without thinking_mode
    db.exec(`
      CREATE TABLE tasks_rollback (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        group_id TEXT,
        title TEXT,
        prompt TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        queue_position INTEGER NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual',
        source_ref TEXT,
        context_files TEXT NOT NULL DEFAULT '[]',
        include_claude_md INTEGER NOT NULL DEFAULT 1,
        enabled_skills TEXT NOT NULL DEFAULT '[]',
        agent_id TEXT,
        model TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        exit_code INTEGER,
        error_message TEXT,
        cost_estimate REAL,
        runtime_ms INTEGER NOT NULL DEFAULT 0,
        running_session_started_at TEXT,
        current_iteration INTEGER NOT NULL DEFAULT 1,
        iterations TEXT NOT NULL DEFAULT '[]',
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
      )
    `)

    // Copy data (excluding thinking_mode)
    db.exec(`
      INSERT INTO tasks_rollback
      SELECT
        id, project_id, group_id, title, prompt, status, queue_position,
        source, source_ref, context_files, include_claude_md, enabled_skills,
        agent_id, model, created_at, started_at, completed_at,
        exit_code, error_message, cost_estimate, runtime_ms,
        running_session_started_at, current_iteration, iterations
      FROM tasks
    `)

    // Drop old table and rename
    db.exec(`DROP TABLE tasks`)
    db.exec(`ALTER TABLE tasks_rollback RENAME TO tasks`)

    // Recreate indexes
    db.exec(`CREATE INDEX idx_tasks_status ON tasks(status)`)
    db.exec(`CREATE INDEX idx_tasks_queue ON tasks(status, queue_position) WHERE status = 'queued'`)
    db.exec(`CREATE INDEX idx_tasks_project_status ON tasks(project_id, status)`)
  }
}
