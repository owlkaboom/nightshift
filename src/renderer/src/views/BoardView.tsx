import { TaskBoard, type ColumnId } from '@/components/board'
import { TaskDetailView } from '@/components/review'
import { AddTaskDialog, AgentLogViewer, EditTaskDialog, VoiceTaskDialog } from '@/components/tasks'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useKeyboardShortcuts, formatKbd, type KeyboardShortcut } from '@/hooks'
import {
  useAgentCacheStore,
  useConfigStore,
  useProjectStore,
  useSessionStore,
  useTaskStore,
  useUIStore,
  useUsageLimitStore
} from '@/stores'
import type { RunningTaskInfo } from '@shared/ipc-types'
import type { TaskManifest, TaskStatus } from '@shared/types'
import {
  Activity,
  AlertTriangle,
  Bot,
  Clock,
  Gauge,
  ListTodo,
  Mic,
  Minus,
  Play,
  Plus,
  Square,
  Terminal,
  ToggleLeft,
  ToggleRight,
  X
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'

export function BoardView() {
  const navigate = useNavigate()
  const location = useLocation()

  // Derive dialog open states from route
  const addDialogOpen = location.pathname === '/board/add-task'
  const voiceDialogOpen = location.pathname === '/board/add-voice-task'

  const [editingTask, setEditingTask] = useState<TaskManifest | null>(null)
  const [selectedTask, setSelectedTask] = useState<TaskManifest | null>(null)
  const [showLogs, setShowLogs] = useState<string | null>(null)
  const [logs, setLogs] = useState<string>('')
  const [processInfo, setProcessInfo] = useState<RunningTaskInfo | null>(null)
  const [isBacklogExpanded, setIsBacklogExpanded] = useState(false)
  const pendingAutoStartRef = useRef<Set<string>>(new Set())

  // Agent and model selection - use session store for sticky selection
  const {
    sessionAgentId,
    sessionModel,
    sessionProjectId,
    setSessionAgent,
    setSessionModel,
    setSessionProject
  } = useSessionStore()

  // Use cached agent data for fast loading
  const {
    agents,
    selectedAgentId: cachedSelectedAgent,
    fetchAll: fetchAgentCache,
    getModelsForAgent
  } = useAgentCacheStore()

  const {
    tasks,
    error,
    autoPlay,
    fetchTasks,
    createTask,
    updateTask,
    startTask,
    cancelTask,
    startNextTask,
    setAutoPlay,
    deleteTask,
    reorderTasks
  } = useTaskStore()

  const { projects, fetchProjects, selectedProjectId: persistedProjectId, selectProject } = useProjectStore()
  const { config, fetchConfig, updateConfig } = useConfigStore()
  const { addNotification } = useUIStore()
  const {
    state: usageLimitState,
    usagePercentage,
    fetchState: fetchUsageLimitState,
    fetchUsagePercentage,
    clearLimit: clearUsageLimit
  } = useUsageLimitStore()

  // Track if usage is above threshold (auto-play should pause)
  const usageThreshold = config?.autoPlayUsageThreshold ?? 92
  const currentUsage = usagePercentage.fiveHour?.utilization ?? 0
  const isUsageHigh = currentUsage >= usageThreshold
  const hasUsageData = usagePercentage.fiveHour !== null

  // Fetch data on mount - use cached agent data for instant loading
  useEffect(() => {
    fetchTasks()
    fetchProjects()
    fetchConfig()
    fetchUsageLimitState()
    fetchUsagePercentage()
    // Fetch agent cache (will use cached data if available)
    fetchAgentCache()
  }, []) // Only run once on mount

  // Initialize session agent/model from cache when cache loads
  useEffect(() => {
    // Skip if session already has an agent selected
    if (sessionAgentId) return

    // Use cached selected agent or first available
    const agentToUse = cachedSelectedAgent || agents[0]?.id
    if (!agentToUse) return

    // Get models for this agent from cache
    const agentModels = getModelsForAgent(agentToUse)
    if (agentModels.length === 0) return

    // Set agent in session
    setSessionAgent(agentToUse)

    // Set default model if session doesn't have one
    if (!sessionModel || !agentModels.find((m) => m.id === sessionModel)) {
      const defaultForAgent = agentModels.find((m) => m.isDefault)
      const modelToSet = defaultForAgent?.id || agentModels[0]?.id
      if (modelToSet) {
        setSessionModel(modelToSet)
      }
    }
  }, [agents, cachedSelectedAgent, sessionAgentId, sessionModel, getModelsForAgent, setSessionAgent, setSessionModel])

  // Initialize session project from persisted project when it loads
  useEffect(() => {
    // Skip if session already has a project selected
    if (sessionProjectId) return

    // Set session project from persisted project if available
    if (persistedProjectId) {
      setSessionProject(persistedProjectId)
    }
  }, [persistedProjectId, sessionProjectId, setSessionProject])

  // Persist session project selection to the project store when it changes
  // This ensures the selection survives app restarts
  useEffect(() => {
    // Only persist if session project is set and different from persisted
    if (sessionProjectId && sessionProjectId !== persistedProjectId) {
      selectProject(sessionProjectId)
    }
  }, [sessionProjectId, persistedProjectId, selectProject])

  // Get current models for selected agent from cache
  const models = sessionAgentId ? getModelsForAgent(sessionAgentId) : []

  // Update session model when agent changes
  useEffect(() => {
    if (!sessionAgentId || models.length === 0) return

    // Set default model for the agent if session doesn't have a valid one
    const defaultForAgent = models.find((m) => m.isDefault)
    if (!sessionModel || !models.find((m) => m.id === sessionModel)) {
      const modelToSet = defaultForAgent?.id || models[0]?.id
      if (modelToSet) {
        setSessionModel(modelToSet)
      }
    }
  }, [sessionAgentId, models, sessionModel, setSessionModel])

  // Auto-refresh running tasks every 5 seconds
  useEffect(() => {
    const hasRunning = tasks.some((t) => t.status === 'running')
    if (!hasRunning) return

    const interval = setInterval(() => {
      fetchTasks()
    }, 5000)

    return () => clearInterval(interval)
  }, [tasks, fetchTasks])

  // Periodically check usage percentage to keep it synced
  // Poll more frequently when auto-play is enabled, less frequently otherwise
  useEffect(() => {
    // Always poll usage, but adjust frequency based on auto-play
    const intervalMs = autoPlay ? 60000 : 5 * 60000 // 1 min when auto-play, 5 min otherwise

    const interval = setInterval(() => {
      fetchUsagePercentage()
    }, intervalMs)

    return () => clearInterval(interval)
  }, [autoPlay, fetchUsagePercentage])

  // Auto-play: start tasks up to max concurrent limit
  // Respects usage limit state - won't start tasks when paused due to limits
  // Also respects usage percentage threshold to prevent hitting hard limits
  useEffect(() => {
    if (!autoPlay) {
      // Clear pending tasks when auto-play is disabled
      pendingAutoStartRef.current.clear()
      return undefined
    }

    // Don't start new tasks if we're paused due to usage limits
    if (usageLimitState.isPaused) {
      return undefined
    }

    // Don't start new tasks if usage is at or above threshold
    // This prevents hitting hard limits by stopping auto-play proactively
    if (hasUsageData && isUsageHigh) {
      return undefined
    }

    const maxConcurrent = config?.maxConcurrentTasks ?? 1
    // Count both running and awaiting_agent tasks as "in progress"
    const inProgressTasks = tasks.filter(
      (t) => t.status === 'running' || t.status === 'awaiting_agent'
    )
    const queuedTasks = tasks.filter((t) => t.status === 'queued')

    // Turn off auto-play if there are no queued tasks and no in-progress tasks
    // This means all tasks have reached terminal states (needs_review, accepted, etc.)
    if (queuedTasks.length === 0 && inProgressTasks.length === 0) {
      setAutoPlay(false)
      return undefined
    }

    // Also count pending tasks as "running" for slot calculation
    // This is a client-side safety net, but the real protection is the awaiting_agent status
    const pendingCount = pendingAutoStartRef.current.size
    const effectiveRunning = inProgressTasks.length + pendingCount

    // Calculate how many more tasks we can start
    const slotsAvailable = maxConcurrent - effectiveRunning

    if (slotsAvailable <= 0 || queuedTasks.length === 0) {
      return undefined
    }

    // Find queued tasks that aren't already pending to start
    const startableTasks = queuedTasks
      .filter((t) => !pendingAutoStartRef.current.has(t.id))
      .sort((a, b) => a.queuePosition - b.queuePosition)
      .slice(0, slotsAvailable)

    if (startableTasks.length === 0) {
      return undefined
    }

    // Mark tasks as pending immediately to prevent duplicate starts
    for (const task of startableTasks) {
      pendingAutoStartRef.current.add(task.id)
    }

    // Small delay to prevent rapid firing
    const timeout = setTimeout(async () => {
      // Check usage percentage right before starting to get fresh data
      const freshUsage = await fetchUsagePercentage()
      const freshUtilization = freshUsage.fiveHour?.utilization ?? 0

      // If usage has exceeded threshold since we scheduled, abort
      if (freshUtilization >= usageThreshold) {
        for (const task of startableTasks) {
          pendingAutoStartRef.current.delete(task.id)
        }
        return
      }

      // Start tasks sequentially to avoid race conditions
      for (const task of startableTasks) {
        try {
          await startTask(task.projectId, task.id)
        } finally {
          // Remove from pending regardless of success/failure
          pendingAutoStartRef.current.delete(task.id)
        }
      }
    }, 1000)

    return () => {
      clearTimeout(timeout)
      // Remove these tasks from pending if timeout was cleared before execution
      for (const task of startableTasks) {
        pendingAutoStartRef.current.delete(task.id)
      }
    }
  }, [
    autoPlay,
    tasks,
    startTask,
    setAutoPlay,
    config?.maxConcurrentTasks,
    usageLimitState.isPaused,
    hasUsageData,
    isUsageHigh,
    usageThreshold,
    fetchUsagePercentage
  ])

  // Fetch logs and process info for a running task
  const fetchLogs = useCallback(
    async (taskId: string, projectId: string) => {
      try {
        // Get the task to find current iteration
        const task = tasks.find((t) => t.id === taskId && t.projectId === projectId)
        const iteration = task?.currentIteration || 1

        // Fetch logs for current iteration
        const logData = await window.api.readIterationLog(projectId, taskId, iteration)
        setLogs(logData || 'No logs available yet...')

        // Fetch process info
        const runningTasks = await window.api.getRunningTasks()
        const taskProcess = runningTasks.find((p) => p.taskId === taskId)
        setProcessInfo(taskProcess || null)
      } catch {
        setLogs('Failed to fetch logs')
        setProcessInfo(null)
      }
    },
    [tasks]
  )

  // Auto-refresh logs when viewing
  useEffect(() => {
    if (!showLogs) return

    const task = tasks.find((t) => t.id === showLogs)
    if (!task) return

    const projectId = task.projectId

    // Initial fetch
    fetchLogs(showLogs, projectId)

    // Always poll while the modal is open
    // Poll every 1 second for more responsive updates
    const interval = setInterval(() => {
      fetchLogs(showLogs, projectId)
    }, 1000)

    return () => clearInterval(interval)
  }, [showLogs, tasks, fetchLogs])

  // Build project name lookup
  const projectNames = useMemo(() => {
    const map: Record<string, string> = {}
    projects.forEach((p) => {
      map[p.id] = p.name
    })
    return map
  }, [projects])

  const handleAddTask = async (data: {
    prompt: string
    projectId: string
    groupId?: string | null
    enabledSkills?: string[]
    agentId?: string | null
    model?: string | null
    thinkingMode?: boolean | null
  }) => {
    await createTask(data)
  }

  const handleTaskMove = async (
    task: TaskManifest,
    _newStatus: TaskStatus,
    sourceColumn: ColumnId,
    targetColumn: ColumnId
  ) => {
    const taskPreview = task.prompt.split('\n')[0].slice(0, 50)

    // Queued → In Progress: Start the task
    if (sourceColumn === 'queued' && targetColumn === 'in-progress') {
      const maxConcurrent = config?.maxConcurrentTasks ?? 1
      if (runningCount >= maxConcurrent) {
        addNotification({
          type: 'warning',
          title: `Failed to start "${taskPreview}..."`,
          message: `Cannot start task: ${runningCount}/${maxConcurrent} concurrent tasks running`
        })
        return
      }
      await startTask(task.projectId, task.id)
      return
    }

    // In Progress → Queued: Cancel and re-queue the task
    if (sourceColumn === 'in-progress' && targetColumn === 'queued') {
      // Cancel the running task first
      if (task.status === 'running' || task.status === 'awaiting_agent') {
        await cancelTask(task.id)
      }
      // Update status to queued (this is a re-prompt essentially)
      await updateTask(task.projectId, task.id, { status: 'queued' as TaskStatus })
      await fetchTasks()
      addNotification({
        type: 'info',
        title: 'Task re-queued',
        message: `"${taskPreview}..." has been moved back to queue`
      })
      return
    }

    // Review → Queued: Re-queue a completed/failed task (new iteration)
    if (sourceColumn === 'review' && targetColumn === 'queued') {
      // For tasks that need review or failed, trigger a re-prompt
      if (task.status === 'needs_review' || task.status === 'failed') {
        await window.api.repromptTask(task.projectId, task.id, task.prompt)
        await fetchTasks()
        addNotification({
          type: 'info',
          title: 'Task re-queued',
          message: `"${taskPreview}..." has been queued for another iteration`
        })
      }
      return
    }

    // Review → In Progress: Start directly from review (re-prompt and start)
    if (sourceColumn === 'review' && targetColumn === 'in-progress') {
      if (task.status === 'needs_review' || task.status === 'failed') {
        const maxConcurrent = config?.maxConcurrentTasks ?? 1
        if (runningCount >= maxConcurrent) {
          addNotification({
            type: 'warning',
            title: `Failed to start "${taskPreview}..."`,
            message: `Cannot start task: ${runningCount}/${maxConcurrent} concurrent tasks running`
          })
          return
        }
        // Re-prompt and then immediately start
        await window.api.repromptTask(task.projectId, task.id, task.prompt)
        await fetchTasks()
        // Find the updated task and start it
        await startTask(task.projectId, task.id)
        addNotification({
          type: 'info',
          title: 'Task restarted',
          message: `"${taskPreview}..." has been started for another iteration`
        })
      }
      return
    }

    // Queued → Review: Not a valid transition (show warning)
    if (sourceColumn === 'queued' && targetColumn === 'review') {
      addNotification({
        type: 'warning',
        title: 'Invalid action',
        message: 'Tasks must run before they can be reviewed'
      })
      return
    }

    // In Progress → Review: Not valid (tasks auto-move when done)
    if (sourceColumn === 'in-progress' && targetColumn === 'review') {
      addNotification({
        type: 'warning',
        title: 'Invalid action',
        message: 'Running tasks will move to review automatically when complete'
      })
      return
    }

    // Backlog → Queued: Move task from backlog to queue
    if (sourceColumn === 'backlog' && targetColumn === 'queued') {
      await updateTask(task.projectId, task.id, { status: 'queued' as TaskStatus })
      await fetchTasks()
      addNotification({
        type: 'info',
        title: 'Task moved to queue',
        message: `"${taskPreview}..." has been moved from backlog to queue`
      })
      return
    }

    // Queued → Backlog: Shelve a queued task
    if (sourceColumn === 'queued' && targetColumn === 'backlog') {
      await updateTask(task.projectId, task.id, { status: 'backlog' as TaskStatus })
      await fetchTasks()
      return
    }

    // Backlog → In Progress: Not valid (must go through queued first)
    if (sourceColumn === 'backlog' && targetColumn === 'in-progress') {
      addNotification({
        type: 'warning',
        title: 'Invalid action',
        message: 'Tasks must be moved to queue before starting'
      })
      return
    }

    // Backlog → Review: Not valid
    if (sourceColumn === 'backlog' && targetColumn === 'review') {
      addNotification({
        type: 'warning',
        title: 'Invalid action',
        message: 'Tasks must run before they can be reviewed'
      })
      return
    }

    // Review → Backlog: Move reviewed/failed task to backlog
    if (sourceColumn === 'review' && targetColumn === 'backlog') {
      await updateTask(task.projectId, task.id, { status: 'backlog' as TaskStatus })
      await fetchTasks()
      return
    }

    // In Progress → Backlog: Cancel and move to backlog
    if (sourceColumn === 'in-progress' && targetColumn === 'backlog') {
      // Cancel the running task first
      if (task.status === 'running' || task.status === 'awaiting_agent') {
        await cancelTask(task.id)
      }
      await updateTask(task.projectId, task.id, { status: 'backlog' as TaskStatus })
      await fetchTasks()
      return
    }
  }

  const handleStatusChange = async (task: TaskManifest, status: TaskStatus) => {
    if (status === 'running' && task.status === 'queued') {
      // Check concurrent limit before starting
      const maxConcurrent = config?.maxConcurrentTasks ?? 1
      if (runningCount >= maxConcurrent) {
        const taskPreview = task.prompt.slice(0, 50)
        addNotification({
          type: 'warning',
          title: `Failed to start "${taskPreview}..."`,
          message: `Cannot start task: ${runningCount}/${maxConcurrent} concurrent tasks running`
        })
        return
      }
      // Start the task via the agent
      await startTask(task.projectId, task.id)
    } else if (status === 'queued' && task.status === 'backlog') {
      // Move task from backlog to queue
      await updateTask(task.projectId, task.id, { status: 'queued' as TaskStatus })
      await fetchTasks()
    } else if (status === 'cancelled') {
      // Cancel the task - this kills the process and updates status
      await cancelTask(task.id)
      // Refresh to get updated status
      await fetchTasks()
    } else if (status === 'paused' && task.status === 'running') {
      // Pause is equivalent to cancel for now (Claude Code doesn't support pause)
      await cancelTask(task.id)
      await fetchTasks()
    }
  }

  const handleDelete = async (task: TaskManifest) => {
    await deleteTask(task.projectId, task.id)
  }

  const handleEdit = (task: TaskManifest) => {
    // Only allow editing queued and backlog tasks
    if (task.status === 'queued' || task.status === 'backlog') {
      setEditingTask(task)
    }
  }

  const handleSaveEdit = async (
    taskId: string,
    projectId: string,
    updates: { prompt: string; enabledSkills?: string[], agentId?: string, model?: string, thinkingMode?: boolean | null }
  ) => {
    await updateTask(projectId, taskId, updates)
  }

  const handleTaskClick = (task: TaskManifest) => {
    // For queued and backlog tasks, open edit dialog
    if (task.status === 'queued' || task.status === 'backlog') {
      setEditingTask(task)
      return
    }

    // Open detail view for all other viewable task states (running, needs review, completed, failed, etc.)
    if (
      ['running', 'awaiting_agent', 'needs_review', 'completed', 'failed', 'cancelled', 'rejected'].includes(
        task.status
      )
    ) {
      setSelectedTask(task)
    }
  }


  const handleStartNext = async () => {
    await startNextTask()
  }

  const handleUpdateMaxConcurrent = async (delta: number) => {
    const currentMax = config?.maxConcurrentTasks ?? 1
    const newMax = Math.max(1, Math.min(10, currentMax + delta))
    if (newMax !== currentMax) {
      await updateConfig({ maxConcurrentTasks: newMax })
    }
  }

  const hasProjects = projects.length > 0
  // Count both running and awaiting_agent tasks as "in progress"
  const runningCount = tasks.filter(
    (t) => t.status === 'running' || t.status === 'awaiting_agent'
  ).length
  const queuedCount = tasks.filter((t) => t.status === 'queued').length
  const backlogCount = tasks.filter((t) => t.status === 'backlog').length

  // Helper function to format time remaining until usage resets
  const formatTimeRemaining = (resetTime: string): string => {
    const now = Date.now()
    const reset = new Date(resetTime).getTime()
    const diffMs = reset - now

    if (diffMs <= 0) return 'Resets soon'

    const minutes = Math.floor(diffMs / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60

    if (hours > 0) {
      return `Resets in ${hours}h ${remainingMinutes}m`
    }
    return `Resets in ${minutes}m`
  }

  // Keyboard shortcut handlers
  const handleOpenAddDialog = useCallback(() => {
    if (hasProjects) {
      navigate({ to: '/board/add-task' })
    }
  }, [hasProjects, navigate])

  const handleOpenVoiceDialog = useCallback(() => {
    if (hasProjects) {
      navigate({ to: '/board/add-voice-task' })
    }
  }, [hasProjects, navigate])

  const handleToggleAutoPlay = useCallback(() => {
    setAutoPlay(!autoPlay)
  }, [autoPlay, setAutoPlay])

  const handleKeyboardStartNext = useCallback(() => {
    const maxConcurrent = config?.maxConcurrentTasks ?? 1
    if (queuedCount > 0 && runningCount < maxConcurrent) {
      startNextTask()
    }
  }, [queuedCount, runningCount, startNextTask, config?.maxConcurrentTasks])

  const handleCloseModals = useCallback(() => {
    if (showLogs) {
      setShowLogs(null)
      setProcessInfo(null)
    } else if (editingTask) {
      setEditingTask(null)
    } else if (addDialogOpen || voiceDialogOpen) {
      navigate({ to: '/board' })
    }
  }, [showLogs, editingTask, addDialogOpen, voiceDialogOpen, navigate])

  // Cancel running task shortcut
  const handleCancelRunning = useCallback(() => {
    const runningTask = tasks.find((t) => t.status === 'running')
    if (runningTask) {
      cancelTask(runningTask.id)
      fetchTasks()
    }
  }, [tasks, cancelTask, fetchTasks])

  // Board view keyboard shortcuts
  const boardShortcuts: KeyboardShortcut[] = useMemo(
    () => [
      { key: 'n', meta: true, handler: handleOpenAddDialog, description: 'New task' },
      { key: 'v', meta: true, shift: true, handler: handleOpenVoiceDialog, description: 'Voice task creation' },
      {
        key: 'Enter',
        meta: true,
        handler: handleKeyboardStartNext,
        description: 'Start next task'
      },
      { key: ' ', shift: true, handler: handleToggleAutoPlay, description: 'Toggle auto-play' },
      { key: 'Escape', handler: handleCloseModals, description: 'Close dialog/modal' },
      {
        key: 'x',
        handler: handleCancelRunning,
        description: 'Cancel running task',
        ignoreInputs: true
      }
    ],
    [
      handleOpenAddDialog,
      handleOpenVoiceDialog,
      handleKeyboardStartNext,
      handleToggleAutoPlay,
      handleCloseModals,
      handleCancelRunning
    ]
  )

  // Only enable shortcuts when not viewing task detail and not in add dialog (unless closing)
  useKeyboardShortcuts(boardShortcuts, { enabled: !selectedTask })

  // If viewing task details, show that instead
  // Use the task from the store (which gets real-time updates) rather than stale selectedTask state
  if (selectedTask) {
    const currentTask =
      tasks.find((t) => t.id === selectedTask.id && t.projectId === selectedTask.projectId) ||
      selectedTask

    return (
      <TaskDetailView
        key={`${currentTask.id}-${currentTask.status}`}
        task={currentTask}
        projectName={projectNames[currentTask.projectId] || 'Unknown Project'}
        onBack={() => {
          setSelectedTask(null)
          fetchTasks() // Refresh after review
        }}
        onTaskUpdated={() => {
          setSelectedTask(null)
          fetchTasks()
        }}
      />
    )
  }

  return (
    <div className="h-full flex flex-col" data-tour="board">
      {/* Header */}
      <div className="flex flex-col gap-3 p-4 sm:p-6 pb-3 sm:pb-4">
        {/* Title */}
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold">Task Board</h1>
        </div>

        {/* Controls row */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Top section: Agent/Model and Usage */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Agent/Model selector */}
            <div className="flex items-center gap-1 px-2 py-1.5 border border-input rounded-md bg-background text-xs sm:text-sm">
              <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
              <Select
                value={sessionAgentId}
                onValueChange={(value) => {
                  setSessionAgent(value)
                  // Clear model when agent changes (model list will be different)
                  setSessionModel(undefined)
                }}
              >
                <SelectTrigger className="w-[80px] sm:w-[100px] h-7 border-0 bg-transparent text-xs sm:text-sm">
                  <SelectValue placeholder="Agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">/</span>
              <Select value={sessionModel} onValueChange={setSessionModel}>
                <SelectTrigger className="w-[120px] sm:w-[160px] h-7 border-0 bg-transparent text-xs sm:text-sm">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Max Concurrent Control */}
            <div className="flex items-center gap-1 px-2 py-1.5 border border-input rounded-md bg-background text-xs sm:text-sm">
              <ListTodo className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
              <button
                type="button"
                onClick={() => handleUpdateMaxConcurrent(-1)}
                disabled={(config?.maxConcurrentTasks ?? 1) <= 1}
                className="h-6 w-6 flex items-center justify-center hover:bg-accent rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Decrease max concurrent tasks"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="min-w-[20px] text-center font-medium tabular-nums">
                {config?.maxConcurrentTasks ?? 1}
              </span>
              <button
                type="button"
                onClick={() => handleUpdateMaxConcurrent(1)}
                disabled={(config?.maxConcurrentTasks ?? 1) >= 10}
                className="h-6 w-6 flex items-center justify-center hover:bg-accent rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Increase max concurrent tasks"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            {/* Backlog Count Indicator */}
            {backlogCount > 0 && (
              <button
                type="button"
                onClick={() => setIsBacklogExpanded(!isBacklogExpanded)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-gradient-to-br from-gray-500/20 to-gray-600/10 text-gray-600 dark:text-gray-400 border border-gray-500/30 hover:bg-gray-500/30 hover:border-gray-500/40 transition-all cursor-pointer"
                title={isBacklogExpanded ? 'Hide backlog column' : 'Show backlog column'}
              >
                <span className="text-muted-foreground">Backlog:</span>
                <span className="font-semibold tabular-nums">{backlogCount}</span>
              </button>
            )}

            {/* Usage indicator - always visible */}
            {hasUsageData ? (
              <button
                type="button"
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all hover:scale-105 active:scale-95 cursor-default ${
                  isUsageHigh
                    ? 'bg-gradient-to-br from-orange-500/20 to-orange-600/10 text-orange-600 dark:text-orange-400 border border-orange-500/30 shadow-sm shadow-orange-500/20 hover:shadow-md hover:shadow-orange-500/30'
                    : currentUsage >= 80
                      ? 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30 shadow-sm shadow-yellow-500/20 hover:shadow-md hover:shadow-yellow-500/30'
                      : 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/20 hover:shadow-md hover:shadow-emerald-500/30'
                }`}
                title={`5-hour session usage: ${currentUsage.toFixed(1)}%${usagePercentage.fiveHour?.resetsAt ? ` · ${formatTimeRemaining(usagePercentage.fiveHour.resetsAt)}` : ''}`}
              >
                <Gauge className="h-4 w-4 transition-transform group-hover:rotate-12" />
                <span className="font-semibold tabular-nums">{currentUsage.toFixed(0)}%</span>
              </button>
            ) : (
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-gradient-to-br from-gray-500/10 to-gray-600/5 text-gray-500 dark:text-gray-400 border border-gray-500/20 cursor-default"
                title="Loading usage data..."
              >
                <Gauge className="h-4 w-4 animate-pulse" />
                <span className="font-semibold tabular-nums animate-pulse">--</span>
              </div>
            )}
          </div>

          {/* Bottom section: Action buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
            {/* Start Next */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartNext}
              disabled={queuedCount === 0 || runningCount >= (config?.maxConcurrentTasks ?? 1)}
              className="gap-1.5"
              title={`Start next task (${formatKbd('⌘↵')})`}
            >
              <Play className="h-3.5 w-3.5" />
              <span className="text-xs sm:text-sm">Start</span>
              <kbd className="hidden lg:inline ml-2 text-xs opacity-60">{formatKbd('⌘↵')}</kbd>
            </Button>

            {/* Auto-play toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoPlay(!autoPlay)}
              className="gap-1.5"
              title={`Toggle auto-play (${formatKbd('⇧␣')})`}
            >
              {autoPlay ? (
                <ToggleRight className="h-3.5 w-3.5" />
              ) : (
                <ToggleLeft className="h-3.5 w-3.5" />
              )}
              <span className="text-xs sm:text-sm">
                {autoPlay ? 'Auto' : 'Manual'}
              </span>
              <kbd className="hidden lg:inline ml-2 text-xs opacity-60">{formatKbd('⇧␣')}</kbd>
            </Button>

            {/* Voice */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: '/board/add-voice-task' })}
              disabled={!hasProjects}
              className="gap-1.5"
              title={`Voice task creation (${formatKbd('⌘⇧V')})`}
              data-feature="voice-task-input"
            >
              <Mic className="h-3.5 w-3.5" />
              <span className="text-xs sm:text-sm">Voice</span>
              <kbd className="hidden lg:inline ml-2 text-xs opacity-60">{formatKbd('⌘⇧V')}</kbd>
            </Button>

            {/* Add Task */}
            <Button
              size="sm"
              onClick={() => navigate({ to: '/board/add-task' })}
              disabled={!hasProjects}
              className="gap-1.5"
              title={`Add task (${formatKbd('⌘N')})`}
              data-tour="add-task"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="text-xs sm:text-sm">Add Task</span>
              <kbd className="hidden lg:inline ml-2 text-xs opacity-60">{formatKbd('⌘N')}</kbd>
            </Button>
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mx-4 sm:mx-6 mb-3 sm:mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Usage limit banner - shown when hard limit is hit */}
      {usageLimitState.isPaused && (
        <div className="mx-4 sm:mx-6 mb-3 sm:mb-4 p-3 sm:p-4 bg-amber-500/10 border border-amber-500/30 rounded-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-sm sm:text-base font-medium text-amber-600 dark:text-amber-400">
                  Tasks paused due to usage limit
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {usageLimitState.resumeAt ? (
                    <>
                      <Clock className="h-3 w-3 inline mr-1" />
                      Auto-resumes at {new Date(usageLimitState.resumeAt).toLocaleTimeString()}
                    </>
                  ) : (
                    'Auto-play is paused until usage limits reset. You can manually resume when ready.'
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => clearUsageLimit()}
              className="border-amber-500/50 hover:bg-amber-500/10 w-full sm:w-auto"
            >
              Resume Now
            </Button>
          </div>
        </div>
      )}

      {/* Usage warning banner - shown when approaching limit threshold */}
      {!usageLimitState.isPaused && hasUsageData && isUsageHigh && autoPlay && (
        <div className="mx-4 sm:mx-6 mb-3 sm:mb-4 p-3 sm:p-4 bg-orange-500/10 border border-orange-500/30 rounded-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Gauge className="h-5 w-5 text-orange-500 flex-shrink-0" />
              <div>
                <p className="text-sm sm:text-base font-medium text-orange-600 dark:text-orange-400">
                  Auto-play paused at {currentUsage.toFixed(0)}% usage
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {usagePercentage.fiveHour?.resetsAt ? (
                    <>
                      <Clock className="h-3 w-3 inline mr-1" />
                      Session resets at{' '}
                      {new Date(usagePercentage.fiveHour.resetsAt).toLocaleTimeString()}
                    </>
                  ) : (
                    `Usage is at ${usageThreshold}% threshold. Auto-play is paused to preserve capacity.`
                  )}{' '}
                  You can still start tasks manually.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-orange-500/50 text-orange-500">
                {currentUsage.toFixed(0)}% / {usageThreshold}%
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* Usage info banner - shown when usage data is available and above warning level but below stop threshold */}
      {!usageLimitState.isPaused && hasUsageData && !isUsageHigh && currentUsage >= 80 && (
        <div className="mx-4 sm:mx-6 mb-3 sm:mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
          <div className="flex items-center gap-3">
            <Gauge className="h-4 w-4 text-yellow-500 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-yellow-600 dark:text-yellow-400">
              Session usage at {currentUsage.toFixed(0)}%.
              {usagePercentage.fiveHour?.resetsAt && (
                <> Resets at {new Date(usagePercentage.fiveHour.resetsAt).toLocaleTimeString()}.</>
              )}
              {autoPlay && ` Auto-play will pause at ${usageThreshold}%.`}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 px-4 sm:px-6 pb-4 sm:pb-6 overflow-hidden min-h-0" data-tour="board-content">
        {!hasProjects ? (
          // No projects state
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-6 mb-4">
              <ListTodo className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No projects yet</h2>
            <p className="text-muted-foreground max-w-sm">
              Add a project first to create tasks. Go to the Projects view to add a project.
            </p>
          </div>
        ) : (
          // Always show task board when projects exist
          <TaskBoard
            tasks={tasks}
            projectNames={projectNames}
            onTaskMove={handleTaskMove}
            onStatusChange={handleStatusChange}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onTaskClick={handleTaskClick}
            onReorder={reorderTasks}
            isBacklogExpanded={isBacklogExpanded}
            onToggleBacklog={() => setIsBacklogExpanded(!isBacklogExpanded)}
          />
        )}
      </div>

      {/* Logs Panel */}
      {showLogs &&
        (() => {
          const currentTask = tasks.find((t) => t.id === showLogs)
          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-background border border-border rounded-lg w-[900px] h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold line-clamp-1">{currentTask?.prompt.split('\n')[0].slice(0, 80) || 'Task'}</h3>
                    {processInfo ? (
                      <Badge
                        variant={processInfo.state === 'running' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        <Activity className="h-3 w-3 mr-1 animate-pulse" />
                        {processInfo.state}
                      </Badge>
                    ) : currentTask?.status === 'running' ? (
                      <Badge variant="outline" className="text-xs text-yellow-500">
                        No process found
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        {currentTask?.status}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {processInfo?.state === 'running' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          await cancelTask(showLogs)
                          fetchTasks()
                        }}
                      >
                        <Square className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setShowLogs(null)
                        setProcessInfo(null)
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Process Info Bar */}
                <div className="px-4 py-2 bg-muted/50 border-b border-border text-xs flex items-center gap-4 flex-wrap">
                  {processInfo && (
                    <>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Terminal className="h-3 w-3" />
                        <span>PID: {processInfo.pid}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Activity className="h-3 w-3" />
                        <span>Agent: {processInfo.agentId}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span>Output: {processInfo.outputLogLength} lines</span>
                      </div>
                      <div className="text-muted-foreground">
                        Started: {new Date(processInfo.startedAt).toLocaleTimeString()}
                      </div>
                    </>
                  )}
                  {!processInfo && currentTask?.status === 'running' && (
                    <div className="text-yellow-500">
                      ⚠ Process not tracked - task may have started before app restart
                    </div>
                  )}
                  {projectNames[currentTask?.projectId || ''] && (
                    <div className="text-muted-foreground ml-auto">
                      Project: {projectNames[currentTask?.projectId || '']}
                    </div>
                  )}
                </div>

                {/* Logs Content */}
                <div className="flex-1 min-h-0 overflow-hidden bg-zinc-950">
                  <AgentLogViewer logs={logs} isRunning={processInfo?.state === 'running'} />
                </div>
              </div>
            </div>
          )
        })()}

      {/* Add Task Dialog */}
      <AddTaskDialog
        open={addDialogOpen}
        onOpenChange={(open) => !open && navigate({ to: '/board' })}
        onAdd={handleAddTask}
        projects={projects}
        defaultProjectId={sessionProjectId}
        defaultAgentId={sessionAgentId}
        defaultModel={sessionModel}
      />

      {/* Edit Task Dialog */}
      <EditTaskDialog
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        task={editingTask}
        projectName={editingTask ? projectNames[editingTask.projectId] : undefined}
        onSave={handleSaveEdit}
      />

      {/* Voice Task Dialog */}
      <VoiceTaskDialog
        open={voiceDialogOpen}
        onOpenChange={(open) => !open && navigate({ to: '/board' })}
        onAdd={handleAddTask}
        projects={projects}
        defaultProjectId={sessionProjectId}
        defaultAgentId={sessionAgentId}
        defaultModel={sessionModel}
      />
    </div>
  )
}
