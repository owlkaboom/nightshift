# Storage Layer

## Overview

Nightshift uses SQLite for persistent storage with a file-based backup system. All data is stored in `~/.nightshift/` with the main database in `nightshift.db`. API keys are stored securely in the OS keychain.

## Storage Location

```
~/.nightshift/
├── nightshift.db            # SQLite database (main storage)
├── config.json              # Global application settings
├── local-state.json         # Machine-specific state
├── worktrees/               # Git worktrees for task isolation
│   └── {project-id}/
│       └── {task-id}/       # Task worktree directory
└── logs/                    # Agent execution logs
    └── {task-id}/
        ├── 1.log            # Iteration 1 log
        └── 2.log            # Iteration 2 log
```

## Design Principles

### 1. SQLite for Structured Data
- Single database file for all entities
- ACID transactions for data integrity
- Better performance for queries
- Supports migrations

### 2. Syncable vs Local Split
- **Syncable**: Projects, groups, skills, notes (could sync to cloud)
- **Local-only**: Config, local state, worktrees (machine-specific)

### 3. Project Identification
Projects are identified by git remote URL, not local path:
- Same project recognized across machines
- Path changes don't break identity
- Proper deduplication

### 4. Secure API Key Storage
- API keys stored in OS keychain (not database)
- Uses `safeStorage` API on supported platforms
- Falls back to encrypted file storage

## Database Schema

### Tables

```sql
-- Projects table
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  git_url TEXT NOT NULL UNIQUE,
  group_id TEXT REFERENCES groups(id),
  config TEXT,  -- JSON
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Groups table
CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Tasks table
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL,  -- queued, running, needs_review, etc.
  priority INTEGER DEFAULT 0,
  agent_id TEXT,
  worktree_path TEXT,
  branch_name TEXT,
  current_iteration INTEGER DEFAULT 0,
  iterations TEXT,  -- JSON array
  context_files TEXT,  -- JSON array
  skills TEXT,  -- JSON array
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Skills table
CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,
  is_builtin INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Notes table
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  mentions TEXT,  -- JSON array
  is_pinned INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Planning sessions table
CREATE TABLE planning_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL,
  messages TEXT NOT NULL,  -- JSON array
  plan_items TEXT,  -- JSON array
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Project memory table
CREATE TABLE project_memory (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## Store Architecture

Each domain has a dedicated store in `src/main/storage/sqlite/`:

```
src/main/storage/
├── index.ts                 # Exports all stores
├── database.ts              # SQLite connection management
├── secure-store.ts          # API key encryption
├── sqlite/
│   ├── task-store.ts        # Tasks CRUD
│   ├── project-store.ts     # Projects CRUD
│   ├── group-store.ts       # Groups CRUD
│   ├── skill-store.ts       # Skills CRUD
│   ├── note-store.ts        # Notes CRUD
│   ├── config-store.ts      # App configuration
│   ├── local-state-store.ts # Machine-specific state
│   └── memory-store.ts      # Project memory
└── migrations/
    ├── schema.ts            # Schema definitions
    └── migrate-from-json.ts # JSON to SQLite migration
```

## Database Connection

```typescript
// src/main/storage/database.ts
import Database from 'better-sqlite3'

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = join(app.getPath('home'), '.nightshift', 'nightshift.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')  // Better concurrency
    db.pragma('foreign_keys = ON')   // Enforce FK constraints
    initializeSchema(db)
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
```

## Store Implementation Pattern

All SQLite stores follow a consistent pattern:

```typescript
// src/main/storage/sqlite/task-store.ts
import { getDatabase } from '../database'
import type { Task, TaskStatus, CreateTaskData } from '@shared/types'

export function createTask(projectId: string, data: CreateTaskData): Task {
  const db = getDatabase()
  const id = uuidv4()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO tasks (id, project_id, title, prompt, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(id, projectId, data.title, data.prompt, 'queued', now, now)

  return getTask(id)!
}

export function getTask(id: string): Task | null {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  return row ? mapRowToTask(row) : null
}

export function listTasks(projectId: string): Task[] {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT * FROM tasks
    WHERE project_id = ?
    ORDER BY created_at DESC
  `).all(projectId)

  return rows.map(mapRowToTask)
}

export function updateTask(id: string, updates: Partial<Task>): Task | null {
  const db = getDatabase()
  const now = new Date().toISOString()

  // Build dynamic update query
  const fields = Object.keys(updates)
  const sets = fields.map(f => `${toSnakeCase(f)} = ?`).join(', ')
  const values = fields.map(f => serializeValue(updates[f]))

  const stmt = db.prepare(`
    UPDATE tasks
    SET ${sets}, updated_at = ?
    WHERE id = ?
  `)

  stmt.run(...values, now, id)
  return getTask(id)
}

// Helper to map DB row to Task type
function mapRowToTask(row: any): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    prompt: row.prompt,
    status: row.status as TaskStatus,
    iterations: JSON.parse(row.iterations || '[]'),
    contextFiles: JSON.parse(row.context_files || '[]'),
    skills: JSON.parse(row.skills || '[]'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // ... other fields
  }
}
```

## Data Types

### Task

```typescript
interface Task {
  id: string
  projectId: string
  title: string
  prompt: string
  status: TaskStatus
  priority: number
  agentId?: string
  worktreePath?: string
  branchName?: string
  currentIteration: number
  iterations: Iteration[]
  contextFiles: string[]
  skills: string[]
  error?: string
  createdAt: string
  updatedAt: string
}

type TaskStatus =
  | 'queued'
  | 'running'
  | 'needs_review'
  | 'failed'
  | 'cancelled'
  | 'accepted'
  | 'rejected'

interface Iteration {
  number: number
  prompt: string
  startedAt: string
  completedAt?: string
  status: 'running' | 'completed' | 'failed'
  error?: string
}
```

### Project

```typescript
interface Project {
  id: string
  name: string
  gitUrl: string
  groupId?: string
  config?: ProjectConfig
  createdAt: string
  updatedAt: string
}

interface ProjectConfig {
  defaultSkills?: string[]
  defaultBranch?: string
  defaultAgentId?: string
}
```

### Config

```typescript
interface AppConfig {
  // Agent settings
  defaultAgentId: string
  maxConcurrentTasks: number
  autoPlayEnabled: boolean

  // UI settings
  theme: 'light' | 'dark' | 'system'
  sidebarCollapsed: boolean
  sidebarWidth: number

  // Notifications
  notifyOnComplete: boolean
  notifyOnError: boolean
}
```

## Secure Storage

API keys are stored securely using the OS keychain:

```typescript
// src/main/storage/secure-store.ts
import { safeStorage } from 'electron'

const SERVICE_NAME = 'nightshift'

export async function setAgentApiKey(agentId: string, key: string): Promise<void> {
  const encrypted = safeStorage.encryptString(key)
  const keyPath = join(getStoragePath(), `${agentId}.key`)
  await writeFile(keyPath, encrypted)
}

export async function getAgentApiKey(agentId: string): Promise<string | null> {
  const keyPath = join(getStoragePath(), `${agentId}.key`)
  try {
    const encrypted = await readFile(keyPath)
    return safeStorage.decryptString(encrypted)
  } catch {
    return null
  }
}

export async function deleteAgentApiKey(agentId: string): Promise<void> {
  const keyPath = join(getStoragePath(), `${agentId}.key`)
  await unlink(keyPath).catch(() => {})
}
```

## Migration System

Schema changes are handled via migrations:

```typescript
// src/main/storage/migrations/schema.ts
interface Migration {
  version: number
  name: string
  up(db: Database.Database): void
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS projects (...)
        CREATE TABLE IF NOT EXISTS groups (...)
        CREATE TABLE IF NOT EXISTS tasks (...)
      `)
    }
  },
  {
    version: 2,
    name: 'add_planning_sessions',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS planning_sessions (...)
      `)
    }
  },
  {
    version: 3,
    name: 'add_notes',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS notes (...)
      `)
    }
  }
]

export function runMigrations(db: Database.Database): void {
  const currentVersion = getCurrentVersion(db)
  const pending = migrations.filter(m => m.version > currentVersion)

  for (const migration of pending) {
    db.transaction(() => {
      migration.up(db)
      setVersion(db, migration.version)
    })()
  }
}
```

## JSON to SQLite Migration

For users upgrading from older versions:

```typescript
// src/main/storage/migrations/migrate-from-json.ts
export async function migrateFromJson(): Promise<void> {
  const jsonPath = join(getStoragePath(), 'projects.json')

  if (!existsSync(jsonPath)) return

  const db = getDatabase()
  const jsonData = JSON.parse(readFileSync(jsonPath, 'utf-8'))

  db.transaction(() => {
    // Migrate projects
    for (const project of jsonData.projects) {
      insertProject(db, project)
    }

    // Migrate tasks from individual JSON files
    for (const project of jsonData.projects) {
      const tasksDir = join(getStoragePath(), 'tasks', project.id)
      if (existsSync(tasksDir)) {
        for (const taskId of readdirSync(tasksDir)) {
          const manifest = readTaskManifest(project.id, taskId)
          if (manifest) {
            insertTask(db, manifest)
          }
        }
      }
    }
  })()

  // Rename old files as backup
  renameSync(jsonPath, `${jsonPath}.bak`)
}
```

## Relevant Files

| File | Purpose |
|------|---------|
| `src/main/storage/database.ts` | SQLite connection management |
| `src/main/storage/secure-store.ts` | API key encryption |
| `src/main/storage/sqlite/task-store.ts` | Task CRUD operations |
| `src/main/storage/sqlite/project-store.ts` | Project CRUD operations |
| `src/main/storage/sqlite/group-store.ts` | Group CRUD operations |
| `src/main/storage/sqlite/skill-store.ts` | Skill CRUD operations |
| `src/main/storage/sqlite/note-store.ts` | Note CRUD operations |
| `src/main/storage/sqlite/config-store.ts` | App configuration |
| `src/main/storage/sqlite/local-state-store.ts` | Machine state |
| `src/main/storage/migrations/schema.ts` | Database migrations |
| `src/shared/types/task.ts` | Task type definitions |
| `src/shared/types/project.ts` | Project type definitions |
