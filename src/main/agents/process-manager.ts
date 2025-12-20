/**
 * Agent Process Manager
 *
 * Manages running agent processes, tracks their state, and handles lifecycle events.
 */

import { EventEmitter } from 'events'
import type { AgentProcess, AgentOutputEvent, AgentInvokeOptions } from '@shared/types'
import { agentRegistry } from './registry'
import { logger } from '@main/utils/logger'

/**
 * State of a managed agent process
 */
export interface ManagedProcess {
  /** Task ID this process is running for */
  taskId: string

  /** Project ID */
  projectId: string

  /** Agent adapter ID */
  agentId: string

  /** The underlying agent process */
  process: AgentProcess

  /** Current state */
  state: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'timed_out'

  /** When the process started */
  startedAt: Date

  /** Output log buffer */
  outputLog: AgentOutputEvent[]

  /** Error message if failed */
  error?: string

  /** Timeout timer reference for auto-termination */
  timeoutTimer?: ReturnType<typeof setTimeout>
}

/**
 * Events emitted by the process manager
 */
export interface ProcessManagerEvents {
  'process:started': (taskId: string, process: ManagedProcess) => void
  'process:output': (taskId: string, event: AgentOutputEvent) => void
  'process:completed': (taskId: string, exitCode: number) => void
  'process:failed': (taskId: string, error: string) => void
  'process:rate-limited': (taskId: string) => void
  'process:usage-limited': (taskId: string, resetAt?: Date) => void
  'process:auth-failed': (taskId: string, agentId: string) => void
  'process:cancelled': (taskId: string) => void
  'process:timed-out': (taskId: string, durationMinutes: number) => void
}

/**
 * Process Manager implementation
 */
class ProcessManagerImpl extends EventEmitter {
  private processes: Map<string, ManagedProcess> = new Map()
  private maxConcurrent: number = 1
  private maxTaskDurationMinutes: number = 15

  constructor() {
    super()
  }

  /**
   * Set maximum concurrent processes
   */
  setMaxConcurrent(max: number): void {
    this.maxConcurrent = Math.max(1, max)
  }

  /**
   * Get maximum concurrent processes
   */
  getMaxConcurrent(): number {
    return this.maxConcurrent
  }

  /**
   * Set maximum task duration in minutes (0 = no limit)
   */
  setMaxTaskDuration(minutes: number): void {
    this.maxTaskDurationMinutes = Math.max(0, minutes)
    logger.debug(`[ProcessManager] Max task duration set to ${this.maxTaskDurationMinutes} minutes`)
  }

  /**
   * Get maximum task duration in minutes
   */
  getMaxTaskDuration(): number {
    return this.maxTaskDurationMinutes
  }

  /**
   * Get count of running processes
   */
  getRunningCount(): number {
    let count = 0
    for (const proc of this.processes.values()) {
      if (proc.state === 'running') count++
    }
    return count
  }

  /**
   * Check if we can start a new process
   */
  canStartNew(): boolean {
    return this.getRunningCount() < this.maxConcurrent
  }

  /**
   * Start a new agent process for a task
   */
  async start(
    taskId: string,
    projectId: string,
    options: AgentInvokeOptions,
    agentId?: string
  ): Promise<ManagedProcess> {
    logger.debug('[ProcessManager] Starting process for task:', taskId)
    logger.debug('[ProcessManager] Options:', JSON.stringify(options, null, 2))

    // Check if task already has a running process
    if (this.processes.has(taskId)) {
      const existing = this.processes.get(taskId)!
      if (existing.state === 'running') {
        // Task is already running - this is fine, just return the existing process
        // This can happen due to race conditions in auto-play or UI interactions
        logger.debug(`[ProcessManager] Task ${taskId} already has a running process, returning existing`)
        return existing
      }
      logger.debug('[ProcessManager] Removing existing process entry for task')
      this.processes.delete(taskId)
    }

    // Get the agent adapter
    const adapter = agentId ? agentRegistry.get(agentId) : agentRegistry.getDefault()
    if (!adapter) {
      throw new Error(`Agent adapter '${agentId || 'default'}' not found`)
    }
    logger.debug('[ProcessManager] Using adapter:', adapter.id, adapter.name)

    // Check if agent is available
    const available = await adapter.isAvailable()
    logger.debug('[ProcessManager] Agent available:', available)
    if (!available) {
      throw new Error(`Agent '${adapter.name}' is not available. Is it installed?`)
    }

    // Pre-load API key for adapters that need it (e.g., Gemini)
    if ('loadApiKey' in adapter && typeof adapter.loadApiKey === 'function') {
      logger.debug('[ProcessManager] Loading API key for adapter...')
      await adapter.loadApiKey()
    }

    // Invoke the agent
    logger.debug('[ProcessManager] Invoking agent...')
    const agentProcess = adapter.invoke(options)
    logger.debug('[ProcessManager] Agent invoked, PID:', agentProcess.pid)

    // Create managed process
    const managed: ManagedProcess = {
      taskId,
      projectId,
      agentId: adapter.id,
      process: agentProcess,
      state: 'running',
      startedAt: new Date(),
      outputLog: []
    }

    this.processes.set(taskId, managed)
    logger.debug(`[ProcessManager] Added process for task ${taskId}, map now has ${this.processes.size} entries: ${Array.from(this.processes.keys()).join(', ')}`)
    this.emit('process:started', taskId, managed)

    // Set up timeout monitoring if max duration is configured
    if (this.maxTaskDurationMinutes > 0) {
      const timeoutMs = this.maxTaskDurationMinutes * 60 * 1000
      logger.debug(`[ProcessManager] Setting timeout for task ${taskId}: ${this.maxTaskDurationMinutes} minutes`)
      managed.timeoutTimer = setTimeout(() => {
        this.handleTimeout(taskId)
      }, timeoutMs)
    }

    // Start processing output streams and wait for process completion
    // We need to wait for BOTH the process to exit AND the output streams to finish
    // to avoid a race condition where we emit completion before all output is processed
    const outputPromise = this.processOutput(taskId, managed, adapter)
    const waitPromise = agentProcess.wait()

    // Wait for both streams to finish and process to exit
    Promise.all([outputPromise, waitPromise])
      .then(([, { exitCode }]) => {
        const proc = this.processes.get(taskId)
        logger.debug(`[ProcessManager] Process exit handler for task ${taskId}: exitCode=${exitCode}, proc=${!!proc}, proc.state=${proc?.state}`)

        // Clear timeout timer on any completion
        if (proc) {
          this.clearTimeout(proc)
        }

        if (proc && proc.state === 'running') {
          if (exitCode === 0) {
            logger.debug(`[ProcessManager] Setting task ${taskId} state to 'completed'`)
            proc.state = 'completed'
            this.emit('process:completed', taskId, exitCode)
          } else {
            logger.debug(`[ProcessManager] Setting task ${taskId} state to 'failed' (exitCode=${exitCode})`)
            proc.state = 'failed'
            proc.error = `Process exited with code ${exitCode}`
            this.emit('process:failed', taskId, proc.error)
          }
        } else {
          logger.debug(`[ProcessManager] Skipping state update for task ${taskId}: proc=${!!proc}, state=${proc?.state}`)
        }
      })
      .catch((error) => {
        // CRITICAL: Handle errors from output parsing or process wait
        // Without this handler, Promise rejection would be unhandled and
        // completion/failed events would never fire, leaving tasks stuck
        const proc = this.processes.get(taskId)
        console.error(`[ProcessManager] Error in process completion handler for task ${taskId}:`, error)

        // Clear timeout timer on error
        if (proc) {
          this.clearTimeout(proc)
        }

        if (proc && proc.state === 'running') {
          proc.state = 'failed'
          proc.error = error instanceof Error ? error.message : 'Process failed unexpectedly'
          this.emit('process:failed', taskId, proc.error)
        }
      })

    return managed
  }

  /**
   * Process output streams from an agent
   * Processes stdout and stderr in parallel to avoid blocking
   */
  private async processOutput(
    taskId: string,
    managed: ManagedProcess,
    adapter: ReturnType<typeof agentRegistry.get>
  ): Promise<void> {
    if (!adapter) return

    // Process stdout
    const processStdout = async (): Promise<void> => {
      try {
        for await (const event of adapter.parseOutput(managed.process.stdout)) {
          managed.outputLog.push(event)
          this.emit('process:output', taskId, event)

          // Check for auth errors only on error events (not on all output)
          // This prevents false positives when the agent reads code containing auth-related strings
          if (event.type === 'error' && adapter.detectAuthError(event.message)) {
            managed.state = 'failed'
            managed.error = 'Authentication failed'
            this.emit('process:auth-failed', taskId, adapter.id)
            return
          }
          // Check for usage limit (higher priority than rate limit)
          if (event.type === 'usage-limit') {
            managed.state = 'paused'
            this.emit('process:usage-limited', taskId, event.resetAt)
          }
          // Check for rate limit
          else if (event.type === 'rate-limit') {
            managed.state = 'paused'
            this.emit('process:rate-limited', taskId)
          }
        }
      } catch (error) {
        // Log stream errors for debugging - these can indicate parsing issues
        if (error instanceof Error && error.message !== 'aborted') {
          console.error(`[ProcessManager] Error processing stdout for task ${taskId}:`, error)
        }
      }
    }

    // Process stderr separately for errors
    const processStderr = async (): Promise<void> => {
      try {
        const stderrAdapter = {
          async *parseOutput(stream: NodeJS.ReadableStream): AsyncIterable<AgentOutputEvent> {
            const decoder = new TextDecoder()
            let buffer = ''

            for await (const chunk of stream) {
              buffer += decoder.decode(chunk as Buffer, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() ?? ''

              for (const line of lines) {
                if (line.trim()) {
                  // Check usage limit first (higher priority)
                  const usageLimitResult = adapter!.detectUsageLimit(line)
                  if (usageLimitResult.isUsageLimit) {
                    yield {
                      type: 'usage-limit',
                      message: line,
                      timestamp: new Date(),
                      resetAt: usageLimitResult.resetAt
                    }
                  } else if (adapter!.detectRateLimit(line)) {
                    yield {
                      type: 'rate-limit',
                      message: line,
                      timestamp: new Date()
                    }
                  } else {
                    yield {
                      type: 'error',
                      message: line,
                      timestamp: new Date()
                    }
                  }
                }
              }
            }
          }
        }

        for await (const event of stderrAdapter.parseOutput(managed.process.stderr)) {
          managed.outputLog.push(event)
          this.emit('process:output', taskId, event)

          // Check for auth errors only on error events (not on all output)
          // This prevents false positives when the agent outputs code containing auth-related strings
          if (event.type === 'error' && adapter!.detectAuthError(event.message)) {
            managed.state = 'failed'
            managed.error = 'Authentication failed'
            this.emit('process:auth-failed', taskId, adapter!.id)
            return
          }
          // Check for usage limit (higher priority than rate limit)
          if (event.type === 'usage-limit') {
            managed.state = 'paused'
            this.emit('process:usage-limited', taskId, event.resetAt)
          } else if (event.type === 'rate-limit') {
            managed.state = 'paused'
            this.emit('process:rate-limited', taskId)
          }
        }
      } catch (error) {
        // Log stream errors for debugging - these can indicate parsing issues
        if (error instanceof Error && error.message !== 'aborted') {
          console.error(`[ProcessManager] Error processing stderr for task ${taskId}:`, error)
        }
      }
    }

    // Process both streams in parallel and wait for both to complete
    await Promise.all([processStdout(), processStderr()])
  }

  /**
   * Cancel a running process
   */
  cancel(taskId: string): boolean {
    const managed = this.processes.get(taskId)
    if (!managed || managed.state !== 'running') {
      return false
    }

    // Clear the timeout timer
    this.clearTimeout(managed)

    managed.process.kill()
    managed.state = 'cancelled'
    this.emit('process:cancelled', taskId)
    return true
  }

  /**
   * Handle process timeout - terminates a process that exceeded max duration
   */
  private handleTimeout(taskId: string): void {
    const managed = this.processes.get(taskId)
    if (!managed || managed.state !== 'running') {
      return
    }

    const durationMinutes = this.maxTaskDurationMinutes
    logger.debug(`[ProcessManager] Task ${taskId} timed out after ${durationMinutes} minutes`)

    // Kill the process
    try {
      managed.process.kill()
    } catch (err) {
      console.error(`[ProcessManager] Error killing timed-out process ${taskId}:`, err)
    }

    managed.state = 'timed_out'
    managed.error = `Task exceeded maximum duration of ${durationMinutes} minutes`
    this.emit('process:timed-out', taskId, durationMinutes)
  }

  /**
   * Clear timeout timer for a managed process
   */
  private clearTimeout(managed: ManagedProcess): void {
    if (managed.timeoutTimer) {
      clearTimeout(managed.timeoutTimer)
      managed.timeoutTimer = undefined
    }
  }

  /**
   * Get a managed process by task ID
   */
  get(taskId: string): ManagedProcess | undefined {
    return this.processes.get(taskId)
  }

  /**
   * Get all managed processes
   */
  getAll(): ManagedProcess[] {
    const all = Array.from(this.processes.values())
    logger.debug(`[ProcessManager] getAll called, returning ${all.length} processes:`, all.map(p => ({ taskId: p.taskId, state: p.state })))
    return all
  }

  /**
   * Get running processes
   */
  getRunning(): ManagedProcess[] {
    return this.getAll().filter((p) => p.state === 'running')
  }

  /**
   * Remove a process from tracking (cleanup)
   */
  remove(taskId: string): boolean {
    const managed = this.processes.get(taskId)
    if (managed) {
      this.clearTimeout(managed)
    }
    return this.processes.delete(taskId)
  }

  /**
   * Get output log for a task
   */
  getOutputLog(taskId: string): AgentOutputEvent[] {
    return this.processes.get(taskId)?.outputLog ?? []
  }

  /**
   * Clean up stale processes that are marked as running but have no active process
   *
   * Note: This only cleans up processes where the process object is completely
   * invalid (null/undefined). We cannot synchronously check if a process has
   * exited, so we rely on the normal completion handlers for that.
   *
   * IMPORTANT: When marking a process as failed, we MUST emit the 'process:failed'
   * event so that event handlers can properly update the database and UI state.
   */
  cleanupStale(): number {
    let cleaned = 0
    logger.debug(`[ProcessManager] cleanupStale called, ${this.processes.size} processes in map`)
    for (const [taskId, proc] of this.processes.entries()) {
      logger.debug(`[ProcessManager] Checking task ${taskId}: state=${proc.state}, hasProcess=${!!proc.process}`)
      if (proc.state === 'running') {
        // Only clean up if the process reference is completely missing
        // A valid running process will always have a process object and pid
        // Note: pid can be -1 after exit (see claude-code.ts), but that's still truthy
        if (!proc.process) {
          logger.debug(`[ProcessManager] cleanupStale: Marking task ${taskId} as failed (no process reference)`)
          proc.state = 'failed'
          proc.error = 'Process reference lost'
          // Emit the failed event so handlers can update database/UI
          this.emit('process:failed', taskId, proc.error)
          cleaned++
        }
      }
    }
    logger.debug(`[ProcessManager] cleanupStale completed, cleaned ${cleaned} processes`)
    return cleaned
  }

  /**
   * Clear all tracked processes (useful for reset/debugging)
   */
  clearAll(): void {
    // Kill any running processes and clear timers
    for (const proc of this.processes.values()) {
      this.clearTimeout(proc)
      if (proc.state === 'running') {
        try {
          proc.process.kill()
        } catch {
          // Ignore errors during cleanup
        }
      }
    }
    this.processes.clear()
  }
}

/**
 * Singleton process manager instance
 */
export const processManager = new ProcessManagerImpl()
