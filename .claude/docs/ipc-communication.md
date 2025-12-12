# IPC Communication

## Overview

Nightshift uses Electron's IPC (Inter-Process Communication) to enable the renderer process (React UI) to communicate with the main process (Node.js). All IPC is type-safe through shared type definitions.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process                          │
│                                                              │
│   Component → Store → window.api.methodName()               │
│                              │                               │
└──────────────────────────────┼───────────────────────────────┘
                               │ contextBridge
┌──────────────────────────────┼───────────────────────────────┐
│                     Preload Script                           │
│                                                              │
│   window.api = {                                            │
│     methodName: (...args) => ipcRenderer.invoke(...)        │
│   }                                                         │
└──────────────────────────────┼───────────────────────────────┘
                               │ ipcMain.handle
┌──────────────────────────────┼───────────────────────────────┐
│                     Main Process                             │
│                                                              │
│   ipcMain.handle('channel', handler)                        │
│                              │                               │
│                         Storage/Agents/Git                   │
└─────────────────────────────────────────────────────────────┘
```

## Type Definitions

All IPC types are defined in `src/shared/ipc-types.ts`:

```typescript
// src/shared/ipc-types.ts

// Channel names as constants
export const IpcChannels = {
  // Tasks
  TASK_CREATE: 'task:create',
  TASK_UPDATE: 'task:update',
  TASK_DELETE: 'task:delete',
  TASK_GET_ALL: 'task:getAll',
  TASK_RUN: 'task:run',
  TASK_CANCEL: 'task:cancel',

  // Projects
  PROJECT_CREATE: 'project:create',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_GET_ALL: 'project:getAll',
  PROJECT_DISCOVER: 'project:discover',

  // Groups
  GROUP_CREATE: 'group:create',
  GROUP_UPDATE: 'group:update',
  GROUP_DELETE: 'group:delete',
  GROUP_GET_ALL: 'group:getAll',

  // Config
  CONFIG_GET: 'config:get',
  CONFIG_UPDATE: 'config:update',

  // Agents
  AGENT_GET_AVAILABLE: 'agent:getAvailable',
  AGENT_CHECK_INSTALLED: 'agent:checkInstalled',

  // Skills
  SKILL_GET_FOR_PROJECT: 'skill:getForProject',
  SKILL_TOGGLE: 'skill:toggle',

  // Git
  GIT_GET_INFO: 'git:getInfo',
  GIT_CREATE_WORKTREE: 'git:createWorktree',
  GIT_REMOVE_WORKTREE: 'git:removeWorktree',

  // Events (main → renderer)
  TASK_OUTPUT: 'task:output',
  TASK_STATUS_CHANGED: 'task:statusChanged',
} as const

// Request/Response types
export interface TaskCreateRequest {
  projectId: string
  title: string
  prompt: string
  contextFiles?: string[]
  skills?: string[]
}

export interface TaskCreateResponse {
  task: Task
}

// ... more type definitions
```

## Preload Script

The preload script exposes a safe API to the renderer:

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '../shared/ipc-types'

const api = {
  // Tasks
  createTask: (data: TaskCreateRequest) =>
    ipcRenderer.invoke(IpcChannels.TASK_CREATE, data),

  updateTask: (id: string, data: Partial<Task>) =>
    ipcRenderer.invoke(IpcChannels.TASK_UPDATE, id, data),

  deleteTask: (id: string) =>
    ipcRenderer.invoke(IpcChannels.TASK_DELETE, id),

  getAllTasks: (projectId: string) =>
    ipcRenderer.invoke(IpcChannels.TASK_GET_ALL, projectId),

  runTask: (taskId: string) =>
    ipcRenderer.invoke(IpcChannels.TASK_RUN, taskId),

  cancelTask: (taskId: string) =>
    ipcRenderer.invoke(IpcChannels.TASK_CANCEL, taskId),

  // Projects
  createProject: (data: ProjectCreateRequest) =>
    ipcRenderer.invoke(IpcChannels.PROJECT_CREATE, data),

  getAllProjects: () =>
    ipcRenderer.invoke(IpcChannels.PROJECT_GET_ALL),

  discoverProjects: (rootPath: string) =>
    ipcRenderer.invoke(IpcChannels.PROJECT_DISCOVER, rootPath),

  // Events (subscriptions)
  onTaskOutput: (callback: (taskId: string, output: string) => void) => {
    const handler = (_event: any, taskId: string, output: string) =>
      callback(taskId, output)
    ipcRenderer.on(IpcChannels.TASK_OUTPUT, handler)
    return () => ipcRenderer.removeListener(IpcChannels.TASK_OUTPUT, handler)
  },

  onTaskStatusChanged: (callback: (task: Task) => void) => {
    const handler = (_event: any, task: Task) => callback(task)
    ipcRenderer.on(IpcChannels.TASK_STATUS_CHANGED, handler)
    return () => ipcRenderer.removeListener(IpcChannels.TASK_STATUS_CHANGED, handler)
  },

  // ... more methods
}

contextBridge.exposeInMainWorld('api', api)

// Type declaration for renderer
declare global {
  interface Window {
    api: typeof api
  }
}
```

## Main Process Handlers

Handlers are organized by domain:

```typescript
// src/main/ipc/task-handlers.ts
import { ipcMain, BrowserWindow } from 'electron'
import { IpcChannels } from '../../shared/ipc-types'
import { TaskStore } from '../storage'

export function registerTaskHandlers(): void {
  const taskStore = TaskStore.getInstance()

  ipcMain.handle(IpcChannels.TASK_CREATE, async (_event, data) => {
    const task = await taskStore.createTask(data.projectId, data)
    return { task }
  })

  ipcMain.handle(IpcChannels.TASK_UPDATE, async (_event, id, data) => {
    const task = await taskStore.updateTask(id, data)
    return { task }
  })

  ipcMain.handle(IpcChannels.TASK_DELETE, async (_event, id) => {
    await taskStore.deleteTask(id)
    return { success: true }
  })

  ipcMain.handle(IpcChannels.TASK_GET_ALL, async (_event, projectId) => {
    const tasks = await taskStore.getTasksForProject(projectId)
    return { tasks }
  })

  ipcMain.handle(IpcChannels.TASK_RUN, async (_event, taskId) => {
    // Handled by agent-handlers.ts
  })
}

// Emit events to renderer
export function emitTaskOutput(taskId: string, output: string): void {
  const windows = BrowserWindow.getAllWindows()
  windows.forEach(win => {
    win.webContents.send(IpcChannels.TASK_OUTPUT, taskId, output)
  })
}

export function emitTaskStatusChanged(task: Task): void {
  const windows = BrowserWindow.getAllWindows()
  windows.forEach(win => {
    win.webContents.send(IpcChannels.TASK_STATUS_CHANGED, task)
  })
}
```

### Handler Registration

```typescript
// src/main/ipc/index.ts
import { registerTaskHandlers } from './task-handlers'
import { registerProjectHandlers } from './project-handlers'
import { registerGroupHandlers } from './group-handlers'
import { registerConfigHandlers } from './config-handlers'
import { registerAgentHandlers } from './agent-handlers'
import { registerSkillHandlers } from './skill-handlers'
import { registerGitHandlers } from './git-handlers'

export function registerAllHandlers(): void {
  registerTaskHandlers()
  registerProjectHandlers()
  registerGroupHandlers()
  registerConfigHandlers()
  registerAgentHandlers()
  registerSkillHandlers()
  registerGitHandlers()
}
```

## Usage in Renderer

### Store Integration

```typescript
// src/renderer/src/stores/task-store.ts
import { create } from 'zustand'
import type { Task } from '@shared/types'

interface TaskStore {
  tasks: Task[]
  loading: boolean

  // Actions
  loadTasks: (projectId: string) => Promise<void>
  createTask: (projectId: string, data: CreateTaskInput) => Promise<Task>
  runTask: (taskId: string) => Promise<void>
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  loading: false,

  loadTasks: async (projectId) => {
    set({ loading: true })
    const { tasks } = await window.api.getAllTasks(projectId)
    set({ tasks, loading: false })
  },

  createTask: async (projectId, data) => {
    const { task } = await window.api.createTask({ projectId, ...data })
    set(state => ({ tasks: [...state.tasks, task] }))
    return task
  },

  runTask: async (taskId) => {
    await window.api.runTask(taskId)
    // Status updates come via events
  },
}))
```

### Event Subscriptions

```typescript
// src/renderer/src/App.tsx
import { useEffect } from 'react'
import { useTaskStore } from './stores/task-store'

function App() {
  const updateTask = useTaskStore(state => state.updateTask)

  useEffect(() => {
    // Subscribe to task status changes
    const unsubscribe = window.api.onTaskStatusChanged((task) => {
      updateTask(task.id, task)
    })

    return () => unsubscribe()
  }, [])

  // ...
}
```

## Error Handling

```typescript
// Main process handler with error handling
ipcMain.handle(IpcChannels.TASK_CREATE, async (_event, data) => {
  try {
    const task = await taskStore.createTask(data.projectId, data)
    return { success: true, task }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

// Renderer usage with error handling
const createTask = async (data: CreateTaskInput) => {
  const result = await window.api.createTask(data)
  if (!result.success) {
    throw new Error(result.error)
  }
  return result.task
}
```

## Relevant Files

| File | Purpose |
|------|---------|
| `src/shared/ipc-types.ts` | Channel names and type definitions |
| `src/preload/index.ts` | Secure IPC bridge |
| `src/main/ipc/index.ts` | Handler registration |
| `src/main/ipc/task-handlers.ts` | Task IPC handlers |
| `src/main/ipc/project-handlers.ts` | Project IPC handlers |
| `src/main/ipc/group-handlers.ts` | Group IPC handlers |
| `src/main/ipc/config-handlers.ts` | Config IPC handlers |
| `src/main/ipc/agent-handlers.ts` | Agent IPC handlers |
| `src/main/ipc/skill-handlers.ts` | Skill IPC handlers |
| `src/main/ipc/git-handlers.ts` | Git IPC handlers |
