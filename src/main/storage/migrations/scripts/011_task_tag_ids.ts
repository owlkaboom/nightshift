/**
 * Migration 011: Task Tag IDs
 *
 * Adds tag_ids column to tasks and migrates group_id data.
 */

import type { Database } from 'better-sqlite3'
import type { Migration } from '../types'
import { logger } from '../../../utils/logger'

export const migration: Migration = {
  version: 11,
  name: 'task_tag_ids',

  up(db: Database): void {
    // Add tag_ids column to tasks
    db.exec(`ALTER TABLE tasks ADD COLUMN tag_ids TEXT NOT NULL DEFAULT '[]'`)

    // Migrate existing group_id values to tag_ids
    // For each task with a group_id, create a tag_ids array with the corresponding tag_id
    // The group IDs and tag IDs should match (grp_xxx -> tag_xxx mapping)
    const updateStmt = db.prepare(`
      UPDATE tasks
      SET tag_ids = json_array(REPLACE(group_id, 'grp_', 'tag_'))
      WHERE group_id IS NOT NULL
    `)
    const result = updateStmt.run()

    if (result.changes > 0) {
      logger.info(`[Migration] Migrated ${result.changes} tasks from group_id to tag_ids`)
    }
  },

  down(db: Database): void {
    // Recreate tasks table without tag_ids
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
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
      )
    `)

    // Copy data (excluding tag_ids)
    db.exec(`
      INSERT INTO tasks_rollback
      SELECT
        id, project_id, group_id, prompt, status, queue_position,
        source, source_ref, context_files, include_claude_md, enabled_skills,
        agent_id, model, thinking_mode, created_at, started_at, completed_at,
        exit_code, error_message, cost_estimate, runtime_ms,
        running_session_started_at, current_iteration, iterations
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
