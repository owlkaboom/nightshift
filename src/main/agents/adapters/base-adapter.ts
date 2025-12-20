/**
 * Base Agent Adapter
 *
 * Provides shared functionality for all agent adapters including:
 * - Process wrapping
 * - Output parsing
 * - Rate limit and usage limit detection
 * - Executable path finding
 *
 * This reduces code duplication across adapters while allowing
 * customization through method overrides.
 */

import type { ChildProcess } from 'child_process'
import { exec, spawn } from 'child_process'
import { existsSync } from 'fs'
import { promisify } from 'util'
import { logger } from '@main/utils/logger'

import type {
  AgentAdapter,
  AgentCapabilities,
  AgentInvokeOptions,
  AgentModelInfo,
  AgentOutputEvent,
  AgentProcess,
  ModelAlias
} from '@shared/types'

const execAsync = promisify(exec)

/**
 * Wrap a ChildProcess as an AgentProcess
 *
 * Provides a consistent interface for all adapters to work with spawned processes.
 *
 * @param child - The child process to wrap
 * @param adapterName - Name of the adapter for logging
 * @returns An AgentProcess wrapper
 */
export function wrapChildProcess(child: ChildProcess, adapterName: string): AgentProcess {
  return {
    get pid() {
      return child.pid ?? -1
    },
    get stdout() {
      return child.stdout!
    },
    get stderr() {
      return child.stderr!
    },
    kill() {
      child.kill('SIGTERM')
    },
    wait(): Promise<{ exitCode: number }> {
      return new Promise((resolve) => {
        let resolved = false
        child.on('exit', (code) => {
          if (!resolved) {
            resolved = true
            logger.debug(`[${adapterName}] wait() resolved via 'exit' event, code=${code}, pid=${child.pid}`)
            resolve({ exitCode: code ?? 1 })
          }
        })
        child.on('error', (err) => {
          if (!resolved) {
            resolved = true
            logger.debug(
              `[${adapterName}] wait() resolved via 'error' event, error=${err.message}, pid=${child.pid}`
            )
            resolve({ exitCode: 1 })
          }
        })
      })
    }
  }
}

/**
 * Result of usage limit detection
 */
export interface UsageLimitResult {
  isUsageLimit: boolean
  resetAt?: Date
}

/**
 * Result of auth validation
 */
export interface AuthValidationResult {
  isValid: boolean
  requiresReauth: boolean
  error?: string
}

/**
 * Result of usage limit check
 */
export interface UsageLimitCheckResult {
  canProceed: boolean
  resetAt?: Date
  message?: string
}

/**
 * Result of usage percentage check
 */
export interface UsagePercentageResult {
  fiveHour: { utilization: number; resetsAt: string } | null
  sevenDay: { utilization: number; resetsAt: string } | null
  error: string | null
}

/**
 * Base adapter class with shared functionality
 *
 * Subclasses should implement abstract methods and override
 * protected methods as needed for adapter-specific behavior.
 */
export abstract class BaseAgentAdapter implements AgentAdapter {
  abstract readonly id: string
  abstract readonly name: string

  /** Cached executable path */
  protected cachedPath: string | null = null

  /** Cached models list */
  protected cachedModels: AgentModelInfo[] | null = null

  /** Time when models were cached */
  protected modelsCacheTime: number = 0

  /** Cache duration for models (24 hours by default) */
  protected readonly modelsCacheDuration = 24 * 60 * 60 * 1000

  /**
   * Possible paths where the CLI might be installed.
   * Subclasses should override this with adapter-specific paths.
   */
  protected abstract readonly possiblePaths: string[]

  /**
   * CLI command name for PATH lookup (e.g., 'claude', 'gemini')
   */
  protected abstract readonly cliCommand: string

  /**
   * Default models to use when API fetch fails
   */
  protected abstract readonly defaultModels: AgentModelInfo[]

  /**
   * Check if the adapter is available
   */
  async isAvailable(): Promise<boolean> {
    const path = await this.getExecutablePath()
    if (!path) return false

    try {
      await execAsync(`"${path}" --version`)
      return true
    } catch {
      return false
    }
  }

  /**
   * Find the executable path
   *
   * Searches PATH first, then checks known installation locations.
   */
  async getExecutablePath(): Promise<string | null> {
    if (this.cachedPath) return this.cachedPath

    // First check if command is in PATH
    try {
      const { stdout } = await execAsync(`which ${this.cliCommand}`)
      const path = stdout.trim()
      if (path && existsSync(path)) {
        this.cachedPath = path
        return path
      }
    } catch {
      // Not in PATH, check known locations
    }

    // Check known installation paths
    for (const path of this.possiblePaths) {
      if (path.includes('*')) {
        try {
          const { glob } = await import('glob')
          const matches = await glob(path)
          if (matches.length > 0 && existsSync(matches[0])) {
            this.cachedPath = matches[0]
            return matches[0]
          }
        } catch {
          // glob not available or no matches
        }
      } else if (existsSync(path)) {
        this.cachedPath = path
        return path
      }
    }

    return null
  }

  /**
   * Invoke the agent with a prompt
   * Subclasses must implement this method.
   */
  abstract invoke(options: AgentInvokeOptions): AgentProcess

  /**
   * Parse output stream for events
   *
   * Provides common line-by-line parsing logic.
   * Subclasses can override parseLine() for custom parsing.
   */
  async *parseOutput(stream: NodeJS.ReadableStream): AsyncIterable<AgentOutputEvent> {
    const decoder = new TextDecoder()
    let buffer = ''

    for await (const chunk of stream) {
      buffer += decoder.decode(chunk as Buffer, { stream: true })

      // Process complete lines
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue

        const event = this.parseLine(line)
        if (event) {
          yield event
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const event = this.parseLine(buffer)
      if (event) {
        yield event
      }
    }
  }

  /**
   * Parse a single line of output
   *
   * Default implementation handles JSON and plain text.
   * Subclasses can override for custom parsing logic.
   */
  protected parseLine(line: string): AgentOutputEvent | null {
    const timestamp = new Date()

    // Try to parse as JSON
    try {
      const json = JSON.parse(line)

      if (json.type === 'error' || json.error) {
        const errorMessage = json.error || json.message || line

        // Check for usage limit first (more specific)
        const usageLimitResult = this.detectUsageLimit(errorMessage)
        if (usageLimitResult.isUsageLimit) {
          return {
            type: 'usage-limit',
            message: line,
            timestamp,
            resetAt: usageLimitResult.resetAt
          }
        }

        // Check for rate limit
        if (this.detectRateLimit(errorMessage)) {
          return {
            type: 'rate-limit',
            message: line,
            timestamp
          }
        }

        return {
          type: 'error',
          message: line,
          timestamp
        }
      } else if (json.type === 'result' || json.done) {
        return {
          type: 'complete',
          message: line,
          timestamp
        }
      }

      // Default: treat as log
      return {
        type: 'log',
        message: line,
        timestamp
      }
    } catch {
      // Not JSON, treat as plain text
      const usageLimitResult = this.detectUsageLimit(line)
      if (usageLimitResult.isUsageLimit) {
        return {
          type: 'usage-limit',
          message: line,
          timestamp,
          resetAt: usageLimitResult.resetAt
        }
      }

      if (this.detectRateLimit(line)) {
        return {
          type: 'rate-limit',
          message: line,
          timestamp
        }
      }

      if (line.toLowerCase().includes('error')) {
        return {
          type: 'error',
          message: line,
          timestamp
        }
      }

      return {
        type: 'log',
        message: line,
        timestamp
      }
    }
  }

  /**
   * Detect rate limit errors
   *
   * Override in subclasses for adapter-specific patterns.
   */
  detectRateLimit(output: string): boolean {
    const lower = output.toLowerCase()
    return (
      lower.includes('rate limit') ||
      lower.includes('rate_limit') ||
      lower.includes('429') ||
      lower.includes('too many requests') ||
      lower.includes('overloaded')
    )
  }

  /**
   * Detect usage limit errors (quota exceeded, need to wait longer)
   *
   * Override in subclasses for adapter-specific patterns.
   */
  detectUsageLimit(output: string): UsageLimitResult {
    const lower = output.toLowerCase()

    const isUsageLimit =
      lower.includes('usage limit') ||
      lower.includes('usage_limit') ||
      lower.includes('quota exceeded') ||
      lower.includes('quota_exceeded') ||
      lower.includes('limit exceeded') ||
      lower.includes('daily limit') ||
      lower.includes('monthly limit') ||
      lower.includes('exceeded your') ||
      lower.includes('api limit') ||
      lower.includes('request limit reached') ||
      lower.includes('token limit') ||
      lower.includes('out of credits') ||
      lower.includes('billing')

    if (!isUsageLimit) {
      return { isUsageLimit: false }
    }

    // Try to extract reset time from the message
    const resetAt = this.extractResetTime(output)

    return { isUsageLimit: true, resetAt }
  }

  /**
   * Extract reset time from error message
   *
   * Common patterns supported by default.
   */
  protected extractResetTime(output: string): Date | undefined {
    let resetAt: Date | undefined

    // Pattern: "resets at HH:MM" or "resets at HH:MM:SS"
    const timeMatch = output.match(
      /(?:reset|available|try again)(?:\s+at)?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM))?)/i
    )
    if (timeMatch) {
      const today = new Date()
      const [hours, minutes] = timeMatch[1].split(':').map(Number)
      resetAt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes)
      if (resetAt < today) {
        resetAt.setDate(resetAt.getDate() + 1)
      }
      return resetAt
    }

    // Pattern: "in X hours/minutes"
    const durationMatch = output.match(
      /(?:reset|available|try again)\s+in\s+(\d+)\s*(hour|minute|min|second|sec|hr|h|m|s)s?/i
    )
    if (durationMatch) {
      const amount = parseInt(durationMatch[1], 10)
      const unit = durationMatch[2].toLowerCase()
      resetAt = new Date()
      if (unit.startsWith('h')) {
        resetAt.setHours(resetAt.getHours() + amount)
      } else if (unit.startsWith('m')) {
        resetAt.setMinutes(resetAt.getMinutes() + amount)
      } else {
        resetAt.setSeconds(resetAt.getSeconds() + amount)
      }
      return resetAt
    }

    // Pattern: ISO timestamp
    const isoMatch = output.match(
      /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/i
    )
    if (isoMatch) {
      return new Date(isoMatch[1])
    }

    return undefined
  }

  /**
   * Detect authentication errors in output
   *
   * Override in subclasses for adapter-specific patterns.
   */
  detectAuthError(output: string): boolean {
    const lower = output.toLowerCase()
    return (
      lower.includes('unauthorized') ||
      lower.includes('401') ||
      lower.includes('403') ||
      lower.includes('authentication failed') ||
      lower.includes('not authenticated') ||
      lower.includes('invalid token') ||
      lower.includes('token expired') ||
      lower.includes('please log in') ||
      lower.includes('please authenticate') ||
      lower.includes('login required') ||
      lower.includes('access denied') ||
      lower.includes('invalid api key') ||
      lower.includes('api_key_invalid')
    )
  }

  /**
   * Validate authentication
   *
   * Subclasses must implement this method.
   */
  abstract validateAuth(): Promise<AuthValidationResult>

  /**
   * Trigger re-authentication flow for the agent
   *
   * Subclasses must implement this method.
   * @param projectPath - Optional project path to authenticate within that project's context
   */
  abstract triggerReauth(projectPath?: string): Promise<{ success: boolean; error?: string }>

  /**
   * Check if we're currently within usage limits
   *
   * Subclasses must implement this method.
   */
  abstract checkUsageLimits(): Promise<UsageLimitCheckResult>

  /**
   * Get current usage percentage
   *
   * Subclasses must implement this method.
   */
  abstract getUsagePercentage(): Promise<UsagePercentageResult>

  /**
   * Fetch available models
   *
   * Subclasses must implement this method.
   */
  abstract fetchAvailableModels(): Promise<AgentModelInfo[]>

  /**
   * Get project config files to look for
   *
   * Subclasses should override this with adapter-specific config files.
   */
  abstract getProjectConfigFiles(): string[]

  /**
   * Get adapter capabilities
   *
   * Subclasses should override this with adapter-specific capabilities.
   */
  abstract getCapabilities(): AgentCapabilities

  /**
   * Set a custom executable path for this agent
   * This overrides auto-detection
   *
   * Subclasses must implement this method.
   */
  abstract setCustomPath(path: string | null): void

  /**
   * Test that the CLI is working correctly
   * Returns version string on success
   *
   * Subclasses must implement this method.
   */
  abstract testCli(): Promise<{ success: boolean; version?: string; error?: string }>

  /**
   * Helper to spawn a process with common setup
   */
  protected spawnProcess(
    execPath: string,
    args: string[],
    options: AgentInvokeOptions
  ): AgentProcess {
    logger.debug(`[${this.name}] Invoking with args:`, args.join(' '))
    logger.debug(`[${this.name}] Working directory:`, options.workingDirectory)
    logger.debug(`[${this.name}] Executable path:`, execPath)

    const child = spawn(execPath, args, {
      cwd: options.workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CI: 'true',
        TERM: 'dumb',
        ...this.getAdditionalEnv(options)
      }
    })

    logger.debug(`[${this.name}] Process spawned with PID:`, child.pid)

    // Close stdin immediately
    if (child.stdin) {
      child.stdin.end()
      logger.debug(`[${this.name}] stdin closed`)
    }

    // Log process events for debugging
    child.on('spawn', () => {
      logger.debug(`[${this.name}] Process spawn event fired, PID:`, child.pid)
    })

    child.on('error', (err) => {
      console.error(`[${this.name}] Process error:`, err.message)
    })

    child.on('exit', (code, signal) => {
      logger.debug(`[${this.name}] Process exited with code:`, code, 'signal:', signal)
    })

    child.on('close', (code, signal) => {
      logger.debug(`[${this.name}] Process closed with code:`, code, 'signal:', signal)
    })

    // Log stdout/stderr data for debugging
    child.stdout?.on('data', (chunk) => {
      logger.debug(`[${this.name}] stdout chunk received, size:`, chunk.length)
    })

    child.stderr?.on('data', (chunk) => {
      logger.debug(`[${this.name}] stderr chunk received, size:`, chunk.length)
    })

    return wrapChildProcess(child, this.name)
  }

  /**
   * Get additional environment variables for the spawned process
   *
   * Override in subclasses to add adapter-specific environment variables.
   */
  protected getAdditionalEnv(_options: AgentInvokeOptions): Record<string, string> {
    return {}
  }

  /**
   * Format a model ID into a display name
   *
   * Default implementation capitalizes words and removes date suffixes.
   * Override for adapter-specific formatting.
   */
  protected formatModelName(id: string): string {
    const parts = id.split('-')
    return parts
      .filter((part) => !/^\d{8}$/.test(part)) // Remove date suffixes
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  /**
   * Get a description for a model based on its ID
   *
   * Override in subclasses for adapter-specific descriptions.
   */
  protected getModelDescription(_id: string): string {
    return 'AI model'
  }

  /**
   * Resolve a model alias or ID to the actual model ID
   *
   * If the input is an alias (e.g., "sonnet"), returns the latest model ID for that tier.
   * If the input is already a full model ID, returns it as-is.
   * Falls back to default model if alias cannot be resolved.
   *
   * @param modelAliasOrId - Either an alias ("sonnet") or full model ID ("claude-sonnet-4-5")
   * @returns The resolved model ID
   */
  async resolveModelAlias(modelAliasOrId: string): Promise<string> {
    // If it looks like a full model ID (contains dashes or slashes), return as-is
    if (modelAliasOrId.includes('-') || modelAliasOrId.includes('/')) {
      return modelAliasOrId
    }

    // It's likely an alias - fetch models and find the latest for this tier
    const alias = modelAliasOrId.toLowerCase() as ModelAlias
    const models = await this.fetchAvailableModels()

    // Find the latest model for this alias/tier
    const matchingModels = models.filter((m) =>
      m.alias === alias ||
      m.tier === alias ||
      m.id.toLowerCase().includes(alias)
    )

    if (matchingModels.length === 0) {
      // No match found - return default model or the original input
      const defaultModel = models.find((m) => m.isDefault)
      return defaultModel?.id || modelAliasOrId
    }

    // Return the first matching model (should be the latest due to sorting in fetchAvailableModels)
    return matchingModels[0].id
  }

  /**
   * Get available models with alias information
   *
   * This method wraps fetchAvailableModels() and adds alias/tier metadata
   * to help with resolution and UI display.
   *
   * @returns Array of models with alias information
   */
  async getAvailableModels(): Promise<AgentModelInfo[]> {
    const models = await this.fetchAvailableModels()
    return this.enrichModelsWithAliases(models)
  }

  /**
   * Enrich models with alias and tier information
   *
   * Detects the tier from model IDs and marks the latest version in each tier
   * with an alias. Also marks older versions as legacy.
   *
   * @param models - Raw models from API
   * @returns Models enriched with alias/tier metadata
   */
  protected enrichModelsWithAliases(models: AgentModelInfo[]): AgentModelInfo[] {
    // Group models by tier
    const tierGroups = new Map<string, AgentModelInfo[]>()

    for (const model of models) {
      const tier = this.extractTier(model.id)
      if (tier) {
        if (!tierGroups.has(tier)) {
          tierGroups.set(tier, [])
        }
        tierGroups.get(tier)!.push(model)
      }
    }

    // For each tier, mark the latest version with an alias
    const enriched = models.map((model) => {
      const tier = this.extractTier(model.id)
      if (!tier) return model

      const tierModels = tierGroups.get(tier) || []
      const sortedByVersion = [...tierModels].sort((a, b) => {
        // Extract version numbers for comparison
        const versionA = this.extractVersion(a.id)
        const versionB = this.extractVersion(b.id)
        return this.compareVersions(versionB, versionA) // Descending (newer first)
      })

      const isLatest = sortedByVersion[0]?.id === model.id
      const version = this.extractVersion(model.id)

      return {
        ...model,
        tier,
        version,
        alias: isLatest ? (tier as ModelAlias) : undefined,
        isLegacy: !isLatest
      }
    })

    return enriched
  }

  /**
   * Extract the tier/family from a model ID
   *
   * @param modelId - The model ID to extract from
   * @returns The tier name or undefined
   */
  protected extractTier(modelId: string): string | undefined {
    const lower = modelId.toLowerCase()
    if (lower.includes('sonnet')) return 'sonnet'
    if (lower.includes('opus')) return 'opus'
    if (lower.includes('haiku')) return 'haiku'
    if (lower.includes('flash')) return 'flash'
    if (lower.includes('pro')) return 'pro'
    return undefined
  }

  /**
   * Extract version number from model ID
   *
   * @param modelId - The model ID to extract from
   * @returns Version string (e.g., "4.5", "2.0")
   */
  protected extractVersion(modelId: string): string {
    // Try to match version patterns like "4-5", "4.5", "2.5", etc.
    const match = modelId.match(/(\d+)[-.](\d+)/)
    if (match) {
      return `${match[1]}.${match[2]}`
    }
    // Fall back to just the first number
    const simpleMatch = modelId.match(/(\d+)/)
    return simpleMatch ? simpleMatch[1] : '0'
  }

  /**
   * Compare two version strings
   *
   * @param a - First version
   * @param b - Second version
   * @returns Positive if a > b, negative if a < b, 0 if equal
   */
  protected compareVersions(a: string, b: string): number {
    const [majorA, minorA = 0] = a.split('.').map(Number)
    const [majorB, minorB = 0] = b.split('.').map(Number)

    if (majorA !== majorB) return majorA - majorB
    return minorA - minorB
  }

  /**
   * Analyze agent output to detect if work is incomplete
   *
   * Searches for common patterns that indicate the agent wants to do more work:
   * - Multi-phase/step indicators (e.g., "Phase 2 of 3", "3 steps remaining")
   * - TODO/FIXME markers
   * - Continuation signals (e.g., "I'll continue", "Next I will")
   * - Approval seeking questions
   * - Token limit mentions
   */
  detectIncompleteWork(outputLog: AgentOutputEvent[]): {
    isIncomplete: boolean
    reason?: 'multi-phase' | 'todo-items' | 'continuation-signal' | 'approval-needed' | 'token-limit'
    details?: string
    suggestedNextSteps?: string[]
  } {
    // Combine all log messages into searchable text (last 100 messages for performance)
    const recentLogs = outputLog.slice(-100)
    const fullText = recentLogs.map((e) => e.message).join('\n')
    const lowerText = fullText.toLowerCase()

    // Pattern 1: Multi-phase/step indicators (HIGH PRIORITY)
    const phasePatterns = [
      /phase\s+(\d+)\s+of\s+(\d+)/i,
      /step\s+(\d+)\s+of\s+(\d+)/i,
      /(\d+)\s+(?:phases?|steps?)\s+(?:remaining|left)/i,
      /completed?\s+(?:phase|step)\s+(\d+)/i,
      /next\s+(?:phase|step)\s+(?:will be|is)/i,
      /in\s+the\s+next\s+iteration/i,
      /continuing\s+in\s+next/i
    ]

    for (const pattern of phasePatterns) {
      const match = fullText.match(pattern)
      if (match) {
        return {
          isIncomplete: true,
          reason: 'multi-phase',
          details: match[0],
          suggestedNextSteps: [
            'Review the completed phase',
            'Continue with the next phase by re-prompting the task'
          ]
        }
      }
    }

    // Pattern 2: TODO/FIXME markers (HIGH PRIORITY)
    // Look for these in the final output (last 20 messages)
    const finalOutput = recentLogs.slice(-20).map((e) => e.message).join('\n')
    const todoPatterns = [
      /TODO:/i,
      /FIXME:/i,
      /still\s+need\s+to/i,
      /next\s+steps?:/i,
      /remaining\s+work:/i,
      /additional\s+tasks?:/i,
      /follow-?up\s+required:/i
    ]

    for (const pattern of todoPatterns) {
      if (pattern.test(finalOutput)) {
        // Extract the TODO items if possible
        const lines = finalOutput.split('\n')
        const todoLines = lines.filter((line) => /TODO:|FIXME:|^\s*[-*]\s+/i.test(line))

        return {
          isIncomplete: true,
          reason: 'todo-items',
          details: 'Agent indicated remaining tasks or TODO items',
          suggestedNextSteps: todoLines.length > 0 ? todoLines.slice(0, 5) : undefined
        }
      }
    }

    // Pattern 3: Continuation signals (MEDIUM PRIORITY)
    const continuationPatterns = [
      /(?:i'll|i will)\s+continue/i,
      /let'?s\s+continue\s+with/i,
      /moving\s+on\s+to/i,
      /proceeding\s+to\s+(?:the\s+)?next/i,
      /will\s+implement\s+next/i,
      /(?:should|shall)\s+(?:we|i)\s+proceed/i
    ]

    for (const pattern of continuationPatterns) {
      if (pattern.test(lowerText)) {
        return {
          isIncomplete: true,
          reason: 'continuation-signal',
          details: 'Agent indicated intention to continue work',
          suggestedNextSteps: [
            'Confirm completion or re-prompt to continue',
            'Review what was completed so far'
          ]
        }
      }
    }

    // Pattern 4: Approval seeking questions (MEDIUM PRIORITY)
    const approvalPatterns = [
      /should\s+i\s+continue\s*\?/i,
      /would\s+you\s+like\s+me\s+to/i,
      /shall\s+i\s+proceed\s+with/i,
      /do\s+you\s+want\s+me\s+to/i,
      /waiting\s+for\s+approval/i,
      /please\s+(?:confirm|approve)/i
    ]

    for (const pattern of approvalPatterns) {
      if (pattern.test(finalOutput)) {
        return {
          isIncomplete: true,
          reason: 'approval-needed',
          details: 'Agent is asking for approval to continue',
          suggestedNextSteps: [
            'Review the work completed so far',
            'Decide whether to approve continuation or modify the approach'
          ]
        }
      }
    }

    // Pattern 5: Token/output limit mentions (LOW PRIORITY)
    const limitPatterns = [
      /due\s+to\s+(?:response|output|token)\s+length/i,
      /to\s+avoid\s+(?:token|output)\s+limits?/i,
      /splitting\s+into\s+multiple/i,
      /breaking\s+(?:this|it)\s+into\s+parts/i,
      /reached\s+(?:output|token)\s+limit/i
    ]

    for (const pattern of limitPatterns) {
      if (pattern.test(lowerText)) {
        return {
          isIncomplete: true,
          reason: 'token-limit',
          details: 'Agent hit output limits and may have more to say',
          suggestedNextSteps: ['Re-prompt to continue the work']
        }
      }
    }

    // No incomplete work detected
    return { isIncomplete: false }
  }
}
