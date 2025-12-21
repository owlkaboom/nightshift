# TypeScript Migration System Plan

## Overview

Replace the current monolithic `schema.ts` (1000+ lines with 20 inline migrations) with a file-based TypeScript migration system. Each migration lives in its own file with `up()` and `down()` functions.

## Goals

1. **Separation of concerns** - One file per migration
2. **Rollback support** - Down functions for each migration
3. **Type safety** - Full TypeScript with better-sqlite3 types
4. **Easy review** - PRs show individual migration files
5. **No new dependencies** - Works with existing better-sqlite3

## Target Structure

```
src/main/storage/migrations/
├── index.ts                    # Exports runner and utilities
├── runner.ts                   # Migration executor
├── types.ts                    # Migration interface definitions
├── scripts/
│   ├── 001_initial_schema.ts
│   ├── 002_add_notes.ts
│   ├── 003_add_thinking_mode.ts
│   ├── 004_nested_groups.ts
│   ├── 005_remove_task_title.ts
│   ├── 006_notes_icon.ts
│   ├── 007_vault_path.ts
│   ├── 008_completed_at_index.ts
│   ├── 009_accepted_to_completed.ts
│   ├── 010_project_tag_ids.ts
│   ├── 011_task_tag_ids.ts
│   ├── 012_notes_tag_refs.ts
│   ├── 013_integration_support.ts
│   ├── 014_selected_project_id.ts
│   ├── 015_migrations_table.ts
│   ├── 016_debug_logging.ts
│   ├── 017_note_groups.ts
│   ├── 018_project_local_path.ts
│   ├── 019_rename_local_path.ts
│   └── 020_task_session_id.ts
└── legacy/
    ├── migrate-from-json.ts    # Keep as-is (one-time data migration)
    ├── migrate-groups-to-tags.ts
    └── compress-existing-logs.ts
```

## Implementation Details

### 1. Migration Interface (`types.ts`)

```typescript
import type { Database } from 'better-sqlite3'

export interface Migration {
  /** Unique migration version number */
  version: number

  /** Human-readable name for logging */
  name: string

  /** Apply the migration */
  up(db: Database): void

  /** Rollback the migration */
  down(db: Database): void
}
```

### 2. Migration Runner (`runner.ts`)

```typescript
import type { Database } from 'better-sqlite3'
import type { Migration } from './types'
import { logger } from '@main/utils/logger'

export interface MigrationResult {
  version: number
  name: string
  direction: 'up' | 'down'
  success: boolean
  error?: string
}

export class MigrationRunner {
  private db: Database
  private migrations: Migration[]

  constructor(db: Database, migrations: Migration[]) {
    this.db = db
    this.migrations = migrations.sort((a, b) => a.version - b.version)
  }

  /** Get current schema version from database */
  getCurrentVersion(): number {
    try {
      const result = this.db.prepare(
        'SELECT version FROM schema_version WHERE id = 1'
      ).get() as { version: number } | undefined
      return result?.version ?? 0
    } catch {
      return 0
    }
  }

  /** Run all pending migrations */
  migrateUp(targetVersion?: number): MigrationResult[] {
    const currentVersion = this.getCurrentVersion()
    const target = targetVersion ?? this.getLatestVersion()
    const results: MigrationResult[] = []

    if (currentVersion === 0) {
      // Fresh database - run initial schema creation
      this.ensureSchemaVersionTable()
    }

    const pendingMigrations = this.migrations.filter(
      m => m.version > currentVersion && m.version <= target
    )

    for (const migration of pendingMigrations) {
      const result = this.runMigration(migration, 'up')
      results.push(result)

      if (!result.success) {
        break // Stop on first failure
      }
    }

    return results
  }

  /** Rollback to a specific version */
  migrateDown(targetVersion: number): MigrationResult[] {
    const currentVersion = this.getCurrentVersion()
    const results: MigrationResult[] = []

    if (targetVersion >= currentVersion) {
      return results // Nothing to rollback
    }

    // Get migrations to rollback in reverse order
    const migrationsToRollback = this.migrations
      .filter(m => m.version <= currentVersion && m.version > targetVersion)
      .sort((a, b) => b.version - a.version)

    for (const migration of migrationsToRollback) {
      const result = this.runMigration(migration, 'down')
      results.push(result)

      if (!result.success) {
        break // Stop on first failure
      }
    }

    return results
  }

  /** Run a single migration */
  private runMigration(
    migration: Migration,
    direction: 'up' | 'down'
  ): MigrationResult {
    const result: MigrationResult = {
      version: migration.version,
      name: migration.name,
      direction,
      success: false
    }

    logger.debug(
      `[Migration] Running ${direction}: ${migration.version}_${migration.name}`
    )

    try {
      // Run migration in a transaction
      this.db.exec('BEGIN TRANSACTION')

      if (direction === 'up') {
        migration.up(this.db)
        this.updateVersion(migration.version)
      } else {
        migration.down(this.db)
        this.updateVersion(migration.version - 1)
      }

      this.db.exec('COMMIT')
      result.success = true

      logger.debug(
        `[Migration] Completed ${direction}: ${migration.version}_${migration.name}`
      )
    } catch (error) {
      this.db.exec('ROLLBACK')
      result.error = error instanceof Error ? error.message : String(error)
      console.error(
        `[Migration] Failed ${direction}: ${migration.version}_${migration.name}`,
        error
      )
    }

    return result
  }

  private ensureSchemaVersionTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        version INTEGER NOT NULL,
        migrated_at TEXT NOT NULL
      )
    `)
    this.db.prepare(`
      INSERT OR IGNORE INTO schema_version (id, version, migrated_at)
      VALUES (1, 0, ?)
    `).run(new Date().toISOString())
  }

  private updateVersion(version: number): void {
    this.db.prepare(`
      UPDATE schema_version SET version = ?, migrated_at = ? WHERE id = 1
    `).run(version, new Date().toISOString())
  }

  private getLatestVersion(): number {
    return Math.max(...this.migrations.map(m => m.version), 0)
  }
}
```

### 3. Example Migration File (`scripts/002_add_notes.ts`)

```typescript
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
```

### 4. Example Complex Migration (`scripts/005_remove_task_title.ts`)

```typescript
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
    db.exec(`CREATE INDEX idx_tasks_queue ON tasks(status, queue_position) WHERE status = 'queued'`)
    db.exec(`CREATE INDEX idx_tasks_project_status ON tasks(project_id, status)`)
  },

  down(db: Database): void {
    // Add title column back (data loss - can't recover original title)
    // This is a destructive migration that cannot be fully reversed

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

    db.exec(`CREATE INDEX idx_tasks_status ON tasks(status)`)
    db.exec(`CREATE INDEX idx_tasks_queue ON tasks(status, queue_position) WHERE status = 'queued'`)
    db.exec(`CREATE INDEX idx_tasks_project_status ON tasks(project_id, status)`)
  }
}
```

### 5. Migration Index (`scripts/index.ts`)

```typescript
import type { Migration } from '../types'

// Import all migrations
import { migration as m001 } from './001_initial_schema'
import { migration as m002 } from './002_add_notes'
import { migration as m003 } from './003_add_thinking_mode'
// ... import all 20 migrations

// Export as sorted array
export const migrations: Migration[] = [
  m001,
  m002,
  m003,
  // ... all 20 migrations
].sort((a, b) => a.version - b.version)
```

### 6. Updated Entry Point (`index.ts`)

```typescript
import type { Database } from 'better-sqlite3'
import { MigrationRunner } from './runner'
import { migrations } from './scripts'
import { logger } from '@main/utils/logger'

export { MigrationRunner } from './runner'
export type { Migration, MigrationResult } from './types'

/**
 * Current schema version (latest migration)
 */
export const SCHEMA_VERSION = Math.max(...migrations.map(m => m.version))

/**
 * Ensure database schema is up to date
 */
export function ensureSchema(db: Database): void {
  const runner = new MigrationRunner(db, migrations)
  const currentVersion = runner.getCurrentVersion()

  logger.debug(
    `[Schema] Current version: ${currentVersion}, Target: ${SCHEMA_VERSION}`
  )

  if (currentVersion < SCHEMA_VERSION) {
    const results = runner.migrateUp()

    const failed = results.find(r => !r.success)
    if (failed) {
      throw new Error(
        `Migration ${failed.version}_${failed.name} failed: ${failed.error}`
      )
    }

    logger.debug(`[Schema] Ran ${results.length} migrations successfully`)
  } else {
    logger.debug('[Schema] Database is up to date')
  }
}

/**
 * Get current schema version
 */
export function getSchemaVersion(db: Database): number {
  const runner = new MigrationRunner(db, migrations)
  return runner.getCurrentVersion()
}

/**
 * Check if database has been initialized
 */
export function hasSchema(db: Database): boolean {
  return getSchemaVersion(db) > 0
}
```

## Implementation Steps

### Phase 1: Create Infrastructure
1. Create `types.ts` with Migration interface
2. Create `runner.ts` with MigrationRunner class
3. Create `scripts/` directory

### Phase 2: Extract Migrations
4. Create `001_initial_schema.ts` (base tables from createSchema)
5. Extract migrations 002-020 from current `runMigrations()` function
6. Create `scripts/index.ts` to export all migrations

### Phase 3: Update Entry Points
7. Create new `index.ts` that uses the runner
8. Update `src/main/storage/index.ts` to use new migration system
9. Keep legacy one-time migrations (JSON, groups-to-tags, compress-logs) in `legacy/`

### Phase 4: Testing & Cleanup
10. Test fresh install (runs all migrations)
11. Test existing database (no migrations needed)
12. Test migration from older version
13. Remove old monolithic `schema.ts` (keep backup)
14. Update documentation in `.claude/docs/database-migrations.md`

## Migration Considerations

### Backward Compatibility
- Existing databases at version 20 will continue to work
- Version tracking uses same `schema_version` table
- No changes to actual schema structure

### Transaction Safety
- Each migration runs in a transaction
- Failed migration triggers rollback
- Version only updated on success

### SQLite Limitations
- Table recreation needed for column drops (handled in TypeScript)
- FTS tables require special handling
- Foreign keys must be re-enabled after table recreation

## CLI Tools (Future Enhancement)

Could add npm scripts for migration management:

```json
{
  "scripts": {
    "db:migrate": "ts-node src/main/storage/migrations/cli.ts up",
    "db:rollback": "ts-node src/main/storage/migrations/cli.ts down",
    "db:status": "ts-node src/main/storage/migrations/cli.ts status",
    "db:create": "ts-node src/main/storage/migrations/cli.ts create"
  }
}
```

## Open Questions

1. **Down migration testing**: Should we add automated tests that run up then down for each migration?
2. **Migration locking**: For multi-process safety, should we add a lock table?
3. **Dry run mode**: Should the runner support a dry-run that logs SQL without executing?
4. **Migration history table**: Should we track all migration runs (not just current version) for audit purposes?
