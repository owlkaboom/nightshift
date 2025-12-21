/**
 * IPC handlers for task operations
 */

import { ipcMain } from 'electron'
import { readFile } from 'fs/promises'
import type { CreateTaskData, FormattedPrompt } from '@shared/ipc-types'
import type { TaskManifest, TaskStatus } from '@shared/types'
import {
  loadProjectTasks,
  loadAllTasks,
  getQueuedTasks,
  getCompletedTasksByDateRange,
  loadTask,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  readTaskLog,
  readIterationLog,
  acceptTask,
  rejectTask,
  startNewIteration,
  startReplyIteration,
  reorderTasks,
  addTaskSummary
} from '@main/storage'
import { generateRetryContext } from '@main/utils/retry-context'
import { formatVoicePrompt } from '@main/agents/prompt-formatter'

export function registerTaskHandlers(): void {
  // List tasks for a project
  ipcMain.handle(
    'task:list',
    async (_, projectId: string): Promise<TaskManifest[]> => {
      return loadProjectTasks(projectId)
    }
  )

  // List all tasks across all projects
  ipcMain.handle('task:listAll', async (): Promise<TaskManifest[]> => {
    return loadAllTasks()
  })

  // List queued tasks (sorted by position)
  ipcMain.handle('task:listQueued', async (): Promise<TaskManifest[]> => {
    return getQueuedTasks()
  })

  // List completed tasks by date range
  ipcMain.handle(
    'task:listCompletedByDateRange',
    async (
      _,
      startDate: string,
      endDate: string,
      projectId?: string
    ): Promise<TaskManifest[]> => {
      return getCompletedTasksByDateRange(startDate, endDate, projectId)
    }
  )

  // Get a single task
  ipcMain.handle(
    'task:get',
    async (_, projectId: string, taskId: string): Promise<TaskManifest | null> => {
      return loadTask(projectId, taskId)
    }
  )

  // Create a new task
  ipcMain.handle(
    'task:create',
    async (_, data: CreateTaskData): Promise<TaskManifest> => {
      return createTask(data.prompt, data.projectId, {
        groupId: data.groupId,
        contextFiles: data.contextFiles,
        includeClaudeMd: data.includeClaudeMd,
        enabledSkills: data.enabledSkills,
        agentId: data.agentId ?? null,
        model: data.model ?? null,
        thinkingMode: data.thinkingMode ?? null,
        planFilePath: data.planFilePath ?? null
      })
    }
  )

  // Update a task
  ipcMain.handle(
    'task:update',
    async (
      _,
      projectId: string,
      taskId: string,
      updates: Partial<TaskManifest>
    ): Promise<TaskManifest | null> => {
      return updateTask(projectId, taskId, updates)
    }
  )

  // Delete a task
  ipcMain.handle(
    'task:delete',
    async (_, projectId: string, taskId: string): Promise<boolean> => {
      return deleteTask(projectId, taskId)
    }
  )

  // Update task status
  ipcMain.handle(
    'task:updateStatus',
    async (
      _,
      projectId: string,
      taskId: string,
      status: TaskStatus
    ): Promise<TaskManifest | null> => {
      return updateTaskStatus(projectId, taskId, status)
    }
  )

  // Read task execution log
  ipcMain.handle(
    'task:readLog',
    async (_, projectId: string, taskId: string): Promise<string | null> => {
      return readTaskLog(projectId, taskId)
    }
  )

  // Read iteration-specific log
  ipcMain.handle(
    'task:readIterationLog',
    async (
      _,
      projectId: string,
      taskId: string,
      iteration: number
    ): Promise<string | null> => {
      return readIterationLog(projectId, taskId, iteration)
    }
  )

  // Read plan file content
  ipcMain.handle(
    'task:readPlanFile',
    async (_, planFilePath: string): Promise<string | null> => {
      try {
        const content = await readFile(planFilePath, 'utf-8')
        return content
      } catch (err) {
        console.error('Failed to read plan file:', err)
        return null
      }
    }
  )

  // Accept a task (needs_review -> completed)
  ipcMain.handle(
    'task:accept',
    async (_, projectId: string, taskId: string): Promise<TaskManifest | null> => {
      const result = await acceptTask(projectId, taskId)

      // Save task summary to project memory for context continuity
      if (result) {
        try {
          // Use first 100 characters of prompt as summary
          const summary = result.prompt.slice(0, 100) + (result.prompt.length > 100 ? '...' : '')
          await addTaskSummary(projectId, {
            taskId: result.id,
            summary,
            modifiedFiles: result.contextFiles || [],
            completedAt: result.completedAt || new Date().toISOString(),
            wasAccepted: true
          })
        } catch (err) {
          // Don't fail the accept if memory save fails
          console.error('Failed to save task summary to memory:', err)
        }
      }

      return result
    }
  )

  // Reject a task (needs_review -> rejected)
  ipcMain.handle(
    'task:reject',
    async (_, projectId: string, taskId: string): Promise<TaskManifest | null> => {
      const result = await rejectTask(projectId, taskId)

      // Save task summary to project memory (rejected tasks are also useful context)
      if (result) {
        try {
          // Use first 100 characters of prompt as summary
          const summary = result.prompt.slice(0, 100) + (result.prompt.length > 100 ? '...' : '')
          await addTaskSummary(projectId, {
            taskId: result.id,
            summary,
            modifiedFiles: [],
            completedAt: result.completedAt || new Date().toISOString(),
            wasAccepted: false
          })
        } catch (err) {
          // Don't fail the reject if memory save fails
          console.error('Failed to save task summary to memory:', err)
        }
      }

      return result
    }
  )

  // Re-prompt a task (starts new iteration)
  ipcMain.handle(
    'task:reprompt',
    async (
      _,
      projectId: string,
      taskId: string,
      newPrompt: string
    ): Promise<TaskManifest | null> => {
      return startNewIteration(projectId, taskId, newPrompt)
    }
  )

  // Reply to a task (continues conversation with --resume)
  ipcMain.handle(
    'task:reply',
    async (
      _,
      projectId: string,
      taskId: string,
      replyMessage: string
    ): Promise<TaskManifest | null> => {
      return startReplyIteration(projectId, taskId, replyMessage)
    }
  )

  // Reorder tasks (update queue positions)
  ipcMain.handle(
    'task:reorder',
    async (
      _,
      updates: Array<{ projectId: string; taskId: string; queuePosition: number }>
    ): Promise<TaskManifest[]> => {
      return reorderTasks(updates)
    }
  )

  // Accept a plan mode task and create an execution task
  ipcMain.handle(
    'task:acceptPlanAndCreateTask',
    async (
      _,
      projectId: string,
      taskId: string,
      executionPrompt: string
    ): Promise<{ planTask: TaskManifest; executionTask: TaskManifest }> => {
      // First, accept the plan task
      const planTask = await acceptTask(projectId, taskId)
      if (!planTask) {
        throw new Error(`Failed to accept plan task ${taskId}`)
      }

      // Save plan task summary to memory
      try {
        const planSummary = planTask.prompt.slice(0, 100) + (planTask.prompt.length > 100 ? '...' : '')
        await addTaskSummary(projectId, {
          taskId: planTask.id,
          summary: `[Plan] ${planSummary}`,
          modifiedFiles: [],
          completedAt: planTask.completedAt || new Date().toISOString(),
          wasAccepted: true
        })
      } catch (err) {
        console.error('Failed to save plan task summary to memory:', err)
      }

      // Create a new execution task with the provided prompt
      const executionTask = await createTask(
        executionPrompt,
        projectId,
        {
          groupId: planTask.groupId,
          contextFiles: planTask.contextFiles,
          includeClaudeMd: planTask.includeClaudeMd,
          enabledSkills: planTask.enabledSkills,
          agentId: planTask.agentId,
          model: planTask.model,
          source: 'template', // Mark as derived from a plan
          sourceRef: planTask.id // Reference to the original plan task
        }
      )

      return { planTask, executionTask }
    }
  )

  // Generate retry context for a failed/interrupted task
  ipcMain.handle(
    'task:generateRetryContext',
    async (
      _,
      projectId: string,
      taskId: string,
      iteration?: number
    ): Promise<{
      prompt: string
      summary: string
      actionCount: number
      hasProgress: boolean
    } | null> => {
      const task = await loadTask(projectId, taskId)
      if (!task) {
        return null
      }
      return generateRetryContext(task, iteration)
    }
  )

  // Format voice-transcribed prompt into markdown with title
  ipcMain.handle(
    'task:formatVoicePrompt',
    async (_, rawPrompt: string): Promise<FormattedPrompt> => {
      return formatVoicePrompt(rawPrompt)
    }
  )
}
