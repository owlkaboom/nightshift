/**
 * Retention Service
 *
 * Automatic cleanup of old completed tasks based on configurable retention period.
 * Only deletes tasks in terminal states (completed, rejected, failed) that are older
 * than the retention period. Tasks awaiting review or in progress are never deleted.
 */

import { getDatabase } from './database'
import { deleteTask } from './sqlite/task-store'
import { loadConfig } from './config-store'

/**
 * Result of cleanup operation
 */
export interface CleanupResult {
  deletedCount: number
  errors: string[]
}

/**
 * Delete tasks that have been completed longer than retention period
 *
 * Only deletes tasks with these statuses:
 * - completed (accepted by user)
 * - rejected (rejected by user)
 * - failed (execution failed)
 *
 * Never deletes:
 * - needs_review (awaiting user action)
 * - queued (pending execution)
 * - running (active)
 * - awaiting_agent (waiting for agent)
 *
 * @returns Cleanup statistics
 */
export async function cleanupExpiredTasks(): Promise<CleanupResult> {
  const config = await loadConfig()
  const retentionDays = config.archiveRetentionDays ?? 30

  if (retentionDays <= 0) {
    console.log('[Retention] Cleanup disabled (retention days <= 0)')
    return { deletedCount: 0, errors: [] }
  }

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays)
  const cutoffISO = cutoffDate.toISOString()

  const db = getDatabase()

  // Find expired tasks (completed and older than retention period)
  // Only delete completed/rejected/failed tasks, never queued/running/needs_review
  const expiredTasks = db
    .prepare(
      `
    SELECT id, project_id
    FROM tasks
    WHERE status IN ('completed', 'rejected', 'failed')
    AND completed_at IS NOT NULL
    AND completed_at < ?
  `
    )
    .all(cutoffISO) as { id: string; project_id: string }[]

  console.log(
    `[Retention] Found ${expiredTasks.length} tasks older than ${retentionDays} days`
  )

  const errors: string[] = []
  let deletedCount = 0

  for (const task of expiredTasks) {
    try {
      await deleteTask(task.project_id, task.id)
      deletedCount++
    } catch (err) {
      const msg = `Failed to delete task ${task.id}: ${err}`
      console.error('[Retention]', msg)
      errors.push(msg)
    }
  }

  console.log(`[Retention] Cleaned up ${deletedCount} expired tasks`)
  return { deletedCount, errors }
}
