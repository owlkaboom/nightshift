/**
 * Migration 007: Vault Path
 *
 * Adds vault_path column to config table for Obsidian integration.
 */

import type { Database } from 'better-sqlite3'
import type { Migration } from '../types'

export const migration: Migration = {
  version: 7,
  name: 'vault_path',

  up(db: Database): void {
    // Add vault_path column to config
    db.exec(`ALTER TABLE config ADD COLUMN vault_path TEXT`)
  },

  down(db: Database): void {
    // Recreate config table without vault_path
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
        archive_retention_days INTEGER NOT NULL DEFAULT 30
      )
    `)

    // Copy data (excluding vault_path)
    db.exec(`
      INSERT INTO config_rollback
      SELECT
        id, claude_code_path, selected_agent_id, agents,
        max_concurrent_tasks, max_task_duration_minutes,
        rate_limit_check_interval_seconds, auto_play_usage_threshold,
        default_scan_paths, theme, notifications, sync, archive_retention_days
      FROM config
    `)

    // Drop old table and rename
    db.exec(`DROP TABLE config`)
    db.exec(`ALTER TABLE config_rollback RENAME TO config`)
  }
}
