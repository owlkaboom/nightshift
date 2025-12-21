/**
 * Migration 013: Integration Support
 *
 * Adds integration fields to tasks and projects for external issue tracking.
 */

import type { Database } from 'better-sqlite3'
import type { Migration } from '../types'

export const migration: Migration = {
  version: 13,
  name: 'integration_support',

  up(db: Database): void {
    // Check if columns already exist before adding them
    const taskColumns = db.pragma('table_info(tasks)') as Array<{ name: string }>
    const taskColumnNames = taskColumns.map((c) => c.name)

    if (!taskColumnNames.includes('external_issue_id')) {
      db.exec(`ALTER TABLE tasks ADD COLUMN external_issue_id TEXT`)
    }

    if (!taskColumnNames.includes('external_issue_url')) {
      db.exec(`ALTER TABLE tasks ADD COLUMN external_issue_url TEXT`)
    }

    if (!taskColumnNames.includes('integration_id')) {
      db.exec(`ALTER TABLE tasks ADD COLUMN integration_id TEXT`)
    }

    // Check projects table
    const projectColumns = db.pragma('table_info(projects)') as Array<{ name: string }>
    const projectColumnNames = projectColumns.map((c) => c.name)

    if (!projectColumnNames.includes('integration_ids')) {
      db.exec(`ALTER TABLE projects ADD COLUMN integration_ids TEXT NOT NULL DEFAULT '[]'`)
    }
  },

  down(db: Database): void {
    // Recreate tasks table without integration columns
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
        tag_ids TEXT NOT NULL DEFAULT '[]',
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
      )
    `)

    // Copy data (excluding integration columns)
    db.exec(`
      INSERT INTO tasks_rollback
      SELECT
        id, project_id, group_id, prompt, status, queue_position,
        source, source_ref, context_files, include_claude_md, enabled_skills,
        agent_id, model, thinking_mode, created_at, started_at, completed_at,
        exit_code, error_message, cost_estimate, runtime_ms,
        running_session_started_at, current_iteration, iterations, tag_ids
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

    // Recreate projects table without integration_ids
    db.exec(`
      CREATE TABLE projects_rollback (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        git_url TEXT,
        default_branch TEXT,
        default_skills TEXT NOT NULL DEFAULT '[]',
        include_claude_md INTEGER NOT NULL DEFAULT 1,
        tag_ids TEXT NOT NULL DEFAULT '[]',
        added_at TEXT NOT NULL,
        icon TEXT
      )
    `)

    // Copy data (excluding integration_ids)
    db.exec(`
      INSERT INTO projects_rollback
      SELECT
        id, name, description, git_url, default_branch,
        default_skills, include_claude_md, tag_ids, added_at, icon
      FROM projects
    `)

    // Drop old table and rename
    db.exec(`DROP TABLE projects`)
    db.exec(`ALTER TABLE projects_rollback RENAME TO projects`)

    // Recreate index
    db.exec(`CREATE INDEX idx_projects_git_url ON projects(git_url)`)
  }
}
