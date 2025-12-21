import { readdir } from 'fs/promises'
import { rm } from 'fs/promises'
import { join } from 'path'
import { getDatabase } from './database'
import { getTasksDir } from '../utils/paths'

interface CleanupResult {
  deletedCount: number
  errors: Array<{ taskId: string; projectId: string; error: string }>
}

/**
 * Scans the tasks directory and removes log directories for tasks
 * that no longer exist in the database (orphaned logs).
 */
export async function cleanupOrphanedTaskLogs(): Promise<CleanupResult> {
  const result: CleanupResult = {
    deletedCount: 0,
    errors: []
  }

  try {
    const tasksDir = getTasksDir()
    const db = getDatabase()

    // Get all project directories
    const projectDirs = await readdir(tasksDir, { withFileTypes: true })

    for (const projectDir of projectDirs) {
      if (!projectDir.isDirectory()) continue

      const projectId = projectDir.name
      const projectPath = join(tasksDir, projectId)

      try {
        // Get all task directories for this project
        const taskDirs = await readdir(projectPath, { withFileTypes: true })

        for (const taskDir of taskDirs) {
          if (!taskDir.isDirectory()) continue

          const taskId = taskDir.name

          // Check if task exists in database
          const taskExists = db
            .prepare('SELECT 1 FROM tasks WHERE id = ? AND project_id = ? LIMIT 1')
            .get(taskId, projectId)

          if (!taskExists) {
            // Task doesn't exist in database - remove orphaned logs
            const taskDirPath = join(projectPath, taskId)
            try {
              await rm(taskDirPath, { recursive: true, force: true })
              result.deletedCount++
              console.log(
                `[OrphanedLogsCleanup] Removed orphaned logs for task ${taskId} in project ${projectId}`
              )
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error)
              result.errors.push({
                taskId,
                projectId,
                error: errorMessage
              })
              console.error(
                `[OrphanedLogsCleanup] Failed to remove logs for task ${taskId}:`,
                errorMessage
              )
            }
          }
        }

        // Remove project directory if it's empty
        const remainingTaskDirs = await readdir(projectPath)
        if (remainingTaskDirs.length === 0) {
          await rm(projectPath, { recursive: true, force: true })
          console.log(
            `[OrphanedLogsCleanup] Removed empty project directory: ${projectId}`
          )
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(
          `[OrphanedLogsCleanup] Error processing project ${projectId}:`,
          errorMessage
        )
      }
    }

    console.log(
      `[OrphanedLogsCleanup] Cleanup complete. Deleted ${result.deletedCount} orphaned task log directories`
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[OrphanedLogsCleanup] Failed to cleanup orphaned logs:`, errorMessage)
  }

  return result
}
