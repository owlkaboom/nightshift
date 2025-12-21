/**
 * Migration 014: Selected Project ID
 *
 * Adds selected_project_id column to config table.
 */

import type { Database } from 'better-sqlite3'
import type { Migration } from '../types'

export const migration: Migration = {
  version: 14,
  name: 'selected_project_id',

  up(db: Database): void {
    // Check if column already exists before adding it
    const configColumns = db.pragma('table_info(config)') as Array<{ name: string }>
    const configColumnNames = configColumns.map((c) => c.name)

    if (!configColumnNames.includes('selected_project_id')) {
      db.exec(`ALTER TABLE config ADD COLUMN selected_project_id TEXT`)
    }
  },

  down(db: Database): void {
    // Recreate config table without selected_project_id
    db.exec(`
      CREATE TABLE config_rollback (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        claude_code_path TEXT NOT NULL,
        selected_agent_id TEXT NOT NULL DEFAULT 'claude-code',
        agents TEXT NOT NULL DEFAULT '{}',
        max_concurrent_tasks INTEGER NOT NULL DEFAULT 1,
        max_task_duration_minutes INTEGER NOT NULL DEFAULT 15,
        rate_limit_check_interval_seconds INTEGER NOT NULL DEFAULT 300,
        auto_play_usage_threshold INTEGER NOT NULL DEFAULT 92,
        default_scan_paths TEXT NOT NULL DEFAULT '[]',
        theme TEXT NOT NULL DEFAULT 'dark',
        notifications TEXT NOT NULL DEFAULT '{}',
        sync TEXT NOT NULL DEFAULT '{}',
        archive_retention_days INTEGER NOT NULL DEFAULT 30,
        vault_path TEXT
      )
    `)

    // Copy data (excluding selected_project_id)
    db.exec(`
      INSERT INTO config_rollback
      SELECT
        id, claude_code_path, selected_agent_id, agents,
        max_concurrent_tasks, max_task_duration_minutes,
        rate_limit_check_interval_seconds, auto_play_usage_threshold,
        default_scan_paths, theme, notifications, sync,
        archive_retention_days, vault_path
      FROM config
    `)

    // Drop old table and rename
    db.exec(`DROP TABLE config`)
    db.exec(`ALTER TABLE config_rollback RENAME TO config`)
  }
}
