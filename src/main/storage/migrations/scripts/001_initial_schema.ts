/**
 * Migration 001: Initial Schema
 *
 * Creates all base tables and indexes for a fresh Nightshift installation.
 */

import type { Database } from 'better-sqlite3'
import type { Migration } from '../types'

export const migration: Migration = {
  version: 1,
  name: 'initial_schema',

  up(db: Database): void {
    // Enable foreign keys
    db.pragma('foreign_keys = ON')

    // ============ Projects Table ============
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        git_url TEXT,
        default_branch TEXT,
        default_skills TEXT NOT NULL DEFAULT '[]',
        include_claude_md INTEGER NOT NULL DEFAULT 1,
        added_at TEXT NOT NULL,
        icon TEXT
      )
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_projects_git_url ON projects(git_url)
    `)

    // ============ Groups Table ============
    db.exec(`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        icon TEXT,
        created_at TEXT NOT NULL
      )
    `)

    // ============ Group-Project Junction Table ============
    db.exec(`
      CREATE TABLE IF NOT EXISTS group_projects (
        group_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        PRIMARY KEY (group_id, project_id),
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_group_projects_project ON group_projects(project_id)
    `)

    // ============ Tasks Table ============
    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
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

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_queue ON tasks(status, queue_position)
      WHERE status = 'queued'
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status)
    `)

    // ============ Config Table (Single Row) ============
    db.exec(`
      CREATE TABLE IF NOT EXISTS config (
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

    // ============ Local State Table (Single Row) ============
    db.exec(`
      CREATE TABLE IF NOT EXISTS local_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        machine_id TEXT NOT NULL,
        project_paths TEXT NOT NULL DEFAULT '{}',
        claude_code_ecosystem TEXT NOT NULL DEFAULT '{}',
        integrations TEXT NOT NULL DEFAULT '{}'
      )
    `)

    // ============ Skills Table ============
    db.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        prompt TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '🎯',
        category TEXT NOT NULL DEFAULT 'custom',
        enabled INTEGER NOT NULL DEFAULT 1,
        is_built_in INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_skills_enabled ON skills(enabled)
    `)

    // ============ Project Memory Table ============
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_memory (
        project_id TEXT PRIMARY KEY,
        version INTEGER NOT NULL DEFAULT 1,
        entries TEXT NOT NULL DEFAULT '[]',
        recent_tasks TEXT NOT NULL DEFAULT '[]',
        structure TEXT,
        last_session_id TEXT,
        last_compacted_at TEXT NOT NULL,
        stats TEXT NOT NULL DEFAULT '{}',
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)

    // ============ Credentials Table ============
    db.exec(`
      CREATE TABLE IF NOT EXISTS credentials (
        key TEXT PRIMARY KEY,
        encrypted_value TEXT NOT NULL
      )
    `)

    // ============ Schema Version Table ============
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        version INTEGER NOT NULL,
        migrated_at TEXT NOT NULL
      )
    `)
  },

  down(db: Database): void {
    // Drop all tables in reverse dependency order
    db.exec(`DROP TABLE IF EXISTS credentials`)
    db.exec(`DROP TABLE IF EXISTS project_memory`)
    db.exec(`DROP TABLE IF EXISTS skills`)
    db.exec(`DROP TABLE IF EXISTS local_state`)
    db.exec(`DROP TABLE IF EXISTS config`)
    db.exec(`DROP INDEX IF EXISTS idx_tasks_project_status`)
    db.exec(`DROP INDEX IF EXISTS idx_tasks_queue`)
    db.exec(`DROP INDEX IF EXISTS idx_tasks_status`)
    db.exec(`DROP TABLE IF EXISTS tasks`)
    db.exec(`DROP INDEX IF EXISTS idx_group_projects_project`)
    db.exec(`DROP TABLE IF EXISTS group_projects`)
    db.exec(`DROP TABLE IF EXISTS groups`)
    db.exec(`DROP INDEX IF EXISTS idx_projects_git_url`)
    db.exec(`DROP TABLE IF EXISTS projects`)
    db.exec(`DROP TABLE IF EXISTS schema_version`)
  }
}
