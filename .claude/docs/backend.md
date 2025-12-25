# Backend Development (src/main/)

## Overview

Nightshift's backend runs in the Electron main process with TypeScript, SQLite (better-sqlite3), and simple-git for git operations.

## Architecture

```
src/main/
├── agents/          # Agent adapters (Claude Code, Gemini, OpenRouter)
├── git/             # Git worktree operations
├── ipc/             # IPC handlers (API exposed to renderer)
├── storage/         # Data persistence layer
│   ├── sqlite/      # SQLite stores
│   └── file-store.ts # File-based storage
├── analysis/        # Code analysis and recommendations
├── notifications/   # Desktop notifications
└── utils/           # Shared utilities
```

## IPC Communication

### Adding New IPC Handlers

Follow this pattern when adding new IPC functionality:

1. **Define types in `src/shared/ipc-types.ts`**:

```typescript
export interface IpcApi {
  // Add your handler signature
  'domain:action': (arg1: Type1, arg2: Type2) => Promise<ResultType>
}
```

2. **Create handler in `src/main/ipc/[domain]-handlers.ts`**:

```typescript
import { ipcMain } from 'electron'
import type { ResultType } from '@shared/types'
import { logger } from '@main/utils/logger'

export function registerDomainHandlers(): void {
  ipcMain.handle('domain:action', async (_, arg1: Type1, arg2: Type2): Promise<ResultType> => {
    logger.debug('domain:action called', { arg1, arg2 })

    try {
      // Implementation
      const result = await doWork(arg1, arg2)
      return result
    } catch (error) {
      logger.error('domain:action failed', { error })
      throw error
    }
  })
}
```

3. **Register in `src/main/ipc/index.ts`**:

```typescript
import { registerDomainHandlers } from './domain-handlers'

export function registerIpcHandlers(): void {
  // ...existing registrations
  registerDomainHandlers()
}
```

4. **Expose via preload in `src/preload/index.ts`**:

```typescript
const api = {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_, ...args) => listener(...args))
    return () => ipcRenderer.removeListener(channel, listener)
  }
}
```

The preload already exposes a generic `invoke` and `on`, so no changes needed unless adding new patterns.

### Broadcasting Updates

To notify all renderer windows of changes:

```typescript
import { broadcastToAllWindows } from '@main/utils/broadcast'

// After updating data
broadcastToAllWindows('task:status-changed', updatedTask)
broadcastToAllWindows('project:created', newProject)
```

Renderer subscribes via:

```typescript
useEffect(() => {
  const unsubscribe = window.api.on('task:status-changed', (task) => {
    // Update UI
  })
  return unsubscribe
}, [])
```

## Storage Layer

### SQLite Stores

All structured data is stored in SQLite (`~/.nightshift/nightshift.db`).

#### Creating a New Store

1. **Create store in `storage/sqlite/[name]-store.ts`**:

```typescript
import { getDatabase } from '@main/storage/database'
import type { Database } from 'better-sqlite3'
import { logger } from '@main/utils/logger'

export interface Entity {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

/**
 * Create a new entity
 */
export function createEntity(name: string): Entity {
  const db = getDatabase()
  const now = new Date().toISOString()
  const id = `entity_${Date.now()}`

  const entity: Entity = {
    id,
    name,
    createdAt: now,
    updatedAt: now
  }

  db.prepare(`
    INSERT INTO entities (id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(entity.id, entity.name, entity.createdAt, entity.updatedAt)

  logger.debug('Entity created', { id, name })
  return entity
}

/**
 * Get entity by ID
 */
export function getEntity(id: string): Entity | null {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM entities WHERE id = ?').get(id) as any

  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/**
 * Update entity
 */
export function updateEntity(id: string, updates: Partial<Entity>): Entity | null {
  const db = getDatabase()
  const existing = getEntity(id)
  if (!existing) return null

  const updated = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString()
  }

  db.prepare(`
    UPDATE entities
    SET name = ?, updated_at = ?
    WHERE id = ?
  `).run(updated.name, updated.updatedAt, id)

  logger.debug('Entity updated', { id, updates })
  return updated
}

/**
 * Delete entity
 */
export function deleteEntity(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM entities WHERE id = ?').run(id)
  const deleted = result.changes > 0

  if (deleted) {
    logger.debug('Entity deleted', { id })
  }

  return deleted
}

/**
 * List all entities
 */
export function listEntities(): Entity[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM entities ORDER BY created_at DESC').all() as any[]

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}
```

2. **Add migration in `storage/sqlite/migrations/`**:

Create `NNNN-add-entities.ts`:

```typescript
import type { Database } from 'better-sqlite3'

export const version = NNNN // Next sequential version number
export const description = 'Add entities table'

export function up(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX idx_entities_created_at ON entities(created_at);
  `)
}

export function down(db: Database): void {
  db.exec('DROP TABLE IF EXISTS entities;')
}
```

3. **Export from `storage/index.ts`**:

```typescript
export * from './sqlite/entity-store'
```

### File Storage

For unstructured data (logs, files), use file-store:

```typescript
import { ensureDir, appendToFile, readText, fileExists } from '@main/storage/file-store'
import path from 'node:path'

// Ensure directory exists
await ensureDir('/path/to/directory')

// Write log file
await appendToFile('/path/to/file.log', 'Log entry\n')

// Read text file
const content = await readText('/path/to/file.txt')

// Check if file exists
const exists = await fileExists('/path/to/file.txt')
```

### Secure Storage (Keychain)

For API keys and secrets, use secure-store:

```typescript
import { setSecureValue, getSecureValue, deleteSecureValue } from '@main/storage/sqlite/secure-store'

// Store API key
await setSecureValue('openrouter', 'api_key', 'sk-...')

// Retrieve API key
const apiKey = await getSecureValue('openrouter', 'api_key')

// Delete API key
await deleteSecureValue('openrouter', 'api_key')
```

## Agent System

### Agent Adapters

Agents implement the `AgentAdapter` interface to provide a consistent interface for different AI providers.

#### Creating a New Agent Adapter

1. **Create adapter in `agents/adapters/[name]-adapter.ts`**:

```typescript
import { BaseAgentAdapter } from './base-adapter'
import type { AgentCapabilities, AgentModelInfo, RunAgentOptions, AgentStreamEvent } from '@shared/types'
import { logger } from '@main/utils/logger'

export class CustomAgentAdapter extends BaseAgentAdapter {
  id = 'custom-agent' as const
  name = 'Custom Agent'

  async isAvailable(): Promise<boolean> {
    // Check if agent is available (e.g., executable exists, API key configured)
    return true
  }

  async getExecutablePath(): Promise<string | null> {
    // Return path to executable if applicable
    return null
  }

  getCapabilities(): AgentCapabilities {
    return {
      streaming: true,
      fileEdit: true,
      codeExecution: false,
      webSearch: false
    }
  }

  async getModels(): Promise<AgentModelInfo[]> {
    return [
      { id: 'model-1', name: 'Model 1', contextWindow: 128000 },
      { id: 'model-2', name: 'Model 2', contextWindow: 200000 }
    ]
  }

  async *run(options: RunAgentOptions): AsyncGenerator<AgentStreamEvent> {
    const { prompt, workingDirectory, onOutput } = options

    logger.debug('Starting agent run', { workingDirectory })

    try {
      // Implementation-specific agent execution
      // Yield events as they occur:

      yield {
        type: 'output',
        content: 'Starting task...'
      }

      yield {
        type: 'tool_use',
        tool: 'read_file',
        input: { path: '/some/file.ts' }
      }

      yield {
        type: 'tool_result',
        tool: 'read_file',
        result: '// file contents'
      }

      yield {
        type: 'usage',
        inputTokens: 1000,
        outputTokens: 500
      }

      yield {
        type: 'complete',
        success: true
      }
    } catch (error) {
      logger.error('Agent run failed', { error })
      yield {
        type: 'complete',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async stop(): Promise<void> {
    // Stop running agent process
    logger.debug('Stopping agent')
  }
}
```

2. **Register in `agents/registry.ts`**:

```typescript
import { CustomAgentAdapter } from './adapters/custom-adapter'

const customAgent = new CustomAgentAdapter()
registry.register(customAgent)
```

3. **Add agent ID to `shared/types/agent.ts`**:

```typescript
export type AgentId = 'claude-code' | 'gemini' | 'openrouter' | 'custom-agent'
```

## Git Operations

### Working with Worktrees

Nightshift uses git worktrees to isolate task work:

```typescript
import { createWorktree, deleteWorktree, getWorktreePath } from '@main/git'

// Create worktree for task
const worktreePath = await createWorktree(
  '/path/to/repo',
  'nightshift/task-123',
  'main' // base branch
)

// Get worktree path
const path = await getWorktreePath('/path/to/repo', 'nightshift/task-123')

// Delete worktree when done
await deleteWorktree('/path/to/repo', 'nightshift/task-123')
```

### Common Git Operations

```typescript
import { getCurrentBranch, getRecentCommits, hasUncommittedChanges } from '@main/git'

// Get current branch
const branch = await getCurrentBranch('/path/to/repo')

// Get recent commits
const commits = await getRecentCommits('/path/to/repo', 10)

// Check for uncommitted changes
const hasChanges = await hasUncommittedChanges('/path/to/repo')
```

## Error Handling

### Validation at Boundaries

Validate all inputs at IPC boundaries:

```typescript
ipcMain.handle('task:create', async (_, projectId: string, data: unknown): Promise<Task> => {
  // Validate inputs
  if (typeof projectId !== 'string' || !projectId) {
    throw new Error('Invalid project ID')
  }

  if (!isValidTaskData(data)) {
    throw new Error('Invalid task data')
  }

  // Proceed with validated data
  return createTask(projectId, data as TaskData)
})
```

### Discriminated Unions for Errors

Use discriminated unions for complex error states:

```typescript
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: 'NOT_FOUND' | 'PERMISSION_DENIED' | 'UNKNOWN' }

function doOperation(): Result<Task> {
  try {
    const task = getTask(id)
    if (!task) {
      return { success: false, error: 'Task not found', code: 'NOT_FOUND' }
    }
    return { success: true, data: task }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'UNKNOWN'
    }
  }
}
```

## Logging

Use the logger utility from `utils/logger`:

```typescript
import { logger } from '@main/utils/logger'

// Development/debugging output (only shown when debug mode enabled)
logger.debug('Processing task', { taskId, projectId })

// Production-relevant logs
logger.info('Task created', { taskId })
logger.warn('Worktree already exists', { branch })
logger.error('Failed to create task', { error, taskId })

// Never use console.log in production code
```

## Performance Considerations

### Database Transactions

Use transactions for multi-step operations:

```typescript
import { runTransaction } from '@main/storage/database'

runTransaction((db) => {
  // All operations in this block are atomic
  db.prepare('INSERT INTO tasks ...').run(...)
  db.prepare('UPDATE projects ...').run(...)
  db.prepare('INSERT INTO logs ...').run(...)
})
```

### Caching

Cache expensive operations:

```typescript
const cache = new Map<string, CachedValue>()

function getExpensiveData(key: string): Data {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < 60000) {
    return cached.value
  }

  const value = computeExpensiveData(key)
  cache.set(key, { value, timestamp: Date.now() })
  return value
}
```

## Common Patterns

### Async IPC Handlers

All IPC handlers should be async:

```typescript
ipcMain.handle('domain:action', async (_, arg: Type): Promise<Result> => {
  // Always return Promise, even for sync operations
  return performAction(arg)
})
```

### Event Broadcasting

Broadcast significant state changes to all windows:

```typescript
import { broadcastToAllWindows } from '@main/utils/broadcast'

function updateTaskStatus(taskId: string, status: TaskStatus): void {
  // Update database
  const task = updateTask(taskId, { status })

  // Notify all windows
  if (task) {
    broadcastToAllWindows('task:status-changed', task)
  }
}
```

### Process Management

Use ProcessManager for long-running agent processes:

```typescript
import { processManager } from '@main/agents'

// Start process
const processInfo = await processManager.start({
  taskId: 'task_123',
  agentId: 'claude-code',
  workingDirectory: '/path/to/worktree',
  prompt: 'Fix the bug in login.ts'
})

// Get process info
const info = processManager.getProcessInfo('task_123')

// Stop process
await processManager.stop('task_123')
```

## Testing

### Unit Tests

Use Vitest for unit tests:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTask, getTask } from './task-store'

describe('task-store', () => {
  beforeEach(() => {
    // Setup test database
  })

  afterEach(() => {
    // Cleanup
  })

  it('should create and retrieve task', () => {
    const task = createTask('project_1', {
      title: 'Test task',
      description: 'Test description'
    })

    expect(task).toBeDefined()
    expect(task.title).toBe('Test task')

    const retrieved = getTask(task.id)
    expect(retrieved).toEqual(task)
  })
})
```

## Common Mistakes to Avoid

1. **Don't use console.log** - Use logger utilities
2. **Don't forget to validate IPC inputs** - Always validate at boundaries
3. **Don't block the main thread** - Use async operations
4. **Don't forget error handling** - Wrap IPC handlers in try-catch
5. **Don't mutate database rows directly** - Use store functions
6. **Don't forget to broadcast state changes** - Keep UI in sync
7. **Don't store secrets in plain text** - Use secure-store
8. **Don't forget migrations** - Add migration for schema changes
9. **Don't use synchronous fs operations** - Use async file-store methods
10. **Don't forget cleanup** - Remove worktrees, close processes when done
