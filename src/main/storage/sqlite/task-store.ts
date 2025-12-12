/**
 * SQLite Task Store
 *
 * High-performance task storage using SQLite.
 * Maintains same API as the file-based task store for compatibility.
 */

import type { TaskManifest, TaskStatus, TaskIteration } from '@shared/types'
import { createTaskManifest } from '@shared/types'
import { generateTaskId } from '@shared/constants'
import { getDatabase, runTransaction } from '../database'
import {
  getTaskLogPath,
  getTaskRunsDir,
  getIterationLogPath,
  getTaskDir
} from '../../utils/paths'
import { appendToFile, ensureDir, fileExists } from '../file-store'
import { rm } from 'fs/promises'
import { readFileAutoDecompress, compressFile } from '../compression'

// ============ Type Conversions ============

interface TaskRow {
  id: string
  project_id: string
  group_id: string | null
  tag_ids: string
  prompt: string
  status: string
  queue_position: number
  source: string
  source_ref: string | null
  external_issue_id: string | null
  external_issue_url: string | null
  integration_id: string | null
  context_files: string
  include_claude_md: number
  enabled_skills: string
  agent_id: string | null
  model: string | null
  thinking_mode: number | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  exit_code: number | null
  error_message: string | null
  cost_estimate: number | null
  runtime_ms: number
  running_session_started_at: string | null
  current_iteration: number
  iterations: string
}

function rowToTask(row: TaskRow): TaskManifest {
  return {
    id: row.id,
    projectId: row.project_id,
    groupId: row.group_id,
    tagIds: JSON.parse(row.tag_ids),
    prompt: row.prompt,
    status: row.status as TaskStatus,
    queuePosition: row.queue_position,
    source: row.source as TaskManifest['source'],
    sourceRef: row.source_ref,
    externalIssueId: row.external_issue_id,
    externalIssueUrl: row.external_issue_url,
    integrationId: row.integration_id,
    contextFiles: JSON.parse(row.context_files),
    includeClaudeMd: row.include_claude_md === 1,
    enabledSkills: JSON.parse(row.enabled_skills),
    agentId: row.agent_id,
    model: row.model,
    thinkingMode: row.thinking_mode === null ? null : row.thinking_mode === 1,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    exitCode: row.exit_code,
    errorMessage: row.error_message,
    costEstimate: row.cost_estimate,
    runtimeMs: row.runtime_ms,
    runningSessionStartedAt: row.running_session_started_at,
    currentIteration: row.current_iteration,
    iterations: JSON.parse(row.iterations)
  }
}

function taskToParams(task: TaskManifest): Record<string, unknown> {
  return {
    id: task.id,
    project_id: task.projectId,
    group_id: task.groupId,
    tag_ids: JSON.stringify(task.tagIds),
    prompt: task.prompt,
    status: task.status,
    queue_position: task.queuePosition,
    source: task.source,
    source_ref: task.sourceRef,
    external_issue_id: task.externalIssueId,
    external_issue_url: task.externalIssueUrl,
    integration_id: task.integrationId,
    context_files: JSON.stringify(task.contextFiles),
    include_claude_md: task.includeClaudeMd ? 1 : 0,
    enabled_skills: JSON.stringify(task.enabledSkills),
    agent_id: task.agentId,
    model: task.model,
    thinking_mode: task.thinkingMode === null ? null : task.thinkingMode ? 1 : 0,
    created_at: task.createdAt,
    started_at: task.startedAt,
    completed_at: task.completedAt,
    exit_code: task.exitCode,
    error_message: task.errorMessage,
    cost_estimate: task.costEstimate,
    runtime_ms: task.runtimeMs,
    running_session_started_at: task.runningSessionStartedAt,
    current_iteration: task.currentIteration,
    iterations: JSON.stringify(task.iterations)
  }
}

// ============ Core CRUD Operations ============

/**
 * Load a task manifest
 */
export async function loadTask(
  projectId: string,
  taskId: string
): Promise<TaskManifest | null> {
  const db = getDatabase()
  const row = db
    .prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?')
    .get(taskId, projectId) as TaskRow | undefined

  return row ? rowToTask(row) : null
}

/**
 * Save a task manifest
 */
export async function saveTask(task: TaskManifest): Promise<void> {
  const db = getDatabase()
  const params = taskToParams(task)

  db.prepare(`
    INSERT OR REPLACE INTO tasks (
      id, project_id, group_id, tag_ids, prompt, status, queue_position,
      source, source_ref, external_issue_id, external_issue_url, integration_id,
      context_files, include_claude_md, enabled_skills,
      agent_id, model, thinking_mode, created_at, started_at, completed_at, exit_code,
      error_message, cost_estimate, runtime_ms, running_session_started_at,
      current_iteration, iterations
    ) VALUES (
      @id, @project_id, @group_id, @tag_ids, @prompt, @status, @queue_position,
      @source, @source_ref, @external_issue_id, @external_issue_url, @integration_id,
      @context_files, @include_claude_md, @enabled_skills,
      @agent_id, @model, @thinking_mode, @created_at, @started_at, @completed_at, @exit_code,
      @error_message, @cost_estimate, @runtime_ms, @running_session_started_at,
      @current_iteration, @iterations
    )
  `).run(params)
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

  console.log('[task-store] updateTask - before:', {
    agentId: task.agentId,
    model: task.model
  })
  console.log('[task-store] updateTask - updates:', {
    agentId: updates.agentId,
    model: updates.model
  })

  const updated = { ...task, ...updates }

  console.log('[task-store] updateTask - after merge:', {
    agentId: updated.agentId,
    model: updated.model
  })

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
  const db = getDatabase()

  const result = db
    .prepare('DELETE FROM tasks WHERE id = ? AND project_id = ?')
    .run(taskId, projectId)

  // Also clean up log files if they exist
  const taskDir = getTaskDir(projectId, taskId)
  if (await fileExists(taskDir)) {
    await rm(taskDir, { recursive: true, force: true })
  }

  return result.changes > 0
}

// ============ Query Operations ============

/**
 * Load all tasks for a project
 */
export async function loadProjectTasks(
  projectId: string
): Promise<TaskManifest[]> {
  const db = getDatabase()
  const rows = db
    .prepare('SELECT * FROM tasks WHERE project_id = ?')
    .all(projectId) as TaskRow[]

  return rows.map(rowToTask)
}

/**
 * Load all tasks across all projects
 */
export async function loadAllTasks(): Promise<TaskManifest[]> {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM tasks').all() as TaskRow[]

  return rows.map(rowToTask)
}

/**
 * Get tasks by status
 */
export async function getTasksByStatus(
  status: TaskStatus
): Promise<TaskManifest[]> {
  const db = getDatabase()
  const rows = db
    .prepare('SELECT * FROM tasks WHERE status = ?')
    .all(status) as TaskRow[]

  return rows.map(rowToTask)
}

/**
 * Get queued tasks sorted by queue position
 */
export async function getQueuedTasks(): Promise<TaskManifest[]> {
  const db = getDatabase()
  const rows = db
    .prepare('SELECT * FROM tasks WHERE status = ? ORDER BY queue_position ASC')
    .all('queued') as TaskRow[]

  return rows.map(rowToTask)
}

/**
 * Get completed tasks by date range
 * @param startDate ISO date string (inclusive)
 * @param endDate ISO date string (inclusive)
 * @param projectId Optional project filter
 */
export async function getCompletedTasksByDateRange(
  startDate: string,
  endDate: string,
  projectId?: string
): Promise<TaskManifest[]> {
  const db = getDatabase()

  // Get tasks with completed_at between start and end date (inclusive)
  // Include accepted, rejected, and needs_review statuses
  let query = `
    SELECT * FROM tasks
    WHERE completed_at IS NOT NULL
    AND date(completed_at) >= date(?)
    AND date(completed_at) <= date(?)
  `

  const params: unknown[] = [startDate, endDate]

  if (projectId) {
    query += ' AND project_id = ?'
    params.push(projectId)
  }

  query += ' ORDER BY completed_at DESC'

  const rows = db.prepare(query).all(...params) as TaskRow[]
  return rows.map(rowToTask)
}

/**
 * Reorder tasks by updating their queue positions
 * Uses a transaction for atomic updates
 */
export async function reorderTasks(
  updates: Array<{ projectId: string; taskId: string; queuePosition: number }>
): Promise<TaskManifest[]> {
  const db = getDatabase()

  const updatedTasks = runTransaction(() => {
    const updateStmt = db.prepare(`
      UPDATE tasks SET queue_position = ? WHERE id = ? AND project_id = ?
    `)

    const selectStmt = db.prepare(`
      SELECT * FROM tasks WHERE id = ? AND project_id = ?
    `)

    const results: TaskManifest[] = []

    for (const { projectId, taskId, queuePosition } of updates) {
      updateStmt.run(queuePosition, taskId, projectId)
      const row = selectStmt.get(taskId, projectId) as TaskRow | undefined
      if (row) {
        results.push(rowToTask(row))
      }
    }

    return results
  })

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
    if (!task.startedAt) {
      updates.startedAt = now
    }
  } else if (status === 'running') {
    if (!task.startedAt) {
      updates.startedAt = now
    }
    updates.runningSessionStartedAt = now
  } else if (
    (task.status === 'running' || task.status === 'awaiting_agent') &&
    task.runningSessionStartedAt
  ) {
    const sessionStart = new Date(task.runningSessionStartedAt).getTime()
    const sessionDuration = Date.now() - sessionStart
    updates.runtimeMs = (task.runtimeMs || 0) + sessionDuration
    updates.runningSessionStartedAt = null

    if (
      [
        'completed',
        'failed',
        'cancelled',
        'needs_review',
        'rejected'
      ].includes(status)
    ) {
      updates.completedAt = now
    }
  } else if (
    [
      'completed',
      'failed',
      'cancelled',
      'needs_review',
      'rejected'
    ].includes(status)
  ) {
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
 * Mark task as completed
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

// ============ Task Log (File-based) ============

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
 * Transparently handles both compressed (.gz) and uncompressed log files
 */
export async function readTaskLog(
  projectId: string,
  taskId: string
): Promise<string | null> {
  const path = getTaskLogPath(projectId, taskId)
  return readFileAutoDecompress(path)
}

// ============ Iteration Log (File-based) ============

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
 * Transparently handles both compressed (.gz) and uncompressed log files
 */
export async function readIterationLog(
  projectId: string,
  taskId: string,
  iteration: number
): Promise<string | null> {
  const path = getIterationLogPath(projectId, taskId, iteration)
  const content = await readFileAutoDecompress(path)

  // Fallback for iteration 1 -> legacy execution.log
  if (content === null && iteration === 1) {
    return readTaskLog(projectId, taskId)
  }

  return content
}

// ============ Iteration Management ============

/**
 * Complete an iteration
 */
export async function completeIteration(
  projectId: string,
  taskId: string,
  exitCode: number,
  errorMessage?: string,
  incompletionAnalysis?: {
    isIncomplete: boolean
    reason?: 'multi-phase' | 'todo-items' | 'continuation-signal' | 'approval-needed' | 'token-limit'
    details?: string
    suggestedNextSteps?: string[]
  }
): Promise<TaskManifest | null> {
  const task = await loadTask(projectId, taskId)
  if (!task) return null

  const now = new Date().toISOString()
  let finalRuntimeMs = task.runtimeMs || 0

  if (task.runningSessionStartedAt) {
    const sessionStart = new Date(task.runningSessionStartedAt).getTime()
    finalRuntimeMs += Date.now() - sessionStart
  }

  const finalStatus: TaskIteration['finalStatus'] =
    exitCode === 0 ? 'needs_review' : 'failed'

  const iteration: TaskIteration = {
    iteration: task.currentIteration || 1,
    prompt: task.prompt,
    startedAt: task.startedAt || now,
    completedAt: now,
    exitCode,
    runtimeMs: finalRuntimeMs,
    errorMessage: errorMessage || task.errorMessage || null,
    finalStatus
  }

  const iterations = [...(task.iterations || []), iteration]

  // Prepare update object with incompletion detection results
  const updateData: Partial<TaskManifest> = {
    status: finalStatus,
    exitCode,
    completedAt: now,
    runtimeMs: finalRuntimeMs,
    runningSessionStartedAt: null,
    errorMessage: errorMessage || null,
    iterations
  }

  // Add incomplete work detection results if task completed successfully
  if (exitCode === 0 && incompletionAnalysis) {
    updateData.needsContinuation = incompletionAnalysis.isIncomplete
    updateData.continuationReason = incompletionAnalysis.reason
    updateData.continuationDetails = incompletionAnalysis.details
    updateData.suggestedNextSteps = incompletionAnalysis.suggestedNextSteps
  } else {
    // Clear continuation flags if task failed or no analysis provided
    updateData.needsContinuation = false
    updateData.continuationReason = undefined
    updateData.continuationDetails = undefined
    updateData.suggestedNextSteps = undefined
  }

  const result = await updateTask(projectId, taskId, updateData)

  // Compress the completed iteration log
  // This runs asynchronously after updating the task - errors are logged but don't fail the operation
  const currentIteration = task.currentIteration || 1
  const logPath = getIterationLogPath(projectId, taskId, currentIteration)
  compressFile(logPath).catch((err) => {
    console.error('[TaskStore] Failed to compress iteration log:', logPath, err)
  })

  // Also compress legacy execution.log if this is iteration 1
  if (currentIteration === 1) {
    const legacyPath = getTaskLogPath(projectId, taskId)
    compressFile(legacyPath).catch((err) => {
      console.error('[TaskStore] Failed to compress legacy execution log:', legacyPath, err)
    })
  }

  return result
}

/**
 * Start a new iteration (for re-prompt)
 */
export async function startNewIteration(
  projectId: string,
  taskId: string,
  newPrompt: string
): Promise<TaskManifest | null> {
  const task = await loadTask(projectId, taskId)
  if (!task) return null

  if (!['needs_review', 'failed'].includes(task.status)) {
    return null
  }

  const nextIteration = (task.currentIteration || 1) + 1

  return updateTask(projectId, taskId, {
    prompt: newPrompt,
    status: 'queued',
    currentIteration: nextIteration,
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
 * Accept a task
 */
export async function acceptTask(
  projectId: string,
  taskId: string
): Promise<TaskManifest | null> {
  const task = await loadTask(projectId, taskId)
  if (!task) return null

  if (task.status !== 'needs_review') {
    return null
  }

  return updateTask(projectId, taskId, {
    status: 'completed',
    completedAt: new Date().toISOString()
  })
}

/**
 * Reject a task
 */
export async function rejectTask(
  projectId: string,
  taskId: string
): Promise<TaskManifest | null> {
  const task = await loadTask(projectId, taskId)
  if (!task) return null

  if (task.status !== 'needs_review') {
    return null
  }

  return updateTask(projectId, taskId, {
    status: 'rejected',
    completedAt: new Date().toISOString()
  })
}
