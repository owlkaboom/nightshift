/**
 * IPC handlers for agent-related operations
 */

import type { AgentInfo, RunningTaskInfo, RunningChatInfo, RunningProcessInfo, UsageLimitState, UsagePercentageState, AgentAuthState } from '@shared/ipc-types'
import type { AgentModelInfo, AgentOutputEvent } from '@shared/types'
import { getAgentDefaultModel, getAgentModels as getDefaultModels } from '@shared/types'
import { ipcMain } from 'electron'
import { agentRegistry, processManager } from '@main/agents'
import { logger } from '@main/utils/logger'
import { getCurrentBranch } from '@main/git'
import {
  getProjectPath,
  buildMemoryContext,
  getProject,
  buildSkillPrompt,
  appendIterationLog,
  completeIteration,
  loadTask,
  updateTask,
  loadConfig
} from '@main/storage'
import { broadcastTaskStatusChanged, broadcastUsageLimitStateChanged, broadcastAgentAuthStateChanged } from '@main/utils/broadcast'
import { handleTaskStatusChange } from '@main/notifications/notification-service'

/**
 * Global usage limit state
 * Tracks when the queue is paused due to API usage limits
 */
let usageLimitState: UsageLimitState = {
  isPaused: false,
  pausedAt: null,
  resumeAt: null,
  triggeredByTaskId: null
}

/**
 * Get the current usage limit state
 */
export function getUsageLimitState(): UsageLimitState {
  return { ...usageLimitState }
}

/**
 * Set usage limit state and broadcast to all windows
 */
function setUsageLimitState(state: Partial<UsageLimitState>): void {
  usageLimitState = { ...usageLimitState, ...state }
  broadcastUsageLimitStateChanged(usageLimitState)
}

/**
 * Clear the usage limit state (e.g., when user manually resumes)
 */
export function clearUsageLimitState(): void {
  usageLimitState = {
    isPaused: false,
    pausedAt: null,
    resumeAt: null,
    triggeredByTaskId: null
  }
  broadcastUsageLimitStateChanged(usageLimitState)
}

// Group context removed - groups have been migrated to tags
// Tags are simpler organizational labels and don't need hierarchical context
// If needed, tag context can be added in the future using task.tagIds

/**
 * Convert an agent adapter to AgentInfo for IPC
 */
async function adapterToInfo(
  adapter: ReturnType<typeof agentRegistry.get>
): Promise<AgentInfo | null> {
  if (!adapter) return null

  return {
    id: adapter.id,
    name: adapter.name,
    available: await adapter.isAvailable(),
    executablePath: await adapter.getExecutablePath(),
    capabilities: adapter.getCapabilities()
  }
}

/**
 * Register agent IPC handlers
 */
export function registerAgentHandlers(): void {
  // List all registered agents
  ipcMain.handle('agent:list', async (): Promise<AgentInfo[]> => {
    const adapters = agentRegistry.getAll()
    const results: AgentInfo[] = []

    for (const adapter of adapters) {
      const info = await adapterToInfo(adapter)
      if (info) results.push(info)
    }

    return results
  })

  // Get available agents (installed)
  ipcMain.handle('agent:getAvailable', async (): Promise<AgentInfo[]> => {
    const adapters = await agentRegistry.getAvailable()
    const results: AgentInfo[] = []

    for (const adapter of adapters) {
      const info = await adapterToInfo(adapter)
      if (info) results.push(info)
    }

    return results
  })

  // Get default agent
  ipcMain.handle('agent:getDefault', async (): Promise<AgentInfo> => {
    const adapter = agentRegistry.getDefault()
    const info = await adapterToInfo(adapter)
    if (!info) throw new Error('Default agent not available')
    return info
  })

  // Check if specific agent is available
  ipcMain.handle('agent:isAvailable', async (_, agentId: string): Promise<boolean> => {
    const adapter = agentRegistry.get(agentId)
    if (!adapter) return false
    return adapter.isAvailable()
  })

  // Get available models for an agent
  ipcMain.handle('agent:getModels', async (_, agentId: string): Promise<AgentModelInfo[]> => {
    return getDefaultModels(agentId)
  })

  // Get default model for an agent
  ipcMain.handle('agent:getDefaultModel', async (_, agentId: string): Promise<string | null> => {
    return getAgentDefaultModel(agentId)
  })

  // Start a task
  ipcMain.handle(
    'agent:startTask',
    async (_, projectId: string, taskId: string): Promise<boolean> => {
      logger.debug(`[agent:startTask] Starting task ${taskId} for project ${projectId}`)
      logger.debug(`[agent:startTask] Current processes before start:`, processManager.getAll().map(p => ({ taskId: p.taskId, state: p.state })))

      // Check if task already has a running process FIRST (fastest check)
      // This handles race conditions where multiple start requests arrive simultaneously
      const existingProcess = processManager.get(taskId)
      if (existingProcess && existingProcess.state === 'running') {
        logger.debug(`[agent:startTask] Task ${taskId} already has a running process, returning success`)
        return true
      }

      // Get the task
      const task = await loadTask(projectId, taskId)
      if (!task) {
        throw new Error(`Task ${taskId} not found`)
      }

      // Only allow starting from queued status
      // This prevents race conditions where the same task could be started multiple times
      if (task.status !== 'queued') {
        logger.debug(`[agent:startTask] Task ${taskId} is not queued (status: ${task.status}), skipping`)
        // Don't throw an error - if the task is already running/awaiting, that's fine
        // Just return success since the desired outcome (task running) is achieved
        if (task.status === 'running' || task.status === 'awaiting_agent') {
          return true
        }
        throw new Error(`Task ${taskId} is not in queued status (current: ${task.status})`)
      }

      // IMMEDIATELY set status to awaiting_agent to prevent race conditions
      // This must happen BEFORE any async operations to prevent duplicate starts
      const now = new Date().toISOString()
      const awaitingTask = await updateTask(projectId, taskId, {
        status: 'awaiting_agent',
        startedAt: now
      })
      if (awaitingTask) {
        broadcastTaskStatusChanged(awaitingTask)
      }

      try {
        // Get the project
        const project = await getProject(projectId)
        if (!project) {
          throw new Error(`Project ${projectId} not found`)
        }

        // Get project path
        const projectPath = await getProjectPath(projectId)
        if (!projectPath) {
          throw new Error(`Project ${projectId} has no local path configured`)
        }

        // Clean up any stale processes before checking capacity
        processManager.cleanupStale()

        // Check if we can start a new process
        if (!processManager.canStartNew()) {
          throw new Error('Maximum concurrent tasks reached. Please wait for a task to complete.')
        }

        // Check if we're already paused due to usage limits
        if (usageLimitState.isPaused) {
          // Check if the resume time has passed
          if (usageLimitState.resumeAt) {
            const resumeTime = new Date(usageLimitState.resumeAt)
            if (resumeTime > new Date()) {
              throw new Error(
                `Usage limit active. Queue will resume at ${resumeTime.toLocaleTimeString()}`
              )
            }
            // Resume time has passed, clear the limit
            clearUsageLimitState()
          } else {
            throw new Error('Usage limit active. Please wait or clear the limit manually.')
          }
        }

        // Determine which agent to use: task-specific or global default
        const taskAgentId = task.agentId || undefined
        const adapter = taskAgentId ? agentRegistry.get(taskAgentId) : agentRegistry.getDefault()
        if (!adapter) {
          throw new Error(`Agent '${taskAgentId || 'default'}' not found or not available`)
        }
        logger.debug(`[AgentHandlers] Using agent: ${adapter.id} for task ${taskId}`)

        // Pre-flight usage limit check with the agent
        logger.debug('[AgentHandlers] Performing pre-flight usage limit check...')
        const limitCheck = await adapter.checkUsageLimits()
        if (!limitCheck.canProceed) {
          // Set the usage limit state so auto-play stops
          setUsageLimitState({
            isPaused: true,
            pausedAt: new Date().toISOString(),
            resumeAt: limitCheck.resetAt ? limitCheck.resetAt.toISOString() : null,
            triggeredByTaskId: taskId
          })
          throw new Error(
            limitCheck.message || 'Usage limit reached. Please wait for limits to reset.'
          )
        }
        logger.debug('[AgentHandlers] Pre-flight check passed, proceeding with task')

        // Use project directory directly (no worktrees)
        const workingDirectory = projectPath

        // Get current branch for context
        const currentBranch = await getCurrentBranch(projectPath)

        // Resolve effective agent and model for display in UI
        // If task doesn't have explicit agent/model, use the adapter's defaults
        const effectiveAgentId = task.agentId || adapter.id
        const effectiveModel = task.model || getAgentDefaultModel(adapter.id)

        // Update task status to running and store the resolved agent/model
        const runningTask = await updateTask(projectId, taskId, {
          status: 'running',
          runningSessionStartedAt: new Date().toISOString(),
          agentId: effectiveAgentId,
          model: effectiveModel
        })
        if (runningTask) {
          broadcastTaskStatusChanged(runningTask)
        }

        // Build skill prompt if skills are enabled
        const skillPrompt = await buildSkillPrompt(task.enabledSkills || [])

        // Build project memory context (cached knowledge to reduce token usage)
        const memoryContext = await buildMemoryContext(projectId)

        // Build the full prompt with system instructions, memory, and skills
        let fullPrompt = `You are working in project: ${project.name}
- Working directory: ${workingDirectory}
- Current branch: ${currentBranch || 'unknown'}
`

        // Add project memory context if available (reduces need for re-discovery)
        if (memoryContext) {
          fullPrompt += `\n${memoryContext}\n`
        }

        // Add skill instructions if any skills are selected
        if (skillPrompt) {
          fullPrompt += `\n${skillPrompt}\n`
        }

        fullPrompt += `\nTASK:\n${task.prompt}`

        // Get current iteration for logging
        const currentIteration = task.currentIteration || 1

        // Set up event handlers for this task
        // IMPORTANT: These must be attached BEFORE starting the process to avoid race conditions
        // where the process completes before handlers are registered
        const handleOutput = (outputTaskId: string, event: AgentOutputEvent) => {
          if (outputTaskId === taskId) {
            // Write the raw message directly - it should be JSON from Claude
            // This preserves the JSON format for proper parsing in the log viewer
            appendIterationLog(projectId, taskId, currentIteration, event.message + '\n').catch(
              (err) => {
                console.error('Failed to write task log:', err)
              }
            )
          }
        }

        const handleComplete = async (completedTaskId: string, exitCode: number) => {
          if (completedTaskId === taskId) {
            try {
              await appendIterationLog(
                projectId,
                taskId,
                currentIteration,
                `\n=== Iteration ${currentIteration} completed with exit code ${exitCode} ===\n`
              )

              // Analyze agent output for incomplete work detection (only for successful completions)
              let incompletionAnalysis
              let sessionId: string | null = null
              const outputLog = processManager.getOutputLog(taskId)

              if (exitCode === 0) {
                const adapter = agentRegistry.get(effectiveAgentId)
                if (adapter && outputLog.length > 0) {
                  incompletionAnalysis = adapter.detectIncompleteWork(outputLog)
                  logger.debug(
                    `[AgentHandlers] Incomplete work analysis for task ${taskId}:`,
                    incompletionAnalysis
                  )
                }
              }

              // Extract session ID from output log (find the last sessionId in the log)
              if (outputLog.length > 0) {
                for (let i = outputLog.length - 1; i >= 0; i--) {
                  if (outputLog[i].sessionId) {
                    sessionId = outputLog[i].sessionId ?? null
                    logger.debug(`[AgentHandlers] Extracted session ID for task ${taskId}:`, sessionId)
                    break
                  }
                }
              }

              // Complete iteration - this records history and sets status to needs_review or failed
              const updatedTask = await completeIteration(
                projectId,
                taskId,
                exitCode,
                undefined,
                incompletionAnalysis,
                sessionId
              )
              if (updatedTask) {
                broadcastTaskStatusChanged(updatedTask)
                // Show notification for task completion
                await handleTaskStatusChange(updatedTask)
              }
            } catch (err) {
              console.error('Error in handleComplete:', err)
            } finally {
              cleanup()
            }
          }
        }

        const handleFailed = async (failedTaskId: string, error: string) => {
          if (failedTaskId === taskId) {
            try {
              await appendIterationLog(
                projectId,
                taskId,
                currentIteration,
                `\n=== Iteration ${currentIteration} failed: ${error} ===\n`
              )
              // Complete iteration with error
              const updatedTask = await completeIteration(projectId, taskId, 1, error)
              if (updatedTask) {
                broadcastTaskStatusChanged(updatedTask)
              }
            } catch (err) {
              console.error('Error in handleFailed:', err)
            } finally {
              cleanup()
            }
          }
        }

        const handleRateLimited = async (limitedTaskId: string) => {
          if (limitedTaskId === taskId) {
            try {
              await appendIterationLog(
                projectId,
                taskId,
                currentIteration,
                `\n=== Iteration ${currentIteration} paused due to rate limit ===\n`
              )
              // Load task to calculate runtime so far
              const currentTask = await loadTask(projectId, taskId)
              let runtimeMs = currentTask?.runtimeMs || 0
              if (currentTask?.runningSessionStartedAt) {
                const sessionStart = new Date(currentTask.runningSessionStartedAt).getTime()
                runtimeMs += Date.now() - sessionStart
              }
              const updatedTask = await updateTask(projectId, taskId, {
                status: 'paused',
                runtimeMs,
                runningSessionStartedAt: null
              })
              if (updatedTask) {
                broadcastTaskStatusChanged(updatedTask)
              }
            } catch (err) {
              console.error('Error in handleRateLimited:', err)
            }
          }
        }

        const handleUsageLimited = async (limitedTaskId: string, resetAt?: Date) => {
          if (limitedTaskId === taskId) {
            try {
              const resetInfo = resetAt ? ` (resets at ${resetAt.toISOString()})` : ''
              await appendIterationLog(
                projectId,
                taskId,
                currentIteration,
                `\n=== Iteration ${currentIteration} paused due to usage limit${resetInfo} ===\n`
              )
              // Load task to calculate runtime so far
              const currentTask = await loadTask(projectId, taskId)
              let runtimeMs = currentTask?.runtimeMs || 0
              if (currentTask?.runningSessionStartedAt) {
                const sessionStart = new Date(currentTask.runningSessionStartedAt).getTime()
                runtimeMs += Date.now() - sessionStart
              }
              const updatedTask = await updateTask(projectId, taskId, {
                status: 'paused',
                runtimeMs,
                runningSessionStartedAt: null
              })
              if (updatedTask) {
                broadcastTaskStatusChanged(updatedTask)
              }

              // Set global usage limit state to pause auto-play
              setUsageLimitState({
                isPaused: true,
                pausedAt: new Date().toISOString(),
                resumeAt: resetAt ? resetAt.toISOString() : null,
                triggeredByTaskId: taskId
              })
            } catch (err) {
              console.error('Error in handleUsageLimited:', err)
            }
          }
        }

        const handleCancelled = async (cancelledTaskId: string) => {
          if (cancelledTaskId === taskId) {
            try {
              await appendIterationLog(
                projectId,
                taskId,
                currentIteration,
                `\n=== Iteration ${currentIteration} cancelled by user ===\n`
              )
              // Load task to calculate final runtime
              const currentTask = await loadTask(projectId, taskId)
              const completedAt = new Date().toISOString()
              let runtimeMs = currentTask?.runtimeMs || 0
              if (currentTask?.runningSessionStartedAt) {
                const sessionStart = new Date(currentTask.runningSessionStartedAt).getTime()
                runtimeMs += Date.now() - sessionStart
              }
              const updatedTask = await updateTask(projectId, taskId, {
                status: 'cancelled',
                completedAt,
                runtimeMs,
                runningSessionStartedAt: null
              })
              if (updatedTask) {
                broadcastTaskStatusChanged(updatedTask)
              }
            } catch (err) {
              console.error('Error in handleCancelled:', err)
            } finally {
              cleanup()
            }
          }
        }

        const handleTimedOut = async (timedOutTaskId: string, durationMinutes: number) => {
          if (timedOutTaskId === taskId) {
            try {
              await appendIterationLog(
                projectId,
                taskId,
                currentIteration,
                `\n=== Iteration ${currentIteration} timed out after ${durationMinutes} minutes ===\n`
              )
              // Load task to calculate final runtime
              const currentTask = await loadTask(projectId, taskId)
              const completedAt = new Date().toISOString()
              let runtimeMs = currentTask?.runtimeMs || 0
              if (currentTask?.runningSessionStartedAt) {
                const sessionStart = new Date(currentTask.runningSessionStartedAt).getTime()
                runtimeMs += Date.now() - sessionStart
              }
              const updatedTask = await updateTask(projectId, taskId, {
                status: 'failed',
                completedAt,
                runtimeMs,
                runningSessionStartedAt: null,
                errorMessage: `Task timed out after ${durationMinutes} minutes`
              })
              if (updatedTask) {
                broadcastTaskStatusChanged(updatedTask)
              }
            } catch (err) {
              console.error('Error in handleTimedOut:', err)
            } finally {
              cleanup()
            }
          }
        }

        const handleAuthFailed = async (failedTaskId: string, agentId: string) => {
          if (failedTaskId === taskId) {
            try {
              await appendIterationLog(
                projectId,
                taskId,
                currentIteration,
                `\n=== Iteration ${currentIteration} failed due to authentication error ===\n`
              )
              // Load task to calculate final runtime
              const currentTask = await loadTask(projectId, taskId)
              const completedAt = new Date().toISOString()
              let runtimeMs = currentTask?.runtimeMs || 0
              if (currentTask?.runningSessionStartedAt) {
                const sessionStart = new Date(currentTask.runningSessionStartedAt).getTime()
                runtimeMs += Date.now() - sessionStart
              }
              const updatedTask = await updateTask(projectId, taskId, {
                status: 'failed',
                completedAt,
                runtimeMs,
                runningSessionStartedAt: null,
                errorMessage: `Authentication failed for ${agentId}. Please re-authenticate.`
              })
              if (updatedTask) {
                broadcastTaskStatusChanged(updatedTask)
              }

              // Broadcast auth state change with project path for context-aware re-auth
              const projectLocalPath = await getProjectPath(projectId)
              broadcastAgentAuthStateChanged({
                agentId,
                isAuthenticated: false,
                lastCheckedAt: new Date().toISOString(),
                error: 'Token expired or invalid',
                requiresReauth: true,
                projectPath: projectLocalPath || undefined
              })
            } catch (err) {
              console.error('Error in handleAuthFailed:', err)
            } finally {
              cleanup()
            }
          }
        }

        const cleanup = () => {
          processManager.off('process:output', handleOutput)
          processManager.off('process:completed', handleComplete)
          processManager.off('process:failed', handleFailed)
          processManager.off('process:rate-limited', handleRateLimited)
          processManager.off('process:usage-limited', handleUsageLimited)
          processManager.off('process:auth-failed', handleAuthFailed)
          processManager.off('process:cancelled', handleCancelled)
          processManager.off('process:timed-out', handleTimedOut)
          // Clean up the process from tracking
          processManager.remove(taskId)
        }

        // Attach event handlers BEFORE starting the process to prevent race conditions
        processManager.on('process:output', handleOutput)
        processManager.on('process:completed', handleComplete)
        processManager.on('process:failed', handleFailed)
        processManager.on('process:rate-limited', handleRateLimited)
        processManager.on('process:usage-limited', handleUsageLimited)
        processManager.on('process:auth-failed', handleAuthFailed)
        processManager.on('process:cancelled', handleCancelled)
        processManager.on('process:timed-out', handleTimedOut)

        try {
          // Write initial log entry to iteration-specific log
          await appendIterationLog(
            projectId,
            taskId,
            currentIteration,
            `=== Iteration ${currentIteration} started at ${new Date().toISOString()} ===\nWorking directory: ${workingDirectory}\nPrompt: ${task.prompt}\n\n`
          )

          // Start the agent process in the project directory
          // Event handlers are already attached above, so we won't miss any events

          // Determine thinking mode: task-specific overrides global default
          const config = await loadConfig()
          const agentConfig = config.agents[adapter.id]
          const globalThinkingMode = agentConfig?.settings?.thinkingMode as boolean | undefined
          const effectiveThinkingMode = task.thinkingMode !== null
            ? task.thinkingMode
            : (globalThinkingMode ?? false)

          // Build agent options with model and thinking mode
          // Use effectiveModel which was resolved earlier (task.model or agent default)
          const agentOptions: Record<string, unknown> = {}
          if (effectiveModel) {
            agentOptions.model = effectiveModel
          }
          if (effectiveThinkingMode) {
            agentOptions.thinkingMode = true
          }
          // Add resumeSessionId if task has a session ID (for reply/continue)
          if (task.sessionId) {
            agentOptions.resumeSessionId = task.sessionId
            logger.debug(`[AgentHandlers] Task ${taskId} will resume session ${task.sessionId}`)
          }

          await processManager.start(
            taskId,
            projectId,
            {
              prompt: fullPrompt,
              workingDirectory,
              contextFiles: task.contextFiles,
              agentOptions: Object.keys(agentOptions).length > 0 ? agentOptions : undefined
            },
            adapter.id // Use the task's agent
          )

          return true
        } catch (error) {
          // Clean up event handlers since process failed to start
          cleanup()
          // Revert task status on error
          const failedTask = await updateTask(projectId, taskId, {
            status: 'failed',
            completedAt: new Date().toISOString(),
            errorMessage: error instanceof Error ? error.message : 'Failed to start task'
          })
          if (failedTask) {
            broadcastTaskStatusChanged(failedTask)
          }
          throw error
        }
      } catch (error) {
        // Outer catch: handles errors that occur after awaiting_agent but before/during process start
        // This ensures the task doesn't get stuck in awaiting_agent if something fails
        console.error(`[agent:startTask] Error starting task ${taskId}:`, error)
        const failedTask = await updateTask(projectId, taskId, {
          status: 'failed',
          completedAt: new Date().toISOString(),
          errorMessage: error instanceof Error ? error.message : 'Failed to start task'
        })
        if (failedTask) {
          broadcastTaskStatusChanged(failedTask)
        }
        throw error
      }
    }
  )

  // Cancel a running task
  ipcMain.handle('agent:cancelTask', async (_, taskId: string): Promise<boolean> => {
    return processManager.cancel(taskId)
  })

  // Get running tasks
  ipcMain.handle('agent:getRunningTasks', async (): Promise<RunningProcessInfo[]> => {
    const processes = processManager.getAll()
    const chatSessions = processManager.getAllChatSessions()
    const now = Date.now()

    // Map task processes
    const taskInfos: RunningTaskInfo[] = processes.map((proc) => ({
      processType: 'task' as const,
      taskId: proc.taskId,
      projectId: proc.projectId,
      agentId: proc.agentId,
      pid: proc.process.pid,
      state: proc.state,
      startedAt: proc.startedAt.toISOString(),
      outputLogLength: proc.outputLog.length,
      elapsedMs: now - proc.startedAt.getTime(),
      error: proc.error
    }))

    // Map chat sessions
    const chatInfos: RunningChatInfo[] = chatSessions.map((session) => ({
      processType: 'chat' as const,
      sessionId: session.sessionId,
      projectId: session.projectId,
      agentId: session.agentId,
      pid: session.process.pid,
      state: session.state,
      startedAt: session.startedAt.toISOString(),
      sessionType: session.sessionType,
      messageCount: session.messageCount,
      streamingContentLength: session.streamingContentLength,
      elapsedMs: now - session.startedAt.getTime(),
      error: session.error
    }))

    const result: RunningProcessInfo[] = [...taskInfos, ...chatInfos]
    logger.debug('[agent:getRunningTasks] Returning:', JSON.stringify(result.map(r =>
      r.processType === 'task'
        ? { type: 'task', taskId: r.taskId, state: r.state }
        : { type: 'chat', sessionId: r.sessionId, state: r.state }
    )))
    return result
  })

  // Get task output log
  ipcMain.handle('agent:getTaskOutput', async (_, taskId: string): Promise<AgentOutputEvent[]> => {
    return processManager.getOutputLog(taskId)
  })

  // Clear all tracked processes (for debugging/reset)
  ipcMain.handle('agent:clearAllProcesses', async (): Promise<void> => {
    processManager.clearAll()
  })

  // Get current usage limit state
  ipcMain.handle('agent:getUsageLimitState', async (): Promise<UsageLimitState> => {
    return getUsageLimitState()
  })

  // Clear usage limit state (allow auto-play to resume)
  ipcMain.handle('agent:clearUsageLimit', async (): Promise<void> => {
    clearUsageLimitState()
  })

  // Check usage limits before starting tasks (pre-flight validation)
  ipcMain.handle(
    'agent:checkUsageLimits',
    async (): Promise<{ canProceed: boolean; resetAt?: string; message?: string }> => {
      // First check our cached state
      if (usageLimitState.isPaused) {
        // Check if the resume time has passed
        if (usageLimitState.resumeAt) {
          const resumeTime = new Date(usageLimitState.resumeAt)
          if (resumeTime > new Date()) {
            return {
              canProceed: false,
              resetAt: usageLimitState.resumeAt,
              message: `Usage limit active. Will reset at ${resumeTime.toLocaleTimeString()}`
            }
          }
          // Resume time has passed, clear the limit
          clearUsageLimitState()
        } else {
          return {
            canProceed: false,
            message: 'Usage limit active. Please wait or clear the limit manually.'
          }
        }
      }

      // Do a live check with the agent
      const adapter = agentRegistry.getDefault()
      if (!adapter) {
        return { canProceed: false, message: 'No agent available' }
      }

      const limitCheck = await adapter.checkUsageLimits()
      if (!limitCheck.canProceed) {
        // Update our cached state
        setUsageLimitState({
          isPaused: true,
          pausedAt: new Date().toISOString(),
          resumeAt: limitCheck.resetAt ? limitCheck.resetAt.toISOString() : null,
          triggeredByTaskId: null
        })
        return {
          canProceed: false,
          resetAt: limitCheck.resetAt?.toISOString(),
          message: limitCheck.message
        }
      }

      return { canProceed: true }
    }
  )

  // Get current usage percentage from the API
  ipcMain.handle('agent:getUsagePercentage', async (): Promise<UsagePercentageState> => {
    const adapter = agentRegistry.getDefault()
    if (!adapter) {
      return {
        fiveHour: null,
        sevenDay: null,
        lastCheckedAt: null,
        error: 'No agent available'
      }
    }

    try {
      const result = await adapter.getUsagePercentage()
      return {
        fiveHour: result.fiveHour,
        sevenDay: result.sevenDay,
        lastCheckedAt: new Date().toISOString(),
        error: result.error
      }
    } catch (error) {
      return {
        fiveHour: null,
        sevenDay: null,
        lastCheckedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Check authentication status for a specific agent
  ipcMain.handle('agent:checkAuth', async (_, agentId: string): Promise<AgentAuthState> => {
    const adapter = agentRegistry.get(agentId)
    if (!adapter) {
      return {
        agentId,
        isAuthenticated: false,
        lastCheckedAt: new Date().toISOString(),
        error: 'Agent not found',
        requiresReauth: false
      }
    }

    try {
      const result = await adapter.validateAuth()
      return {
        agentId,
        isAuthenticated: result.isValid,
        lastCheckedAt: new Date().toISOString(),
        error: result.error || null,
        requiresReauth: result.requiresReauth
      }
    } catch (error) {
      return {
        agentId,
        isAuthenticated: false,
        lastCheckedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        requiresReauth: false
      }
    }
  })

  // Get authentication status for all agents
  ipcMain.handle('agent:getAuthStates', async (): Promise<AgentAuthState[]> => {
    const adapters = agentRegistry.getAll()
    const results: AgentAuthState[] = []

    for (const adapter of adapters) {
      try {
        const result = await adapter.validateAuth()
        results.push({
          agentId: adapter.id,
          isAuthenticated: result.isValid,
          lastCheckedAt: new Date().toISOString(),
          error: result.error || null,
          requiresReauth: result.requiresReauth
        })
      } catch (error) {
        results.push({
          agentId: adapter.id,
          isAuthenticated: false,
          lastCheckedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
          requiresReauth: false
        })
      }
    }

    return results
  })

  // Trigger re-authentication flow for an agent
  ipcMain.handle(
    'agent:triggerReauth',
    async (
      _,
      agentId: string,
      projectPath?: string
    ): Promise<{ success: boolean; error?: string }> => {
      const adapter = agentRegistry.get(agentId)
      if (!adapter) {
        return { success: false, error: 'Agent not found' }
      }

      try {
        const result = await adapter.triggerReauth(projectPath)

        // If successful, broadcast the updated auth state
        if (result.success) {
          const authState = await adapter.validateAuth()
          broadcastAgentAuthStateChanged({
            agentId,
            isAuthenticated: authState.isValid,
            lastCheckedAt: new Date().toISOString(),
            error: authState.error || null,
            requiresReauth: authState.requiresReauth
          })
        }

        return result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return { success: false, error: errorMessage }
      }
    }
  )
}
