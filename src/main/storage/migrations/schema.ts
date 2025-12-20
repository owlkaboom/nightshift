/**
 * SQLite Schema Definition for Nightshift
 *
 * Single database: ~/.nightshift/nightshift.db
 */

import type { Database } from 'better-sqlite3'
import { logger } from '@main/utils/logger'

/**
 * Current schema version
 * Increment this when making schema changes
 */
export const SCHEMA_VERSION = 16

/**
 * Create all tables and indexes
 */
export function createSchema(db: Database): void {
  // Enable foreign keys (should already be done, but ensure)
  db.pragma('foreign_keys = ON')

  // ============ Projects Table ============
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      git_url TEXT,
      default_branch TEXT,
      default_skills TEXT NOT NULL DEFAULT '[]',
      include_claude_md INTEGER NOT NULL DEFAULT 1,
      tag_ids TEXT NOT NULL DEFAULT '[]',
      integration_ids TEXT NOT NULL DEFAULT '[]',
      added_at TEXT NOT NULL,
      icon TEXT
    )
  `)

  // Index for git URL lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_projects_git_url ON projects(git_url)
  `)

  // ============ Groups Table ============
  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      parent_id TEXT,
      color TEXT,
      icon TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES groups(id) ON DELETE SET NULL
    )
  `)

  // Index for parent group lookups (tree traversal)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_groups_parent ON groups(parent_id)
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

  // Index for finding groups by project
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_group_projects_project ON group_projects(project_id)
  `)

  // ============ Tasks Table ============
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
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

  // Index for status filtering
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)
  `)

  // Index for queued tasks ordering
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_queue ON tasks(status, queue_position) WHERE status = 'queued'
  `)

  // Index for project-filtered queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status)
  `)

  // Index for completed_at date queries (calendar view)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at) WHERE completed_at IS NOT NULL
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
      archive_retention_days INTEGER NOT NULL DEFAULT 30,
      vault_path TEXT,
      selected_project_id TEXT,
      debug_logging INTEGER NOT NULL DEFAULT 0
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

  // Index for enabled skills
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
  // Values are encrypted by safeStorage before being stored here
  db.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      key TEXT PRIMARY KEY,
      encrypted_value TEXT NOT NULL
    )
  `)

  // ============ Notes Table ============
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

  // Index for status filtering
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status)
  `)

  // Index for pinned notes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned) WHERE is_pinned = 1
  `)

  // Index for primary project filtering
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_notes_primary_project ON notes(primary_project_id)
  `)

  // Index for recently updated notes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC)
  `)

  // ============ Notes Full-Text Search (FTS5) ============
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

  // Triggers to keep FTS in sync
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

  // ============ Schema Version Table ============
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL,
      migrated_at TEXT NOT NULL
    )
  `)

  // ============ Migrations Table ============
  // Tracks one-time data migrations (separate from schema versions)
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      completed_at TEXT NOT NULL
    )
  `)

  // Insert schema version
  const insertVersion = db.prepare(`
    INSERT OR REPLACE INTO schema_version (id, version, migrated_at)
    VALUES (1, ?, ?)
  `)
  insertVersion.run(SCHEMA_VERSION, new Date().toISOString())

  logger.debug(`[Schema] Created database schema version ${SCHEMA_VERSION}`)
}

/**
 * Check if schema needs to be created or migrated
 */
export function getSchemaVersion(db: Database): number {
  try {
    const result = db.prepare('SELECT version FROM schema_version WHERE id = 1').get() as
      | { version: number }
      | undefined
    return result?.version ?? 0
  } catch {
    // Table doesn't exist yet
    return 0
  }
}

/**
 * Check if database has been initialized with schema
 */
export function hasSchema(db: Database): boolean {
  return getSchemaVersion(db) > 0
}

/**
 * Run migrations from one version to another
 */
function runMigrations(db: Database, fromVersion: number): void {
  logger.debug(`[Schema] Running migrations from version ${fromVersion} to ${SCHEMA_VERSION}`)

  // Migration from v1 to v2: Add notes table with FTS
  if (fromVersion < 2) {
    logger.debug('[Schema] Running migration v1 -> v2: Adding notes table')

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
        tag_refs TEXT NOT NULL DEFAULT '[]',
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
    db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned) WHERE is_pinned = 1`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_primary_project ON notes(primary_project_id)`)
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

    logger.debug('[Schema] Migration v1 -> v2 complete')
  }

  // Migration from v2 to v3: Add thinking_mode column to tasks
  if (fromVersion < 3) {
    logger.debug('[Schema] Running migration v2 -> v3: Adding thinking_mode column to tasks')

    // Add thinking_mode column (nullable, null = use global default)
    db.exec(`ALTER TABLE tasks ADD COLUMN thinking_mode INTEGER`)

    logger.debug('[Schema] Migration v2 -> v3 complete')
  }

  // Migration from v3 to v4: Add nested groups support and project descriptions
  if (fromVersion < 4) {
    logger.debug('[Schema] Running migration v3 -> v4: Adding nested groups and project descriptions')

    // Add parent_id column to groups for nesting
    db.exec(`ALTER TABLE groups ADD COLUMN parent_id TEXT REFERENCES groups(id) ON DELETE SET NULL`)

    // Create index for parent group lookups (tree traversal)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_groups_parent ON groups(parent_id)`)

    // Add description column to projects
    db.exec(`ALTER TABLE projects ADD COLUMN description TEXT`)

    logger.debug('[Schema] Migration v3 -> v4 complete')
  }

  // Migration from v4 to v5: Remove title column from tasks (display prompt instead)
  if (fromVersion < 5) {
    logger.debug('[Schema] Running migration v4 -> v5: Removing title column from tasks')

    // SQLite doesn't support DROP COLUMN directly before version 3.35.0
    // We need to recreate the table without the title column

    // 1. Create new table without title column
    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks_new (
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

    // 2. Copy data from old table (concatenating title + prompt into prompt)
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

    // 4. Rename new table to original name
    db.exec(`ALTER TABLE tasks_new RENAME TO tasks`)

    // 5. Recreate indexes
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_queue ON tasks(status, queue_position) WHERE status = 'queued'`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status)`)

    logger.debug('[Schema] Migration v4 -> v5 complete')
  }

  // Migration from v5 to v6: Add icon column to notes table
  if (fromVersion < 6) {
    logger.debug('[Schema] Running migration v5 -> v6: Adding icon column to notes table')

    // Add icon column to notes
    db.exec(`ALTER TABLE notes ADD COLUMN icon TEXT`)

    logger.debug('[Schema] Migration v5 -> v6 complete')
  }

  // Migration from v6 to v7: Add vault_path column to config table
  if (fromVersion < 7) {
    logger.debug('[Schema] Running migration v6 -> v7: Adding vault_path column to config table')

    // Add vault_path column to config
    db.exec(`ALTER TABLE config ADD COLUMN vault_path TEXT`)

    logger.debug('[Schema] Migration v6 -> v7 complete')
  }

  // Migration from v7 to v8: Add completed_at index for calendar view
  if (fromVersion < 8) {
    logger.debug('[Schema] Running migration v7 -> v8: Adding completed_at index')

    // Add index for completed_at date queries (calendar view)
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at) WHERE completed_at IS NOT NULL
    `)

    logger.debug('[Schema] Migration v7 -> v8 complete')
  }

  // Migration from v8 to v9: Convert 'accepted' status to 'completed'
  if (fromVersion < 9) {
    logger.debug('[Schema] Running migration v8 -> v9: Converting accepted status to completed')

    // Update all tasks with status 'accepted' to 'completed'
    const result = db.prepare(`
      UPDATE tasks
      SET status = 'completed'
      WHERE status = 'accepted'
    `).run()

    logger.debug(`[Schema] Converted ${result.changes} tasks from 'accepted' to 'completed'`)
    logger.debug('[Schema] Migration v8 -> v9 complete')
  }

  // Migration from v9 to v10: Add tag_ids column to projects table
  if (fromVersion < 10) {
    logger.debug('[Schema] Running migration v9 -> v10: Adding tag_ids column to projects')

    // Add tag_ids column to projects
    db.exec(`ALTER TABLE projects ADD COLUMN tag_ids TEXT NOT NULL DEFAULT '[]'`)

    logger.debug('[Schema] Migration v9 -> v10 complete')
  }

  // Migration from v10 to v11: Add tag_ids column to tasks and migrate group_id data
  if (fromVersion < 11) {
    logger.debug('[Schema] Running migration v10 -> v11: Adding tag_ids to tasks, migrating group_id')

    // Add tag_ids column to tasks
    db.exec(`ALTER TABLE tasks ADD COLUMN tag_ids TEXT NOT NULL DEFAULT '[]'`)

    // Migrate existing group_id values to tag_ids
    // For each task with a group_id, create a tag_ids array with the corresponding tag_id
    // The group IDs and tag IDs should match (grp_xxx -> tag_xxx mapping done in groups-to-tags migration)
    const updateStmt = db.prepare(`
      UPDATE tasks
      SET tag_ids = json_array(REPLACE(group_id, 'grp_', 'tag_'))
      WHERE group_id IS NOT NULL
    `)
    const result = updateStmt.run()

    logger.debug(`[Schema] Migrated ${result.changes} tasks from group_id to tag_ids`)
    logger.debug('[Schema] Migration v10 -> v11 complete')
  }

  // Migration from v11 to v12: Add tag_refs column to notes table
  if (fromVersion < 12) {
    logger.debug('[Schema] Running migration v11 -> v12: Adding tag_refs to notes')

    // Add tag_refs column to notes
    db.exec(`ALTER TABLE notes ADD COLUMN tag_refs TEXT NOT NULL DEFAULT '[]'`)

    // Migrate existing group_refs values to tag_refs
    // For each note with group_refs, create tag_refs array with corresponding tag_ids
    // The group IDs and tag IDs should match (grp_xxx -> tag_xxx mapping done in groups-to-tags migration)
    const migrateStmt = db.prepare(`
      UPDATE notes
      SET tag_refs = (
        SELECT json_group_array(REPLACE(value, 'grp_', 'tag_'))
        FROM json_each(group_refs)
      )
      WHERE json_array_length(group_refs) > 0
    `)
    const result = migrateStmt.run()

    logger.debug(`[Schema] Migrated ${result.changes} notes from group_refs to tag_refs`)
    logger.debug('[Schema] Migration v11 -> v12 complete')
  }

  // Migration from v12 to v13: Add integration fields to tasks and projects
  if (fromVersion < 13) {
    logger.debug('[Schema] Running migration v12 -> v13: Adding integration support')

    try {
      // Check if columns already exist before adding them
      const taskColumns = db.pragma('table_info(tasks)') as Array<{ name: string }>
      const taskColumnNames = taskColumns.map(c => c.name)

      if (!taskColumnNames.includes('external_issue_id')) {
        logger.debug('[Schema] Adding external_issue_id column to tasks table')
        db.exec(`ALTER TABLE tasks ADD COLUMN external_issue_id TEXT`)
      } else {
        logger.debug('[Schema] external_issue_id column already exists in tasks table')
      }

      if (!taskColumnNames.includes('external_issue_url')) {
        logger.debug('[Schema] Adding external_issue_url column to tasks table')
        db.exec(`ALTER TABLE tasks ADD COLUMN external_issue_url TEXT`)
      } else {
        logger.debug('[Schema] external_issue_url column already exists in tasks table')
      }

      if (!taskColumnNames.includes('integration_id')) {
        logger.debug('[Schema] Adding integration_id column to tasks table')
        db.exec(`ALTER TABLE tasks ADD COLUMN integration_id TEXT`)
      } else {
        logger.debug('[Schema] integration_id column already exists in tasks table')
      }

      // Check projects table
      const projectColumns = db.pragma('table_info(projects)') as Array<{ name: string }>
      const projectColumnNames = projectColumns.map(c => c.name)

      if (!projectColumnNames.includes('integration_ids')) {
        logger.debug('[Schema] Adding integration_ids column to projects table')
        db.exec(`ALTER TABLE projects ADD COLUMN integration_ids TEXT NOT NULL DEFAULT '[]'`)
      } else {
        logger.debug('[Schema] integration_ids column already exists in projects table')
      }

      logger.debug('[Schema] Migration v12 -> v13 complete')
    } catch (error) {
      console.error('[Schema] Error during migration v12 -> v13:', error)
      throw error
    }
  }

  // Migration from v13 to v14: Add selected_project_id to config table
  if (fromVersion < 14) {
    logger.debug('[Schema] Running migration v13 -> v14: Adding selected_project_id to config')

    try {
      // Check if column already exists before adding it
      const configColumns = db.pragma('table_info(config)') as Array<{ name: string }>
      const configColumnNames = configColumns.map(c => c.name)

      if (!configColumnNames.includes('selected_project_id')) {
        logger.debug('[Schema] Adding selected_project_id column to config table')
        db.exec(`ALTER TABLE config ADD COLUMN selected_project_id TEXT`)
      } else {
        logger.debug('[Schema] selected_project_id column already exists in config table')
      }

      logger.debug('[Schema] Migration v13 -> v14 complete')
    } catch (error) {
      console.error('[Schema] Error during migration v13 -> v14:', error)
      throw error
    }
  }

  // Migration from v14 to v15: Add migrations table for tracking one-time data migrations
  if (fromVersion < 15) {
    logger.debug('[Schema] Running migration v14 -> v15: Adding migrations table')

    try {
      // Create migrations table if it doesn't exist
      // This table tracks one-time data migrations (separate from schema versions)
      db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          completed_at TEXT NOT NULL
        )
      `)

      logger.debug('[Schema] Migration v14 -> v15 complete')
    } catch (error) {
      console.error('[Schema] Error during migration v14 -> v15:', error)
      throw error
    }
  }

  // Migration from v15 to v16: Add debug_logging column to config table
  if (fromVersion < 16) {
    logger.debug('[Schema] Running migration v15 -> v16: Adding debug_logging to config')

    try {
      // Check if column already exists before adding it
      const configColumns = db.pragma('table_info(config)') as Array<{ name: string }>
      const configColumnNames = configColumns.map(c => c.name)

      if (!configColumnNames.includes('debug_logging')) {
        logger.debug('[Schema] Adding debug_logging column to config table')
        db.exec(`ALTER TABLE config ADD COLUMN debug_logging INTEGER NOT NULL DEFAULT 0`)
      } else {
        logger.debug('[Schema] debug_logging column already exists in config table')
      }

      logger.debug('[Schema] Migration v15 -> v16 complete')
    } catch (error) {
      console.error('[Schema] Error during migration v15 -> v16:', error)
      throw error
    }
  }

  // Add future migrations here (if fromVersion < 17, etc.)
}

/**
 * Verify that all expected columns exist in the database
 */
export function verifySchema(db: Database): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  try {
    // Verify tasks table columns
    const taskColumns = db.pragma('table_info(tasks)') as Array<{ name: string }>
    const taskColumnNames = taskColumns.map(c => c.name)

    const requiredTaskColumns = [
      'id', 'project_id', 'prompt', 'status', 'queue_position',
      'external_issue_id', 'external_issue_url', 'integration_id',
      'tag_ids', 'thinking_mode'
    ]

    for (const col of requiredTaskColumns) {
      if (!taskColumnNames.includes(col)) {
        errors.push(`Missing column in tasks table: ${col}`)
      }
    }

    // Verify projects table columns
    const projectColumns = db.pragma('table_info(projects)') as Array<{ name: string }>
    const projectColumnNames = projectColumns.map(c => c.name)

    const requiredProjectColumns = [
      'id', 'name', 'git_url', 'integration_ids', 'tag_ids', 'description'
    ]

    for (const col of requiredProjectColumns) {
      if (!projectColumnNames.includes(col)) {
        errors.push(`Missing column in projects table: ${col}`)
      }
    }

    if (errors.length > 0) {
      console.error('[Schema] Verification failed:', errors)
      return { valid: false, errors }
    }

    logger.debug('[Schema] Verification passed - all expected columns exist')
    return { valid: true, errors: [] }
  } catch (error) {
    const errorMsg = `Verification error: ${error}`
    console.error('[Schema]', errorMsg)
    return { valid: false, errors: [errorMsg] }
  }
}

/**
 * Initialize schema if needed
 */
export function ensureSchema(db: Database): void {
  const currentVersion = getSchemaVersion(db)
  logger.debug(`[Schema] Current schema version: ${currentVersion}, Target version: ${SCHEMA_VERSION}`)

  if (currentVersion === 0) {
    // Fresh database - create schema
    logger.debug('[Schema] Fresh database detected, creating schema from scratch')
    createSchema(db)
  } else if (currentVersion < SCHEMA_VERSION) {
    logger.debug(
      `[Schema] Migration needed from v${currentVersion} to v${SCHEMA_VERSION}`
    )

    // Run migrations
    runMigrations(db, currentVersion)

    // Update version
    const updateVersion = db.prepare(`
      UPDATE schema_version SET version = ?, migrated_at = ? WHERE id = 1
    `)
    updateVersion.run(SCHEMA_VERSION, new Date().toISOString())
    logger.debug(`[Schema] Migration complete - updated version to ${SCHEMA_VERSION}`)
  } else {
    logger.debug('[Schema] Database schema is up to date')
  }

  // Verify schema after ensuring it's up to date
  const verification = verifySchema(db)
  if (!verification.valid) {
    console.error('[Schema] WARNING: Schema verification failed after migration!')
    console.error('[Schema] Missing or invalid columns detected. This may cause errors.')
    console.error('[Schema] Consider deleting the database file and restarting for a fresh schema.')
  }
}
