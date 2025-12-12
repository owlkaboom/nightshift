# Task Log Storage Refactor Plan

## Overview

Refactor task log storage to implement automatic retention/cleanup and gzip compression for reduced disk footprint.

## Goals

1. **Automatic cleanup** - Delete old completed tasks based on configurable retention period
2. **Compression** - Gzip compress completed iteration logs (~80% size reduction)
3. **Migration** - One-time compression of existing logs on startup
4. **Transparent reading** - Seamlessly read both compressed and uncompressed logs

---

## Current State

```
~/.nightshift/tasks/<project-id>/<task-id>/
├── manifest.json
├── execution.log              # Legacy iteration 1
└── runs/
    ├── run-1.log              # Plain text, ~50-500KB each
    ├── run-2.log
    └── run-N.log
```

- Logs stored as plain text (line-delimited JSON)
- `archive_retention_days` config exists (default: 30) but unused
- No automatic cleanup
- No compression

---

## Target State

```
~/.nightshift/tasks/<project-id>/<task-id>/
├── manifest.json
├── execution.log.gz           # Compressed legacy log
└── runs/
    ├── run-1.log.gz           # Compressed completed iterations
    ├── run-2.log.gz
    └── run-N.log              # Active iteration stays uncompressed
```

- Completed iterations compressed with gzip
- Automatic cleanup of tasks older than retention period
- Seamless reading of both formats
- One-time migration compresses existing logs

---

## Implementation Steps

### Step 1: Add Compression Utilities

**File:** `src/main/storage/compression.ts`

```typescript
import { createGzip, createGunzip } from 'zlib'
import { createReadStream, createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { unlink, rename, stat } from 'fs/promises'

/**
 * Compress a file in-place, adding .gz extension
 * Returns the new path, or null if file doesn't exist
 */
export async function compressFile(filePath: string): Promise<string | null> {
  // Check file exists
  // Create gzip stream: filePath -> filePath.gz
  // Delete original after successful compression
  // Return new path
}

/**
 * Read a file, auto-detecting compression from extension
 * Transparently decompresses .gz files
 */
export async function readFileAutoDecompress(filePath: string): Promise<string | null> {
  // If filePath.gz exists, decompress and return
  // Else if filePath exists, read normally
  // Else return null
}

/**
 * Check if compressed version exists
 */
export async function getActualLogPath(basePath: string): Promise<string | null> {
  // Return basePath.gz if exists, else basePath if exists, else null
}
```

**Implementation notes:**
- Use Node.js built-in `zlib` module (no dependencies)
- Streaming compression to handle large files efficiently
- Atomic operation: write `.gz`, then delete original

---

### Step 2: Update Log Reading Functions

**File:** `src/main/storage/sqlite/task-store.ts`

Update `readTaskLog()` and `readIterationLog()` to use auto-decompression:

```typescript
import { readFileAutoDecompress } from '../compression'

export async function readTaskLog(projectId: string, taskId: string): Promise<string | null> {
  const basePath = getTaskLogPath(projectId, taskId)
  return readFileAutoDecompress(basePath)
}

export async function readIterationLog(
  projectId: string,
  taskId: string,
  iteration: number
): Promise<string | null> {
  const basePath = getIterationLogPath(projectId, taskId, iteration)
  const content = await readFileAutoDecompress(basePath)

  // Fallback for iteration 1 -> legacy execution.log
  if (content === null && iteration === 1) {
    return readTaskLog(projectId, taskId)
  }
  return content
}
```

**No changes needed to write functions** - we always write uncompressed during execution, compress after completion.

---

### Step 3: Compress Logs on Iteration/Task Completion

**File:** `src/main/storage/sqlite/task-store.ts`

Add compression after iteration completes:

```typescript
import { compressFile } from '../compression'

export async function completeIteration(
  projectId: string,
  taskId: string,
  iteration: number,
  result: IterationResult
): Promise<void> {
  // ... existing iteration completion logic ...

  // Compress the completed iteration log
  const logPath = getIterationLogPath(projectId, taskId, iteration)
  await compressFile(logPath)

  // Also compress legacy execution.log if this is iteration 1
  if (iteration === 1) {
    const legacyPath = getTaskLogPath(projectId, taskId)
    await compressFile(legacyPath)
  }
}
```

**Location:** This should be called from `src/main/ipc/agent-handlers.ts` when task execution finishes.

---

### Step 4: Create Retention Service

**File:** `src/main/storage/retention-service.ts`

```typescript
import { getDatabase } from './database'
import { deleteTask } from './sqlite/task-store'
import { getConfig } from './config-store'
import { logger } from '../utils/logger'

interface CleanupResult {
  deletedCount: number
  errors: string[]
}

/**
 * Delete tasks that have been completed longer than retention period
 */
export async function cleanupExpiredTasks(): Promise<CleanupResult> {
  const config = await getConfig()
  const retentionDays = config.archiveRetentionDays ?? 30

  if (retentionDays <= 0) {
    logger.info('[Retention] Cleanup disabled (retention days <= 0)')
    return { deletedCount: 0, errors: [] }
  }

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays)
  const cutoffISO = cutoffDate.toISOString()

  const db = getDatabase()

  // Find expired tasks (completed and older than retention period)
  // Only delete accepted/rejected/failed tasks, never queued/running/needs_review
  const expiredTasks = db.prepare(`
    SELECT id, project_id
    FROM tasks
    WHERE status IN ('accepted', 'rejected', 'failed')
      AND completed_at IS NOT NULL
      AND completed_at < ?
  `).all(cutoffISO) as { id: string; project_id: string }[]

  logger.info(`[Retention] Found ${expiredTasks.length} tasks older than ${retentionDays} days`)

  const errors: string[] = []
  let deletedCount = 0

  for (const task of expiredTasks) {
    try {
      await deleteTask(task.project_id, task.id)
      deletedCount++
    } catch (err) {
      const msg = `Failed to delete task ${task.id}: ${err}`
      logger.error('[Retention]', msg)
      errors.push(msg)
    }
  }

  logger.info(`[Retention] Cleaned up ${deletedCount} expired tasks`)
  return { deletedCount, errors }
}
```

**Retention rules:**
| Status | Auto-delete eligible? |
|--------|----------------------|
| `accepted` | ✅ Yes |
| `rejected` | ✅ Yes |
| `failed` | ✅ Yes |
| `needs_review` | ❌ No (awaiting user action) |
| `queued` | ❌ No (pending execution) |
| `running` | ❌ No (active) |

---

### Step 5: Create One-Time Migration for Existing Logs

**File:** `src/main/storage/migrations/compress-existing-logs.ts`

```typescript
import { getDatabase } from '../database'
import { compressFile } from '../compression'
import { getTaskDir, getTaskLogPath, getIterationLogPath } from '../../utils/paths'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import { logger } from '../../utils/logger'

const MIGRATION_KEY = 'log_compression_v1'

interface MigrationResult {
  alreadyRan: boolean
  filesCompressed: number
  bytesReclaimed: number
  errors: string[]
}

/**
 * One-time migration to compress all existing uncompressed log files
 */
export async function migrateCompressExistingLogs(): Promise<MigrationResult> {
  const db = getDatabase()

  // Check if migration already ran
  const migrationRecord = db.prepare(
    'SELECT value FROM migrations WHERE key = ?'
  ).get(MIGRATION_KEY) as { value: string } | undefined

  if (migrationRecord) {
    logger.info('[Migration] Log compression already completed, skipping')
    return { alreadyRan: true, filesCompressed: 0, bytesReclaimed: 0, errors: [] }
  }

  logger.info('[Migration] Starting one-time log compression migration...')

  // Get all tasks from database
  const tasks = db.prepare(
    'SELECT id, project_id, current_iteration FROM tasks'
  ).all() as { id: string; project_id: string; current_iteration: number }[]

  let filesCompressed = 0
  let bytesReclaimed = 0
  const errors: string[] = []

  for (const task of tasks) {
    try {
      // Compress legacy execution.log if exists
      const legacyPath = getTaskLogPath(task.project_id, task.id)
      const legacyResult = await compressFileWithStats(legacyPath)
      if (legacyResult) {
        filesCompressed++
        bytesReclaimed += legacyResult.bytesReclaimed
      }

      // Compress all iteration logs in runs/ directory
      const runsDir = join(getTaskDir(task.project_id, task.id), 'runs')
      try {
        const files = await readdir(runsDir)
        for (const file of files) {
          // Only compress .log files (not already .gz)
          if (file.endsWith('.log') && !file.endsWith('.gz')) {
            const filePath = join(runsDir, file)
            const result = await compressFileWithStats(filePath)
            if (result) {
              filesCompressed++
              bytesReclaimed += result.bytesReclaimed
            }
          }
        }
      } catch (err: any) {
        // runs/ directory might not exist for older tasks
        if (err.code !== 'ENOENT') {
          throw err
        }
      }
    } catch (err) {
      const msg = `Failed to compress logs for task ${task.id}: ${err}`
      logger.error('[Migration]', msg)
      errors.push(msg)
    }
  }

  // Mark migration as complete
  db.prepare(
    'INSERT INTO migrations (key, value, completed_at) VALUES (?, ?, ?)'
  ).run(MIGRATION_KEY, 'completed', new Date().toISOString())

  const reclaimedMB = (bytesReclaimed / 1024 / 1024).toFixed(2)
  logger.info(`[Migration] Compressed ${filesCompressed} files, reclaimed ${reclaimedMB} MB`)

  return { alreadyRan: false, filesCompressed, bytesReclaimed, errors }
}

async function compressFileWithStats(filePath: string): Promise<{ bytesReclaimed: number } | null> {
  try {
    const beforeStats = await stat(filePath)
    const newPath = await compressFile(filePath)
    if (newPath) {
      const afterStats = await stat(newPath)
      return { bytesReclaimed: beforeStats.size - afterStats.size }
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      throw err
    }
  }
  return null
}
```

---

### Step 6: Add Migrations Table to Schema

**File:** `src/main/storage/migrations/schema.ts`

Add migrations table if not exists:

```sql
CREATE TABLE IF NOT EXISTS migrations (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  completed_at TEXT NOT NULL
);
```

---

### Step 7: Run Services on App Startup

**File:** `src/main/index.ts`

Add startup hooks after database initialization:

```typescript
import { migrateCompressExistingLogs } from './storage/migrations/compress-existing-logs'
import { cleanupExpiredTasks } from './storage/retention-service'

async function initializeApp() {
  // ... existing initialization ...

  // Run one-time migrations
  await migrateCompressExistingLogs()

  // Run retention cleanup (non-blocking, log errors but don't fail startup)
  cleanupExpiredTasks().catch(err => {
    logger.error('[Startup] Retention cleanup failed:', err)
  })
}
```

---

### Step 8: Expose Retention Config in UI

**File:** `src/renderer/src/components/settings/GeneralPanel.tsx` (or similar)

Add UI control for retention days:

```tsx
<SettingRow label="Log Retention" description="Auto-delete completed tasks after this many days (0 to disable)">
  <NumberInput
    value={config.archiveRetentionDays}
    onChange={(value) => updateConfig({ archiveRetentionDays: value })}
    min={0}
    max={365}
  />
</SettingRow>
```

---

## File Changes Summary

| File | Action |
|------|--------|
| `src/main/storage/compression.ts` | **New** - Compression utilities |
| `src/main/storage/retention-service.ts` | **New** - Cleanup service |
| `src/main/storage/migrations/compress-existing-logs.ts` | **New** - One-time migration |
| `src/main/storage/migrations/schema.ts` | **Modify** - Add migrations table |
| `src/main/storage/sqlite/task-store.ts` | **Modify** - Use auto-decompress reads, compress on complete |
| `src/main/ipc/agent-handlers.ts` | **Modify** - Trigger compression on iteration complete |
| `src/main/index.ts` | **Modify** - Run migration and cleanup on startup |
| `src/renderer/src/components/settings/*` | **Modify** - Add retention config UI |

---

## Testing Checklist

- [ ] New tasks write uncompressed logs during execution
- [ ] Completed iterations are compressed to `.gz`
- [ ] Reading logs works for both `.log` and `.log.gz` files
- [ ] Legacy `execution.log` files are handled correctly
- [ ] Migration compresses all existing logs once
- [ ] Migration doesn't re-run on subsequent startups
- [ ] Retention cleanup deletes old accepted/rejected/failed tasks
- [ ] Retention cleanup preserves needs_review/queued/running tasks
- [ ] Retention config UI updates the setting correctly
- [ ] Setting retention to 0 disables automatic cleanup

---

## Rollback Plan

If issues arise:
1. The migration is non-destructive (compressed files are still readable)
2. To rollback reading: just check for `.gz` extension and decompress
3. Migration tracking prevents re-running
4. Retention cleanup can be disabled by setting days to 0

---

## Future Considerations

- **Log streaming** - For very large logs, stream decompress chunks instead of loading full file
- **Compression level** - Currently using default gzip level (6), could tune for speed vs size
- **Storage metrics** - Track and display total log storage size in settings
- **Manual cleanup** - Add "Clean up old tasks now" button in settings
- **Per-project retention** - Different retention periods per project
