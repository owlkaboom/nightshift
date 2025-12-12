/**
 * One-Time Migration: Compress Existing Logs
 *
 * This migration compresses all existing uncompressed task log files (.log)
 * to gzip format (.log.gz) to reduce disk usage.
 *
 * The migration:
 * 1. Checks if it has already run (using migrations table)
 * 2. Finds all task log files in the database
 * 3. Compresses legacy execution.log files
 * 4. Compresses all iteration logs in runs/ directories
 * 5. Tracks bytes reclaimed and any errors
 * 6. Marks migration as complete
 */

import { getDatabase } from '../database'
import { compressFile } from '../compression'
import { getTaskDir, getTaskLogPath } from '../../utils/paths'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'

const MIGRATION_KEY = 'log_compression_v1'

/**
 * Migration result statistics
 */
export interface MigrationResult {
  alreadyRan: boolean
  filesCompressed: number
  bytesReclaimed: number
  errors: string[]
}

/**
 * One-time migration to compress all existing uncompressed log files
 *
 * @returns Migration result with statistics
 */
export async function migrateCompressExistingLogs(): Promise<MigrationResult> {
  const db = getDatabase()

  // Check if migration already ran
  const migrationRecord = db
    .prepare('SELECT value FROM migrations WHERE key = ?')
    .get(MIGRATION_KEY) as { value: string } | undefined

  if (migrationRecord) {
    console.log('[Migration] Log compression already completed, skipping')
    return { alreadyRan: true, filesCompressed: 0, bytesReclaimed: 0, errors: [] }
  }

  console.log('[Migration] Starting one-time log compression migration...')

  // Get all tasks from database
  const tasks = db
    .prepare('SELECT id, project_id, current_iteration FROM tasks')
    .all() as { id: string; project_id: string; current_iteration: number }[]

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
      console.error('[Migration]', msg)
      errors.push(msg)
    }
  }

  // Mark migration as complete
  db.prepare('INSERT INTO migrations (key, value, completed_at) VALUES (?, ?, ?)').run(
    MIGRATION_KEY,
    'completed',
    new Date().toISOString()
  )

  const reclaimedMB = (bytesReclaimed / 1024 / 1024).toFixed(2)
  console.log(
    `[Migration] Compressed ${filesCompressed} files, reclaimed ${reclaimedMB} MB`
  )

  return { alreadyRan: false, filesCompressed, bytesReclaimed, errors }
}

/**
 * Compress a file and return statistics about space saved
 *
 * @param filePath - Path to file to compress
 * @returns Statistics about compression, or null if file doesn't exist
 */
async function compressFileWithStats(
  filePath: string
): Promise<{ bytesReclaimed: number } | null> {
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
