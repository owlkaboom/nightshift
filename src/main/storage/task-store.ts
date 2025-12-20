/**
 * Task store for ~/.nightshift/tasks/<project-id>/<task-id>/manifest.json
 */

import { readdir, rm } from 'fs/promises'
import type { TaskManifest, TaskStatus, TaskIteration } from '@shared/types'
import { createTaskManifest } from '@shared/types'
import { generateTaskId } from '@shared/constants'
import {
  getProjectTasksDir,
  getTaskDir,
  getTaskManifestPath,
  getTaskLogPath,
  getTaskRunsDir,
  getIterationLogPath
} from '@main/utils/paths'
import {
  readJson,
  writeJson,
  ensureDir,
  appendToFile,
  readText,
  fileExists
} from './file-store'
import { homedir } from 'os'
import { join } from 'path'

/**
 * Plan mode detection result
 */
interface PlanModeInfo {
  isPlanMode: boolean
  planFilePath: string | null
}

/**
 * Detect if a task completed in plan mode by parsing the iteration log.
 * Looks for ExitPlanMode tool usage in the JSON output.
 */
export async function detectPlanMode(
  projectId: string,
  taskId: string,
  iteration: number
): Promise<PlanModeInfo> {
  const logContent = await readIterationLog(projectId, taskId, iteration)
  if (!logContent) {
    return { isPlanMode: false, planFilePath: null }
  }

  // Look for ExitPlanMode tool usage in the logs
  // Claude Code outputs JSON lines, and ExitPlanMode would appear as a tool_use
  const lines = logContent.split('\n')

  for (const line of lines) {
    if (!line.trim()) continue

    try {
      const json = JSON.parse(line)

      // Check for assistant messages with tool_use blocks
      if (json.type === 'assistant' && json.message?.content) {
        const content = json.message.content
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_use' && block.name === 'ExitPlanMode') {
              // Found ExitPlanMode usage - this task completed in plan mode
              // Try to find the most recently created plan file
              const planFilePath = await findLatestPlanFile()
              return {
                isPlanMode: true,
                planFilePath
              }
            }
          }
        }
      }
    } catch {
      // Not JSON, skip
    }
  }

  return { isPlanMode: false, planFilePath: null }
}

/**
 * Find the most recently created plan file in ~/.claude/plans/
 */
async function findLatestPlanFile(): Promise<string | null> {
  const plansDir = join(homedir(), '.claude', 'plans')

  try {
    const { readdir, stat } = await import('fs/promises')
    const files = await readdir(plansDir)
    const mdFiles = files.filter(f => f.endsWith('.md'))

    if (mdFiles.length === 0) return null

    // Get file stats and sort by modification time (most recent first)
    const fileStats = await Promise.all(
      mdFiles.map(async (file) => {
        const filePath = join(plansDir, file)
        const stats = await stat(filePath)
        return { path: filePath, mtime: stats.mtime.getTime() }
      })
    )

    fileStats.sort((a, b) => b.mtime - a.mtime)
    return fileStats[0]?.path || null
  } catch {
    return null
  }
}

/**
 * Load a task manifest
 */
export async function loadTask(
  projectId: string,
  taskId: string
): Promise<TaskManifest | null> {
  const path = getTaskManifestPath(projectId, taskId)
  return readJson(path)
}

/**
 * Save a task manifest
 */
export async function saveTask(task: TaskManifest): Promise<void> {
  const path = getTaskManifestPath(task.projectId, task.id)
  await writeJson(path, task)
}

/**
 * Create a new task
 */
export async function createTask(
  prompt: string,
  projectId: string,
  options: Partial<TaskManifest> = {}
): Promise<TaskManifest> {
  const id = generateTaskId()
  const task = createTaskManifest(id, prompt, projectId, options)
  await saveTask(task)
  return task
}

/**
 * Update a task
 */
export async function updateTask(
  projectId: string,
  taskId: string,
  updates: Partial<Omit<TaskManifest, 'id' | 'projectId' | 'createdAt'>>
): Promise<TaskManifest | null> {
  const task = await loadTask(projectId, taskId)

  if (!task) {
    return null
  }

  const updated = { ...task, ...updates }
  await saveTask(updated)
  return updated
}

/**
 * Delete a task and its associated files
 */
export async function deleteTask(
  projectId: string,
  taskId: string
): Promise<boolean> {
  const taskDir = getTaskDir(projectId, taskId)

  if (!(await fileExists(taskDir))) {
    return false
  }

  await rm(taskDir, { recursive: true, force: true })
  return true
}

/**
 * Load all tasks for a project
 */
export async function loadProjectTasks(
  projectId: string
): Promise<TaskManifest[]> {
  const projectDir = getProjectTasksDir(projectId)

  // Ensure directory exists
  await ensureDir(projectDir)

  try {
    const entries = await readdir(projectDir, { withFileTypes: true })
    const taskIds = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)

    const tasks: TaskManifest[] = []

    for (const taskId of taskIds) {
      const task = await loadTask(projectId, taskId)
      if (task) {
        tasks.push(task)
      }
    }

    return tasks
  } catch {
    return []
  }
}

/**
 * Load all tasks across all projects
 */
export async function loadAllTasks(): Promise<TaskManifest[]> {
  const tasksDir = getProjectTasksDir('').replace(/\/$/, '') // Get parent dir

  try {
    const entries = await readdir(tasksDir, { withFileTypes: true })
    const projectIds = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)

    const allTasks: TaskManifest[] = []

    for (const projectId of projectIds) {
      const projectTasks = await loadProjectTasks(projectId)
      allTasks.push(...projectTasks)
    }

    return allTasks
  } catch {
    return []
  }
}

/**
 * Get tasks by status
 */
export async function getTasksByStatus(
  status: TaskStatus
): Promise<TaskManifest[]> {
  const allTasks = await loadAllTasks()
  return allTasks.filter((t) => t.status === status)
}

/**
 * Get queued tasks sorted by queue position
 */
export async function getQueuedTasks(): Promise<TaskManifest[]> {
  const queued = await getTasksByStatus('queued')

  // Sort by queue position
  return queued.sort((a, b) => a.queuePosition - b.queuePosition)
}

/**
 * Reorder tasks by updating their queue positions
 * Takes an array of { projectId, taskId, queuePosition } objects
 */
export async function reorderTasks(
  updates: Array<{ projectId: string; taskId: string; queuePosition: number }>
): Promise<TaskManifest[]> {
  const updatedTasks: TaskManifest[] = []

  for (const { projectId, taskId, queuePosition } of updates) {
    const updated = await updateTask(projectId, taskId, { queuePosition })
    if (updated) {
      updatedTasks.push(updated)
    }
  }

  return updatedTasks
}

// ============ Status Updates ============

/**
 * Update task status with runtime tracking
 */
export async function updateTaskStatus(
  projectId: string,
  taskId: string,
  status: TaskStatus
): Promise<TaskManifest | null> {
  const task = await loadTask(projectId, taskId)
  if (!task) return null

  const updates: Partial<TaskManifest> = { status }
  const now = new Date().toISOString()

  // Handle runtime tracking based on status transitions
  if (status === 'awaiting_agent') {
    // Task is waiting for agent to start - record initial start time
    if (!task.startedAt) {
      updates.startedAt = now
    }
  } else if (status === 'running') {
    // Starting or resuming - record session start time
    if (!task.startedAt) {
      updates.startedAt = now
    }
    updates.runningSessionStartedAt = now
  } else if ((task.status === 'running' || task.status === 'awaiting_agent') && task.runningSessionStartedAt) {
    // Leaving running/awaiting state - accumulate session runtime
    const sessionStart = new Date(task.runningSessionStartedAt).getTime()
    const sessionDuration = Date.now() - sessionStart
    updates.runtimeMs = (task.runtimeMs || 0) + sessionDuration
    updates.runningSessionStartedAt = null

    if (['completed', 'failed', 'cancelled', 'needs_review', 'rejected'].includes(status)) {
      updates.completedAt = now
    }
  } else if (['completed', 'failed', 'cancelled', 'needs_review', 'rejected'].includes(status)) {
    updates.completedAt = now
  }

  return updateTask(projectId, taskId, updates)
}

/**
 * Mark task as started
 */
export async function startTask(
  projectId: string,
  taskId: string
): Promise<TaskManifest | null> {
  const now = new Date().toISOString()
  return updateTask(projectId, taskId, {
    status: 'running',
    startedAt: now,
    runningSessionStartedAt: now
  })
}

/**
 * Mark task as completed (accumulates final runtime session)
 * Exit code 0 goes to 'needs_review', non-zero goes to 'failed'
 */
export async function completeTask(
  projectId: string,
  taskId: string,
  exitCode: number
): Promise<TaskManifest | null> {
  const task = await loadTask(projectId, taskId)
  if (!task) return null

  const now = new Date().toISOString()
  let finalRuntimeMs = task.runtimeMs || 0

  // If task was running, add final session duration
  if (task.runningSessionStartedAt) {
    const sessionStart = new Date(task.runningSessionStartedAt).getTime()
    finalRuntimeMs += Date.now() - sessionStart
  }

  return updateTask(projectId, taskId, {
    status: exitCode === 0 ? 'needs_review' : 'failed',
    exitCode,
    completedAt: now,
    runtimeMs: finalRuntimeMs,
    runningSessionStartedAt: null
  })
}

// ============ Task Log ============

/**
 * Append to task execution log
 */
export async function appendTaskLog(
  projectId: string,
  taskId: string,
  content: string
): Promise<void> {
  const path = getTaskLogPath(projectId, taskId)
  await appendToFile(path, content)
}

/**
 * Read task execution log
 */
export async function readTaskLog(
  projectId: string,
  taskId: string
): Promise<string | null> {
  const path = getTaskLogPath(projectId, taskId)
  return readText(path)
}

// ============ Iteration Log ============

/**
 * Append to iteration-specific log
 */
export async function appendIterationLog(
  projectId: string,
  taskId: string,
  iteration: number,
  content: string
): Promise<void> {
  const runsDir = getTaskRunsDir(projectId, taskId)
  await ensureDir(runsDir)
  const path = getIterationLogPath(projectId, taskId, iteration)
  await appendToFile(path, content)
}

/**
 * Read iteration-specific log
 * Falls back to legacy execution.log for iteration 1 if runs/run-1.log doesn't exist
 */
export async function readIterationLog(
  projectId: string,
  taskId: string,
  iteration: number
): Promise<string | null> {
  const path = getIterationLogPath(projectId, taskId, iteration)
  const content = await readText(path)

  // For iteration 1, fall back to legacy execution.log if new format doesn't exist
  if (content === null && iteration === 1) {
    return readTaskLog(projectId, taskId)
  }

  return content
}

// ============ Iteration Management ============

/**
 * Complete an iteration - records iteration metadata and updates task status
 */
export async function completeIteration(
  projectId: string,
  taskId: string,
  exitCode: number,
  errorMessage?: string
): Promise<TaskManifest | null> {
  const task = await loadTask(projectId, taskId)
  if (!task) return null

  const now = new Date().toISOString()
  let finalRuntimeMs = task.runtimeMs || 0

  // Calculate final runtime for this iteration
  if (task.runningSessionStartedAt) {
    const sessionStart = new Date(task.runningSessionStartedAt).getTime()
    finalRuntimeMs += Date.now() - sessionStart
  }

  const finalStatus: TaskIteration['finalStatus'] =
    exitCode === 0 ? 'needs_review' : 'failed'

  // Detect if this iteration completed in plan mode
  const currentIterationNum = task.currentIteration || 1
  const planModeInfo = exitCode === 0
    ? await detectPlanMode(projectId, taskId, currentIterationNum)
    : { isPlanMode: false, planFilePath: null }

  // Create iteration record
  const iteration: TaskIteration = {
    iteration: currentIterationNum,
    prompt: task.prompt,
    startedAt: task.startedAt || now,
    completedAt: now,
    exitCode,
    runtimeMs: finalRuntimeMs,
    errorMessage: errorMessage || task.errorMessage || null,
    finalStatus,
    isPlanMode: planModeInfo.isPlanMode,
    planFilePath: planModeInfo.planFilePath
  }

  // Add to iterations history
  const iterations = [...(task.iterations || []), iteration]

  return updateTask(projectId, taskId, {
    status: finalStatus,
    exitCode,
    completedAt: now,
    runtimeMs: finalRuntimeMs,
    runningSessionStartedAt: null,
    errorMessage: errorMessage || null,
    iterations,
    isPlanMode: planModeInfo.isPlanMode,
    planFilePath: planModeInfo.planFilePath
  })
}

/**
 * Start a new iteration (for re-prompt)
 * Increments currentIteration, updates prompt, resets to queued
 */
export async function startNewIteration(
  projectId: string,
  taskId: string,
  newPrompt: string
): Promise<TaskManifest | null> {
  const task = await loadTask(projectId, taskId)
  if (!task) return null

  // Only allow re-prompt from needs_review or failed states
  if (!['needs_review', 'failed'].includes(task.status)) {
    return null
  }

  const nextIteration = (task.currentIteration || 1) + 1

  return updateTask(projectId, taskId, {
    prompt: newPrompt,
    status: 'queued',
    currentIteration: nextIteration,
    // Reset execution fields for new iteration
    startedAt: null,
    completedAt: null,
    exitCode: null,
    errorMessage: null,
    runtimeMs: 0,
    runningSessionStartedAt: null
  })
}

// ============ Review Actions ============

/**
 * Accept a task (moves from needs_review to accepted)
 */
export async function acceptTask(
  projectId: string,
  taskId: string
): Promise<TaskManifest | null> {
  const task = await loadTask(projectId, taskId)
  if (!task) return null

  // Only allow accepting from needs_review
  if (task.status !== 'needs_review') {
    return null
  }

  return updateTask(projectId, taskId, {
    status: 'completed',
    completedAt: new Date().toISOString()
  })
}

/**
 * Reject a task (moves from needs_review to rejected)
 */
export async function rejectTask(
  projectId: string,
  taskId: string
): Promise<TaskManifest | null> {
  const task = await loadTask(projectId, taskId)
  if (!task) return null

  // Only allow rejecting from needs_review
  if (task.status !== 'needs_review') {
    return null
  }

  return updateTask(projectId, taskId, {
    status: 'rejected',
    completedAt: new Date().toISOString()
  })
}
