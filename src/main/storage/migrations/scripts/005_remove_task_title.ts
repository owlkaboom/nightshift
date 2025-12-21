/**
 * Migration 005: Remove Task Title
 *
 * Removes the title column from tasks, merging it into prompt.
 * This is a destructive migration - rollback will lose the original title separation.
 */

import type { Database } from 'better-sqlite3'
import type { Migration } from '../types'

export const migration: Migration = {
  version: 5,
  name: 'remove_task_title',

  up(db: Database): void {
    // SQLite doesn't support DROP COLUMN directly before version 3.35.0
    // We need to recreate the table without the title column

    // 1. Create new table without title column
    db.exec(`
      CREATE TABLE tasks_new (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        group_id TEXT,
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
        thinking_mode INTEGER,
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

    // 2. Copy data, merging title into prompt
    db.exec(`
      INSERT INTO tasks_new (
        id, project_id, group_id, prompt, status, queue_position,
        source, source_ref, context_files, include_claude_md, enabled_skills,
        agent_id, model, thinking_mode, created_at, started_at, completed_at,
        exit_code, error_message, cost_estimate, runtime_ms,
        running_session_started_at, current_iteration, iterations
      )
      SELECT
        id, project_id, group_id,
        CASE
          WHEN title IS NOT NULL AND title != '' THEN title || char(10) || char(10) || prompt
          ELSE prompt
        END as prompt,
        status, queue_position,
        source, source_ref, context_files, include_claude_md, enabled_skills,
        agent_id, model, thinking_mode, created_at, started_at, completed_at,
        exit_code, error_message, cost_estimate, runtime_ms,
        running_session_started_at, current_iteration, iterations
      FROM tasks
    `)

    // 3. Drop old table
    db.exec(`DROP TABLE tasks`)

    // 4. Rename new table
    db.exec(`ALTER TABLE tasks_new RENAME TO tasks`)

    // 5. Recreate indexes
    db.exec(`CREATE INDEX idx_tasks_status ON tasks(status)`)
    db.exec(
      `CREATE INDEX idx_tasks_queue ON tasks(status, queue_position) WHERE status = 'queued'`
    )
    db.exec(`CREATE INDEX idx_tasks_project_status ON tasks(project_id, status)`)
  },

  down(db: Database): void {
    // Add title column back (data loss - can't recover original title)
    // This is a destructive rollback that cannot be fully reversed

    db.exec(`
      CREATE TABLE tasks_new (
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
        thinking_mode INTEGER,
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

    // Copy data with NULL title (original titles are lost)
    db.exec(`
      INSERT INTO tasks_new
      SELECT id, project_id, group_id, NULL as title, prompt, status, queue_position,
        source, source_ref, context_files, include_claude_md, enabled_skills,
        agent_id, model, thinking_mode, created_at, started_at, completed_at,
        exit_code, error_message, cost_estimate, runtime_ms,
        running_session_started_at, current_iteration, iterations
      FROM tasks
    `)

    db.exec(`DROP TABLE tasks`)
    db.exec(`ALTER TABLE tasks_new RENAME TO tasks`)

    // Recreate indexes
    db.exec(`CREATE INDEX idx_tasks_status ON tasks(status)`)
    db.exec(
      `CREATE INDEX idx_tasks_queue ON tasks(status, queue_position) WHERE status = 'queued'`
    )
    db.exec(`CREATE INDEX idx_tasks_project_status ON tasks(project_id, status)`)
  }
}
