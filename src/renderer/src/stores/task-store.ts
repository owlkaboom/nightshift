/**
 * Zustand store for task state
 */

import { create } from 'zustand'
import type { TaskManifest, TaskStatus } from '@shared/types'
import type { CreateTaskData, ReorderTaskData } from '@shared/ipc-types'

// Track if we've set up the IPC listener
let ipcListenerSetup = false

interface TaskState {
  tasks: TaskManifest[]
  queuedTasks: TaskManifest[]
  loading: boolean
  error: string | null
  selectedTaskId: string | null
  autoPlay: boolean

  // Actions
  fetchTasks: (projectId?: string) => Promise<void>
  fetchQueuedTasks: () => Promise<void>
  createTask: (data: CreateTaskData) => Promise<TaskManifest>
  updateTask: (
    projectId: string,
    taskId: string,
    updates: Partial<TaskManifest>
  ) => Promise<void>
  deleteTask: (projectId: string, taskId: string) => Promise<void>
  updateTaskStatus: (
    projectId: string,
    taskId: string,
    status: TaskStatus
  ) => Promise<void>
  startTask: (projectId: string, taskId: string) => Promise<boolean>
  cancelTask: (taskId: string) => Promise<boolean>
  startNextTask: () => Promise<boolean>
  setAutoPlay: (enabled: boolean) => void
  selectTask: (id: string | null) => void
  getTask: (projectId: string, taskId: string) => TaskManifest | undefined
  getTasksByProject: (projectId: string) => TaskManifest[]
  getRunningTasks: () => TaskManifest[]
  getNextQueuedTask: () => TaskManifest | undefined
  clearError: () => void
  // Review actions
  acceptTask: (projectId: string, taskId: string) => Promise<TaskManifest | null>
  rejectTask: (projectId: string, taskId: string) => Promise<TaskManifest | null>
  repromptTask: (
    projectId: string,
    taskId: string,
    newPrompt: string
  ) => Promise<TaskManifest | null>
  acceptPlanAndCreateTask: (
    projectId: string,
    taskId: string,
    executionPrompt: string
  ) => Promise<{ planTask: TaskManifest; executionTask: TaskManifest } | null>
  reorderTasks: (updates: ReorderTaskData[]) => Promise<void>
  // Internal: update task from IPC event
  _updateTaskFromEvent: (task: TaskManifest) => void
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  queuedTasks: [],
  loading: false,
  error: null,
  selectedTaskId: null,
  autoPlay: false,

  fetchTasks: async (projectId?: string) => {
    set({ loading: true, error: null })
    try {
      const tasks = projectId
        ? await window.api.listTasks(projectId)
        : await window.api.listAllTasks()
      set({ tasks, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch tasks',
        loading: false
      })
    }
  },

  fetchQueuedTasks: async () => {
    try {
      const queuedTasks = await window.api.listQueuedTasks()
      set({ queuedTasks })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch queued tasks'
      })
    }
  },

  createTask: async (data: CreateTaskData) => {
    set({ loading: true, error: null })
    try {
      const task = await window.api.createTask(data)
      set((state) => ({
        tasks: [...state.tasks, task],
        queuedTasks:
          task.status === 'queued' ? [...state.queuedTasks, task] : state.queuedTasks,
        loading: false
      }))
      return task
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create task',
        loading: false
      })
      throw error
    }
  },

  updateTask: async (
    projectId: string,
    taskId: string,
    updates: Partial<TaskManifest>
  ) => {
    set({ loading: true, error: null })
    try {
      const updated = await window.api.updateTask(projectId, taskId, updates)
      if (updated) {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId && t.projectId === projectId ? updated : t
          ),
          queuedTasks: state.queuedTasks.map((t) =>
            t.id === taskId && t.projectId === projectId ? updated : t
          ),
          loading: false
        }))
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update task',
        loading: false
      })
      throw error
    }
  },

  deleteTask: async (projectId: string, taskId: string) => {
    set({ loading: true, error: null })
    try {
      await window.api.deleteTask(projectId, taskId)
      set((state) => ({
        tasks: state.tasks.filter(
          (t) => !(t.id === taskId && t.projectId === projectId)
        ),
        queuedTasks: state.queuedTasks.filter(
          (t) => !(t.id === taskId && t.projectId === projectId)
        ),
        selectedTaskId:
          state.selectedTaskId === taskId ? null : state.selectedTaskId,
        loading: false
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete task',
        loading: false
      })
      throw error
    }
  },

  updateTaskStatus: async (
    projectId: string,
    taskId: string,
    status: TaskStatus
  ) => {
    try {
      const updated = await window.api.updateTaskStatus(projectId, taskId, status)
      if (updated) {
        set((state) => {
          const newTasks = state.tasks.map((t) =>
            t.id === taskId && t.projectId === projectId ? updated : t
          )

          // Update queued tasks list based on new status
          let newQueuedTasks = state.queuedTasks
          if (status === 'queued') {
            // Add to queued if not already there
            if (!state.queuedTasks.some((t) => t.id === taskId)) {
              newQueuedTasks = [...state.queuedTasks, updated]
            }
          } else {
            // Remove from queued if status changed away from queued
            newQueuedTasks = state.queuedTasks.filter(
              (t) => !(t.id === taskId && t.projectId === projectId)
            )
          }

          return { tasks: newTasks, queuedTasks: newQueuedTasks }
        })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update task status'
      })
      throw error
    }
  },

  selectTask: (id: string | null) => {
    set({ selectedTaskId: id })
  },

  getTask: (projectId: string, taskId: string) => {
    return get().tasks.find((t) => t.id === taskId && t.projectId === projectId)
  },

  getTasksByProject: (projectId: string) => {
    return get().tasks.filter((t) => t.projectId === projectId)
  },

  getRunningTasks: () => {
    // Include both running and awaiting_agent tasks as "in progress"
    return get().tasks.filter((t) => t.status === 'running' || t.status === 'awaiting_agent')
  },

  getNextQueuedTask: () => {
    const queued = get().tasks.filter((t) => t.status === 'queued')
    // Sort by queue position
    queued.sort((a, b) => a.queuePosition - b.queuePosition)
    return queued[0]
  },

  startTask: async (projectId: string, taskId: string) => {
    set({ error: null })
    try {
      const success = await window.api.startTask(projectId, taskId)
      if (success) {
        // Refresh tasks to get updated status
        await get().fetchTasks()
      }
      return success
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to start task'
      })
      return false
    }
  },

  cancelTask: async (taskId: string) => {
    set({ error: null })
    try {
      const success = await window.api.cancelTask(taskId)
      if (success) {
        // Refresh tasks to get updated status
        await get().fetchTasks()
      }
      return success
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to cancel task'
      })
      return false
    }
  },

  startNextTask: async () => {
    const nextTask = get().getNextQueuedTask()
    if (!nextTask) {
      return false
    }
    return get().startTask(nextTask.projectId, nextTask.id)
  },

  setAutoPlay: (enabled: boolean) => {
    set({ autoPlay: enabled })
  },

  clearError: () => {
    set({ error: null })
  },

  // Review actions
  acceptTask: async (projectId: string, taskId: string) => {
    set({ error: null })
    try {
      const updated = await window.api.acceptTask(projectId, taskId)
      if (updated) {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId && t.projectId === projectId ? updated : t
          )
        }))
      }
      return updated
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to accept task'
      })
      return null
    }
  },

  rejectTask: async (projectId: string, taskId: string) => {
    set({ error: null })
    try {
      const updated = await window.api.rejectTask(projectId, taskId)
      if (updated) {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId && t.projectId === projectId ? updated : t
          )
        }))
      }
      return updated
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to reject task'
      })
      return null
    }
  },

  repromptTask: async (projectId: string, taskId: string, newPrompt: string) => {
    set({ error: null })
    try {
      const updated = await window.api.repromptTask(projectId, taskId, newPrompt)
      if (updated) {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId && t.projectId === projectId ? updated : t
          ),
          // Add to queued tasks since it's now queued
          queuedTasks: [...state.queuedTasks.filter(t => t.id !== taskId), updated]
        }))
      }
      return updated
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to re-prompt task'
      })
      return null
    }
  },

  acceptPlanAndCreateTask: async (projectId: string, taskId: string, executionPrompt: string) => {
    set({ error: null })
    try {
      const result = await window.api.acceptPlanAndCreateTask(projectId, taskId, executionPrompt)
      // Update the plan task to accepted status and add new execution task
      set((state) => ({
        tasks: [
          ...state.tasks.map((t) =>
            t.id === taskId && t.projectId === projectId ? result.planTask : t
          ),
          result.executionTask
        ],
        // Add the new execution task to queued tasks
        queuedTasks: [...state.queuedTasks, result.executionTask]
      }))
      return result
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to accept plan and create task'
      })
      return null
    }
  },

  reorderTasks: async (updates: ReorderTaskData[]) => {
    set({ error: null })

    // Create a map of new positions for optimistic update
    const positionMap = new Map(
      updates.map((u) => [`${u.projectId}-${u.taskId}`, u.queuePosition])
    )

    // Optimistically update local state immediately for smooth UX
    set((state) => {
      const newTasks = state.tasks.map((t) => {
        const key = `${t.projectId}-${t.id}`
        const newPosition = positionMap.get(key)
        if (newPosition !== undefined) {
          return { ...t, queuePosition: newPosition }
        }
        return t
      })

      const newQueuedTasks = state.queuedTasks.map((t) => {
        const key = `${t.projectId}-${t.id}`
        const newPosition = positionMap.get(key)
        if (newPosition !== undefined) {
          return { ...t, queuePosition: newPosition }
        }
        return t
      })

      return { tasks: newTasks, queuedTasks: newQueuedTasks }
    })

    try {
      // Persist to backend (fire and forget for smooth UX, errors will show)
      await window.api.reorderTasks(updates)
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to reorder tasks'
      })
      // Refetch to restore correct state on error
      get().fetchTasks()
    }
  },

  // Internal: update task from IPC event (called when main process broadcasts status changes)
  _updateTaskFromEvent: (task: TaskManifest) => {
    set((state) => {
      // Check if task already exists in our state
      const existingIndex = state.tasks.findIndex(
        (t) => t.id === task.id && t.projectId === task.projectId
      )

      let newTasks: TaskManifest[]
      if (existingIndex >= 0) {
        // Update existing task
        newTasks = state.tasks.map((t) =>
          t.id === task.id && t.projectId === task.projectId ? task : t
        )
      } else {
        // Task not in our list yet (shouldn't happen, but handle it)
        newTasks = [...state.tasks, task]
      }

      // Update queued tasks list based on new status
      let newQueuedTasks: TaskManifest[]
      if (task.status === 'queued') {
        // Add to queued if not already there
        if (!state.queuedTasks.some((t) => t.id === task.id)) {
          newQueuedTasks = [...state.queuedTasks, task]
        } else {
          newQueuedTasks = state.queuedTasks.map((t) =>
            t.id === task.id && t.projectId === task.projectId ? task : t
          )
        }
      } else {
        // Remove from queued if status changed away from queued
        newQueuedTasks = state.queuedTasks.filter(
          (t) => !(t.id === task.id && t.projectId === task.projectId)
        )
      }

      return { tasks: newTasks, queuedTasks: newQueuedTasks }
    })
  }
}))

// Set up IPC listener for task status changes from main process
// This runs once when the module is first imported
if (!ipcListenerSetup && typeof window !== 'undefined' && window.api) {
  ipcListenerSetup = true
  window.api.onTaskStatusChanged((task) => {
    useTaskStore.getState()._updateTaskFromEvent(task)
  })
}
