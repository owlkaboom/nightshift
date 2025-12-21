/**
 * Migration 020: Task Session ID
 *
 * Adds session_id column to tasks table for session continuity.
 */

import type { Database } from 'better-sqlite3'
import type { Migration } from '../types'

export const migration: Migration = {
  version: 20,
  name: 'task_session_id',

  up(db: Database): void {
    // Check if column already exists before adding it
    const taskColumns = db.pragma('table_info(tasks)') as Array<{ name: string }>
    const taskColumnNames = taskColumns.map((c) => c.name)

    if (!taskColumnNames.includes('session_id')) {
      db.exec(`ALTER TABLE tasks ADD COLUMN session_id TEXT DEFAULT NULL`)
    }
  },

  down(db: Database): void {
    // Recreate tasks table without session_id
    db.exec(`
      CREATE TABLE tasks_rollback (
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
        external_issue_id TEXT,
        external_issue_url TEXT,
        integration_id TEXT,
        tag_ids TEXT NOT NULL DEFAULT '[]',
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
      )
    `)

    // Copy data (excluding session_id)
    db.exec(`
      INSERT INTO tasks_rollback
      SELECT
        id, project_id, group_id, prompt, status, queue_position,
        source, source_ref, context_files, include_claude_md, enabled_skills,
        agent_id, model, thinking_mode, created_at, started_at, completed_at,
        exit_code, error_message, cost_estimate, runtime_ms,
        running_session_started_at, current_iteration, iterations,
        external_issue_id, external_issue_url, integration_id, tag_ids
      FROM tasks
    `)

    // Drop old table and rename
    db.exec(`DROP TABLE tasks`)
    db.exec(`ALTER TABLE tasks_rollback RENAME TO tasks`)

    // Recreate indexes
    db.exec(`CREATE INDEX idx_tasks_status ON tasks(status)`)
    db.exec(
      `CREATE INDEX idx_tasks_queue ON tasks(status, queue_position) WHERE status = 'queued'`
    )
    db.exec(`CREATE INDEX idx_tasks_project_status ON tasks(project_id, status)`)
    db.exec(
      `CREATE INDEX idx_tasks_completed_at ON tasks(completed_at) WHERE completed_at IS NOT NULL`
    )
  }
}
