/**
 * Gemini CLI Adapter
 *
 * Implements the AgentAdapter interface for Google's Gemini CLI.
 * Includes rate limit verification to prevent API throttling,
 * especially important for free tier users.
 *
 * @see https://ai.google.dev/gemini-api/docs/rate-limits for rate limit documentation
 */

import { exec, spawn, type ChildProcess } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { homedir, platform } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import { logger } from '@main/utils/logger'

const execAsync = promisify(exec)

import type {
  AgentCapabilities,
  AgentInvokeOptions,
  AgentModelInfo,
  AgentOutputEvent,
  AgentProcess
} from '@shared/types'
import { AGENT_IDS, GEMINI_MODELS as GEMINI_DEFAULT_MODELS } from '@shared/types'
import { getAgentApiKey } from '@main/storage/secure-store'
import { BaseAgentAdapter } from './base-adapter'
import { quoteExecutablePath } from '@main/utils/paths'

/**
 * Gemini API rate limits by tier
 * Based on https://ai.google.dev/gemini-api/docs/rate-limits
 *
 * Note: These are approximate values and may change.
 * The actual limits can be viewed in Google AI Studio's usage dashboard.
 */
export const GEMINI_RATE_LIMITS = {
  /** Free tier rate limits (most restrictive) */
  FREE: {
    /** Requests per minute */
    RPM: 15,
    /** Tokens per minute (input) */
    TPM: 32000,
    /** Requests per day */
    RPD: 1500
  },
  /** Tier 1 (paid billing account linked) */
  TIER_1: {
    RPM: 500,
    TPM: 1000000,
    RPD: 10000
  },
  /** Tier 2 (spend > $250, 30+ days since payment) */
  TIER_2: {
    RPM: 1000,
    TPM: 2000000,
    RPD: 50000
  },
  /** Tier 3 (spend > $1000, 30+ days since payment) */
  TIER_3: {
    RPM: 2000,
    TPM: 4000000,
    RPD: 100000
  }
} as const

/** Type for Gemini usage tier */
export type GeminiTier = keyof typeof GEMINI_RATE_LIMITS

/**
 * Gemini model token limits (used for validation)
 */
export const GEMINI_MODEL_LIMITS = {
  'gemini-2.5-flash': { inputTokenLimit: 1048576, outputTokenLimit: 65536 },
  'gemini-2.5-pro': { inputTokenLimit: 1048576, outputTokenLimit: 65536 },
  'gemini-2.0-flash': { inputTokenLimit: 1048576, outputTokenLimit: 8192 },
  'gemini-2.0-flash-lite': { inputTokenLimit: 1048576, outputTokenLimit: 8192 },
  'gemini-1.5-flash': { inputTokenLimit: 1048576, outputTokenLimit: 8192 },
  'gemini-1.5-pro': { inputTokenLimit: 2097152, outputTokenLimit: 8192 }
} as const

/** API endpoint for models list */
const MODELS_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

/** Cache duration for models list (24 hours in ms) */
const MODELS_CACHE_DURATION = 24 * 60 * 60 * 1000

/**
 * Possible paths where Gemini CLI might be installed
 */
const POSSIBLE_PATHS = platform() === 'win32'
  ? [
      // npm global install on Windows
      join(process.env.APPDATA || '', 'npm', 'gemini.cmd'),
      join(process.env.APPDATA || '', 'npm', 'gemini'),
      // npm prefix on Windows
      join(process.env.PROGRAMFILES || '', 'nodejs', 'gemini.cmd'),
      join(process.env.PROGRAMFILES || '', 'nodejs', 'gemini'),
      // User profile npm
      join(homedir(), 'AppData', 'Roaming', 'npm', 'gemini.cmd'),
      join(homedir(), 'AppData', 'Roaming', 'npm', 'gemini'),
      // pip install locations on Windows
      join(homedir(), 'AppData', 'Local', 'Programs', 'Python', '*', 'Scripts', 'gemini.exe'),
      join(homedir(), 'AppData', 'Local', 'Programs', 'Python', '*', 'Scripts', 'gemini-cli.exe')
    ]
  : [
      // npm global install
      '/usr/local/bin/gemini',
      '/usr/bin/gemini',
      // homebrew
      '/opt/homebrew/bin/gemini',
      // user local
      join(homedir(), '.local/bin/gemini'),
      // npm prefix
      join(homedir(), '.npm-global/bin/gemini'),
      // nvm
      join(homedir(), '.nvm/versions/node/*/bin/gemini'),
      // pip install locations
      join(homedir(), '.local/bin/gemini-cli'),
      '/usr/local/bin/gemini-cli'
    ]

/**
 * Wrap a ChildProcess as an AgentProcess
 *
 * @param child - The child process to wrap
 * @returns An AgentProcess wrapper
 */
function wrapChildProcess(child: ChildProcess): AgentProcess {
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
            logger.debug(`[Gemini] wait() resolved via 'exit' event, code=${code}, pid=${child.pid}`)
            resolve({ exitCode: code ?? 1 })
          }
        })
        child.on('error', (err) => {
          if (!resolved) {
            resolved = true
            logger.debug(
              `[Gemini] wait() resolved via 'error' event, error=${err.message}, pid=${child.pid}`
            )
            resolve({ exitCode: 1 })
          }
        })
      })
    }
  }
}

/**
 * Gemini CLI Adapter implementation
 *
 * Provides integration with Google's Gemini AI through a CLI interface.
 * Implements rate limit checking to prevent API throttling, particularly
 * important for users on the free tier.
 */
export class GeminiAdapter extends BaseAgentAdapter {
  readonly id = AGENT_IDS.GEMINI
  readonly name = 'Gemini'

  protected readonly possiblePaths = POSSIBLE_PATHS
  protected readonly cliCommand = 'gemini'
  protected readonly defaultModels = GEMINI_DEFAULT_MODELS

  private customPath: string | null = null
  private cachedApiKey: string | null = null
  private currentTier: GeminiTier = 'FREE'
  private requestsThisMinute = 0
  private requestsToday = 0
  private lastMinuteReset = Date.now()
  private lastDayReset = Date.now()

  /**
   * Set a custom executable path for this agent
   * This overrides auto-detection
   */
  setCustomPath(path: string | null): void {
    this.customPath = path
    // Clear cached path to force re-detection if custom path is cleared
    if (!path) {
      this.cachedPath = null
    }
    logger.debug('[Gemini] Custom path set to:', path || '(auto-detect)')
  }

  /**
   * Test that the CLI is working correctly
   * Returns version string on success
   */
  async testCli(): Promise<{ success: boolean; version?: string; error?: string }> {
    const execPath = await this.getExecutablePath()
    if (!execPath) {
      return {
        success: false,
        error: 'Could not find Gemini CLI executable. Please set a custom path or install the CLI.'
      }
    }

    try {
      // On all platforms, use shell for proper executable resolution
      // This handles .cmd files on Windows and script shebangs on Unix
      const cmd = `"${execPath}" --version`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options: any = { encoding: 'utf8', timeout: 10000, shell: true }
      const result = await execAsync(cmd, options)
      const stdout = String(result.stdout)
      const stderr = String(result.stderr)

      const output = stdout.trim() || stderr.trim()
      if (output) {
        // Extract version from output
        const versionMatch = output.match(/(\d+\.\d+\.\d+(?:-[a-z0-9.]+)?)/i)
        const version = versionMatch ? versionMatch[1] : output
        logger.debug('[Gemini] CLI test successful, version:', version)
        return { success: true, version }
      }

      return { success: true, version: 'unknown' }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[Gemini] CLI test failed:', message)
      return {
        success: false,
        error: `Failed to run CLI: ${message}`
      }
    }
  }

  /**
   * Check if Gemini CLI is available
   *
   * @returns True if the CLI is installed and executable
   */
  async isAvailable(): Promise<boolean> {
    const path = await this.getExecutablePath()
    if (!path) return false

    try {
      // Try to run --version to verify it works
      // Use shell: true on all platforms for proper executable resolution
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options: any = { encoding: 'utf8', timeout: 10000, shell: true }
      await execAsync(`"${path}" --version`, options)
      return true
    } catch {
      return false
    }
  }

  /**
   * Find the Gemini executable path
   *
   * Searches common installation locations and PATH for the Gemini CLI.
   *
   * @returns The path to the executable, or null if not found
   */
  async getExecutablePath(): Promise<string | null> {
    // If custom path is set, use it directly
    if (this.customPath) {
      logger.debug('[Gemini] Using custom path:', this.customPath)
      return this.customPath
    }

    if (this.cachedPath) return this.cachedPath

    const isWindows = platform() === 'win32'

    // First check if 'gemini' is in PATH
    try {
      const shellCmd = isWindows ? 'where gemini' : 'which gemini'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pathOptions: any = { encoding: 'utf8', timeout: 5000 }
      if (isWindows) pathOptions.shell = true
      const result = await execAsync(shellCmd, pathOptions)
      const stdout = String(result.stdout)
      const path = stdout.trim().split('\n')[0].trim()
      if (path && existsSync(path)) {
        logger.debug('[Gemini] Found gemini via PATH:', path)
        this.cachedPath = path
        return path
      }
    } catch {
      // Not in PATH, check known locations
    }

    // Also check for 'gemini-cli' in PATH
    try {
      const shellCmd = isWindows ? 'where gemini-cli' : 'which gemini-cli'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pathOptions2: any = { encoding: 'utf8', timeout: 5000 }
      if (isWindows) pathOptions2.shell = true
      const result2 = await execAsync(shellCmd, pathOptions2)
      const stdout2 = String(result2.stdout)
      const path = stdout2.trim().split('\n')[0].trim()
      if (path && existsSync(path)) {
        logger.debug('[Gemini] Found gemini-cli via PATH:', path)
        this.cachedPath = path
        return path
      }
    } catch {
      // Not in PATH
    }

    // Check known installation paths
    for (const path of POSSIBLE_PATHS) {
      // Skip empty paths (can happen if env vars are undefined)
      if (!path || path.includes('undefined')) continue

      // Handle glob-like patterns (for nvm)
      if (path.includes('*')) {
        try {
          const { glob } = await import('glob')
          const matches = await glob(path.replace(/\\/g, '/'))
          if (matches.length > 0 && existsSync(matches[0])) {
            logger.debug('[Gemini] Found gemini via glob pattern:', matches[0])
            this.cachedPath = matches[0]
            return matches[0]
          }
        } catch {
          // glob not available or no matches
        }
      } else if (existsSync(path)) {
        logger.debug('[Gemini] Found gemini at known path:', path)
        this.cachedPath = path
        return path
      }
    }

    logger.debug('[Gemini] Could not find gemini executable')
    return null
  }

  /**
   * Invoke Gemini with a prompt
   *
   * @param options - Invocation options including prompt and working directory
   * @returns An AgentProcess handle for the running process
   * @throws Error if the CLI is not found
   */
  invoke(options: AgentInvokeOptions & { apiKey?: string }): AgentProcess {
    // Use cached path - callers should ensure getExecutablePath() was called first
    const execPath = this.cachedPath
    if (!execPath) {
      throw new Error('Gemini CLI not found. Ensure getExecutablePath() is called before invoke().')
    }

    // Get API key from options or fall back to cached
    const apiKey = options.apiKey || this.cachedApiKey

    const args: string[] = []

    // Add model selection if specified in options, otherwise use default from shared types
    const model = options.agentOptions?.model as string | undefined
    if (model) {
      args.push('--model', model)
    } else {
      // Use default from GEMINI_MODELS in shared types
      args.push('--model', 'gemini-2.5-pro')
    }

    // Add output format for structured parsing
    args.push('--output-format', 'stream-json')

    args.push('-y') // Assume yes to prompts

    // Add include directories if provided (Gemini CLI uses --include-directories for additional context)
    if (options.contextFiles && options.contextFiles.length > 0) {
      // Extract unique directories from context files
      const directories = [...new Set(options.contextFiles.map((file) => {
        const lastSlash = file.lastIndexOf('/')
        return lastSlash > 0 ? file.substring(0, lastSlash) : file
      }))]
      for (const dir of directories) {
        args.push('--include-directories', dir)
      }
    }

    // On Windows, always use shell: true for proper executable resolution
    const isWindows = platform() === 'win32'

    // On Windows with shell: true, multi-line prompts with empty lines get truncated
    // because the shell interprets empty lines as command separators.
    // Solution: Pass prompt via stdin on Windows instead of as a command-line argument.
    // On non-Windows, we can safely pass the prompt as an argument.
    if (!isWindows) {
      args.push(options.prompt)
    }

    logger.debug('[Gemini] Invoking with args:', args.join(' '))
    logger.debug('[Gemini] Working directory:', options.workingDirectory)
    logger.debug('[Gemini] Executable path:', execPath)
    if (isWindows) {
      logger.debug('[Gemini] Prompt will be passed via stdin (Windows mode)')
    }

    // Build environment with API key if available
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      // Ensure non-interactive mode
      CI: 'true',
      TERM: 'dumb'
    }

    // Pass API key via environment variable if available
    if (apiKey) {
      env.GEMINI_API_KEY = apiKey
    }

    // Quote the executable path if using shell mode (handles spaces in path)
    const spawnPath = isWindows ? quoteExecutablePath(execPath) : execPath

    // Spawn the process
    const child = spawn(spawnPath, args, {
      cwd: options.workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: isWindows,
      env
    })

    logger.debug('[Gemini] Process spawned with PID:', child.pid)

    // On Windows, write the prompt to stdin then close it
    // On non-Windows, just close stdin immediately
    if (child.stdin) {
      if (isWindows) {
        child.stdin.write(options.prompt)
        child.stdin.end()
        logger.debug('[Gemini] Prompt written to stdin and closed (Windows mode)')
      } else {
        child.stdin.end()
        logger.debug('[Gemini] stdin closed')
      }
    }

    // Log process events for debugging
    child.on('spawn', () => {
      logger.debug('[Gemini] Process spawn event fired, PID:', child.pid)
    })

    child.on('error', (err) => {
      console.error('[Gemini] Process error:', err.message)
    })

    child.on('exit', (code, signal) => {
      logger.debug('[Gemini] Process exited with code:', code, 'signal:', signal)
    })

    child.on('close', (code, signal) => {
      logger.debug('[Gemini] Process closed with code:', code, 'signal:', signal)
    })

    // Log stdout/stderr data for debugging
    child.stdout?.on('data', (chunk) => {
      logger.debug('[Gemini] stdout chunk received, size:', chunk.length)
    })

    child.stderr?.on('data', (chunk) => {
      logger.debug('[Gemini] stderr chunk received, size:', chunk.length)
    })

    // Track request for rate limiting
    this.trackRequest()

    return wrapChildProcess(child)
  }

  /**
   * Parse output stream for events
   *
   * @param stream - The readable stream to parse
   * @yields AgentOutputEvent objects for each parsed line
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
   * Parse a single line of output into an AgentOutputEvent
   *
   * @param line - The line to parse
   * @returns An AgentOutputEvent or null if the line should be skipped
   */
  protected parseLine(line: string): AgentOutputEvent | null {
    const timestamp = new Date()

    // Try to parse as JSON
    try {
      const json = JSON.parse(line)

      // Determine event type
      if (json.error) {
        const errorMessage = json.error.message || json.error || line

        // Check for rate limit
        if (this.detectRateLimit(errorMessage)) {
          return {
            type: 'rate-limit',
            message: line,
            timestamp
          }
        }

        // Check for usage limit
        const usageLimitResult = this.detectUsageLimit(errorMessage)
        if (usageLimitResult.isUsageLimit) {
          return {
            type: 'usage-limit',
            message: line,
            timestamp,
            resetAt: usageLimitResult.resetAt
          }
        }

        return {
          type: 'error',
          message: line,
          timestamp
        }
      } else if (json.done || json.type === 'result') {
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
   * Detect rate limit errors in output
   *
   * Gemini returns 429 errors when rate limits are exceeded.
   *
   * @param output - The output string to check
   * @returns True if a rate limit error is detected
   */
  detectRateLimit(output: string): boolean {
    const lower = output.toLowerCase()
    return (
      lower.includes('rate limit') ||
      lower.includes('rate_limit') ||
      lower.includes('429') ||
      lower.includes('too many requests') ||
      lower.includes('resource exhausted') ||
      lower.includes('quota exceeded') ||
      lower.includes('requests per minute') ||
      lower.includes('rpm limit') ||
      lower.includes('tpm limit') ||
      lower.includes('rpd limit')
    )
  }

  /**
   * Detect usage limit errors in output
   *
   * @param output - The output string to check
   * @returns Object indicating if a usage limit was detected and when it resets
   */
  detectUsageLimit(output: string): { isUsageLimit: boolean; resetAt?: Date } {
    const lower = output.toLowerCase()

    const isUsageLimit =
      lower.includes('usage limit') ||
      lower.includes('usage_limit') ||
      lower.includes('quota exceeded') ||
      lower.includes('quota_exceeded') ||
      lower.includes('limit exceeded') ||
      lower.includes('daily limit') ||
      lower.includes('daily_limit') ||
      lower.includes('exceeded your') ||
      lower.includes('api limit') ||
      lower.includes('request limit reached') ||
      lower.includes('resource exhausted') ||
      lower.includes('billing') ||
      lower.includes('free tier') ||
      lower.includes('upgrade your plan')

    if (!isUsageLimit) {
      return { isUsageLimit: false }
    }

    // Try to extract reset time
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
    }

    // Pattern: "in X hours/minutes/seconds"
    const durationMatch = output.match(
      /(?:reset|available|try again)\s+in\s+(\d+)\s*(hour|minute|min|second|sec|hr|h|m|s)s?/i
    )
    if (durationMatch && !resetAt) {
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
    }

    // For daily limits, estimate reset at midnight UTC
    if (!resetAt && lower.includes('daily')) {
      resetAt = new Date()
      resetAt.setUTCHours(24, 0, 0, 0) // Next midnight UTC
    }

    return { isUsageLimit: true, resetAt }
  }

  /**
   * Track a request for rate limiting purposes
   *
   * Updates internal counters used for pre-flight rate limit checks.
   */
  private trackRequest(): void {
    const now = Date.now()

    // Reset minute counter if needed
    if (now - this.lastMinuteReset >= 60000) {
      this.requestsThisMinute = 0
      this.lastMinuteReset = now
    }

    // Reset day counter if needed (24 hours)
    if (now - this.lastDayReset >= 86400000) {
      this.requestsToday = 0
      this.lastDayReset = now
    }

    this.requestsThisMinute++
    this.requestsToday++
  }

  /**
   * Set the current usage tier for rate limit calculations
   *
   * @param tier - The tier to set (FREE, TIER_1, TIER_2, or TIER_3)
   */
  setTier(tier: GeminiTier): void {
    this.currentTier = tier
    logger.debug(`[Gemini] Tier set to: ${tier}`)
  }

  /**
   * Get the current usage tier
   *
   * @returns The current tier
   */
  getTier(): GeminiTier {
    return this.currentTier
  }

  /**
   * Check if we're approaching rate limits based on tracked requests
   *
   * @returns Object with rate limit status and buffer percentages
   */
  getRateLimitStatus(): {
    rpm: { current: number; limit: number; percentage: number }
    rpd: { current: number; limit: number; percentage: number }
    isNearLimit: boolean
    canProceed: boolean
  } {
    const limits = GEMINI_RATE_LIMITS[this.currentTier]

    const rpmPercentage = (this.requestsThisMinute / limits.RPM) * 100
    const rpdPercentage = (this.requestsToday / limits.RPD) * 100
    const isNearLimit = rpmPercentage >= 80 || rpdPercentage >= 80
    const canProceed = rpmPercentage < 95 && rpdPercentage < 95

    return {
      rpm: {
        current: this.requestsThisMinute,
        limit: limits.RPM,
        percentage: rpmPercentage
      },
      rpd: {
        current: this.requestsToday,
        limit: limits.RPD,
        percentage: rpdPercentage
      },
      isNearLimit,
      canProceed
    }
  }

  /**
   * Check if we're currently within usage limits (pre-flight check)
   *
   * This performs both a local rate limit check and optionally
   * validates the API key to ensure it's working.
   *
   * @returns Object indicating if we can proceed
   */
  async checkUsageLimits(): Promise<{ canProceed: boolean; resetAt?: Date; message?: string }> {
    const execPath = await this.getExecutablePath()
    if (!execPath) {
      return { canProceed: false, message: 'Gemini CLI not found' }
    }

    // First check local rate limit tracking
    const rateLimitStatus = this.getRateLimitStatus()
    if (!rateLimitStatus.canProceed) {
      const resetAt = new Date()
      if (rateLimitStatus.rpm.percentage >= 95) {
        // Rate limit per minute - reset in 60 seconds
        resetAt.setSeconds(resetAt.getSeconds() + 60)
        return {
          canProceed: false,
          resetAt,
          message: `Approaching rate limit: ${rateLimitStatus.rpm.current}/${rateLimitStatus.rpm.limit} requests per minute (${this.currentTier} tier)`
        }
      } else {
        // Daily limit - reset at midnight
        resetAt.setUTCHours(24, 0, 0, 0)
        return {
          canProceed: false,
          resetAt,
          message: `Approaching daily limit: ${rateLimitStatus.rpd.current}/${rateLimitStatus.rpd.limit} requests per day (${this.currentTier} tier)`
        }
      }
    }

    // Optionally run a minimal test to verify API key works
    // Get API key for the test
    const apiKey = this.cachedApiKey

    // On Windows, always use shell: true for proper executable resolution
    const isWindows = platform() === 'win32'

    return new Promise((resolve) => {
      const args = ['--output-format', 'json', 'Reply with only the word: ok']

      // Build environment with API key if available
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        CI: 'true',
        TERM: 'dumb'
      }

      if (apiKey) {
        env.GEMINI_API_KEY = apiKey
      }

      // Quote the executable path if using shell mode (handles spaces in path)
      const spawnPath = isWindows ? quoteExecutablePath(execPath) : execPath

      const child = spawn(spawnPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: isWindows,
        env
      })

      let stdout = ''
      let stderr = ''
      let resolved = false

      // Set a 30-second timeout
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          child.kill('SIGTERM')
          console.warn('[Gemini] Usage check timed out after 30s')
          resolve({ canProceed: true })
        }
      }, 30000)

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString()
      })

      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString()
      })

      child.stdin?.end()

      child.on('close', (code) => {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)

        const result = stdout || stderr

        if (code === 0) {
          // Check output for errors
          try {
            const json = JSON.parse(result)
            if (json.error) {
              const errorMsg = json.error.message || json.error || result
              const usageLimitResult = this.detectUsageLimit(errorMsg)
              if (usageLimitResult.isUsageLimit || this.detectRateLimit(errorMsg)) {
                resolve({
                  canProceed: false,
                  resetAt: usageLimitResult.resetAt,
                  message: errorMsg
                })
                return
              }
            }
          } catch {
            // Not JSON - check raw output
            const usageLimitResult = this.detectUsageLimit(result)
            if (usageLimitResult.isUsageLimit || this.detectRateLimit(result)) {
              resolve({
                canProceed: false,
                resetAt: usageLimitResult.resetAt,
                message: result
              })
              return
            }
          }
          resolve({ canProceed: true })
        } else {
          const errorMessage = stderr || stdout || `Process exited with code ${code}`
          const usageLimitResult = this.detectUsageLimit(errorMessage)
          if (usageLimitResult.isUsageLimit || this.detectRateLimit(errorMessage)) {
            resolve({
              canProceed: false,
              resetAt: usageLimitResult.resetAt,
              message: errorMessage
            })
            return
          }
          console.warn('[Gemini] Usage check encountered non-limit error:', errorMessage)
          resolve({ canProceed: true })
        }
      })

      child.on('error', (err) => {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)
        console.warn('[Gemini] Usage check spawn error:', err.message)
        resolve({ canProceed: true })
      })
    })
  }

  /**
   * Load and cache the API key for use in invoke() and checkUsageLimits()
   *
   * This should be called before invoking the CLI to ensure the API key
   * is available in the environment. Returns the key for external use.
   *
   * @returns The API key or null if not found
   */
  async loadApiKey(): Promise<string | null> {
    const key = await this.getApiKey()
    this.cachedApiKey = key
    return key
  }

  /**
   * Get the Google AI API key from environment or config file
   *
   * @returns The API key or null if not found
   */
  private async getApiKey(): Promise<string | null> {
    // 1. Check Nightshift secure storage first (highest priority)
    try {
      const secureKey = await getAgentApiKey(AGENT_IDS.GEMINI)
      if (secureKey) {
        return secureKey
      }
    } catch (error) {
      console.warn('[Gemini] Failed to read from secure storage:', error)
    }

    // 2. Check environment variables
    if (process.env.GOOGLE_AI_API_KEY) {
      return process.env.GOOGLE_AI_API_KEY
    }

    if (process.env.GEMINI_API_KEY) {
      return process.env.GEMINI_API_KEY
    }

    // 3. Check config files (fallback)
    const currentPlatform = platform()
    const configPaths: string[] = []

    if (currentPlatform === 'darwin' || currentPlatform === 'linux') {
      configPaths.push(
        join(homedir(), '.config', 'gemini', 'credentials.json'),
        join(homedir(), '.gemini', 'credentials.json')
      )
    } else if (currentPlatform === 'win32') {
      configPaths.push(
        join(process.env.APPDATA || '', 'gemini', 'credentials.json'),
        join(homedir(), '.gemini', 'credentials.json')
      )
    }

    for (const configPath of configPaths) {
      try {
        if (existsSync(configPath)) {
          const credentials = JSON.parse(readFileSync(configPath, 'utf-8'))
          if (credentials.apiKey) {
            return credentials.apiKey
          }
        }
      } catch (error) {
        console.warn(`[Gemini] Failed to read credentials from ${configPath}:`, error)
      }
    }

    return null
  }

  /**
   * Get current usage percentage from the Google AI API
   *
   * Note: Google AI Studio doesn't have a direct usage API like Anthropic.
   * This method returns estimates based on local tracking.
   * For actual usage, users should check Google AI Studio dashboard.
   *
   * @returns Usage information with utilization percentages
   */
  async getUsagePercentage(): Promise<{
    fiveHour: { utilization: number; resetsAt: string } | null
    sevenDay: { utilization: number; resetsAt: string } | null
    error: string | null
  }> {
    const rateLimitStatus = this.getRateLimitStatus()

    // Calculate per-minute utilization with reset time
    const minuteResetAt = new Date(this.lastMinuteReset + 60000)

    // Calculate daily utilization with reset time (midnight UTC)
    const dayResetAt = new Date()
    dayResetAt.setUTCHours(24, 0, 0, 0)

    return {
      fiveHour: {
        utilization: rateLimitStatus.rpm.percentage,
        resetsAt: minuteResetAt.toISOString()
      },
      sevenDay: {
        utilization: rateLimitStatus.rpd.percentage,
        resetsAt: dayResetAt.toISOString()
      },
      error: null
    }
  }

  /**
   * Validate API key by making a minimal API request
   *
   * This checks if the provided API key is valid and what tier it belongs to.
   *
   * @returns Validation result with tier information if successful
   */
  async validateApiKey(): Promise<{
    valid: boolean
    tier?: GeminiTier
    message?: string
  }> {
    const apiKey = await this.getApiKey()
    if (!apiKey) {
      return {
        valid: false,
        message:
          'No API key found. Set GOOGLE_AI_API_KEY or GEMINI_API_KEY environment variable, or create a credentials file.'
      }
    }

    try {
      // Make a minimal API request to validate the key
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        if (response.status === 401 || response.status === 403) {
          return {
            valid: false,
            message: 'Invalid API key or insufficient permissions'
          }
        }
        if (response.status === 429) {
          return {
            valid: true,
            tier: 'FREE',
            message: 'API key is valid but rate limited (likely free tier)'
          }
        }
        return {
          valid: false,
          message: `API error: ${response.status} - ${errorText}`
        }
      }

      // Key is valid - assume FREE tier unless we can determine otherwise
      // In practice, tier detection would require checking billing status
      return {
        valid: true,
        tier: 'FREE',
        message: 'API key is valid'
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[Gemini] Failed to validate API key:', message)
      return {
        valid: false,
        message: `Failed to validate: ${message}`
      }
    }
  }

  /**
   * Fetch available models from the Google AI API
   * Returns cached models if available and not expired
   * Falls back to hardcoded defaults on API failure
   */
  async fetchAvailableModels(): Promise<AgentModelInfo[]> {
    // Return cached models if still valid
    const now = Date.now()
    if (this.cachedModels && now - this.modelsCacheTime < MODELS_CACHE_DURATION) {
      return this.cachedModels
    }

    try {
      const apiKey = await this.getApiKey()
      if (!apiKey) {
        console.warn('[Gemini] No API key available, using default models')
        return GEMINI_DEFAULT_MODELS
      }

      const response = await fetch(`${MODELS_API_URL}?key=${apiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        console.warn('[Gemini] Models API error:', response.status)
        return GEMINI_DEFAULT_MODELS
      }

      const data = (await response.json()) as {
        models?: Array<{
          name: string
          displayName?: string
          description?: string
          supportedGenerationMethods?: string[]
        }>
      }

      if (!data.models || !Array.isArray(data.models)) {
        console.warn('[Gemini] Unexpected models API response format')
        return GEMINI_DEFAULT_MODELS
      }

      // Filter and transform models - only include Gemini models that support content generation
      const models: AgentModelInfo[] = data.models
        .filter((model) => {
          const name = model.name.toLowerCase()
          // Only include gemini models that support generateContent
          return (
            name.includes('gemini') &&
            model.supportedGenerationMethods?.includes('generateContent') &&
            !name.includes('embedding') &&
            !name.includes('aqa') &&
            !name.includes('vision') // Vision-only models aren't suitable for code
          )
        })
        .map((model) => {
          // Extract model ID from full name (e.g., "models/gemini-2.5-pro" -> "gemini-2.5-pro")
          const id = model.name.replace('models/', '')
          const name = model.displayName || this.formatModelName(id)
          const description = model.description || this.getModelDescription(id)

          return { id, name, description }
        })

      // Group by tier and find the latest in each tier
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

      // Sort each tier group by version
      for (const tierModels of tierGroups.values()) {
        tierModels.sort((a, b) => {
          const versionA = this.extractVersion(a.id)
          const versionB = this.extractVersion(b.id)
          return this.compareVersions(versionB, versionA) // Descending
        })
      }

      // Sort the final list: by version (newer first), then by tier (pro > flash > flash-lite)
      const sorted = models.sort((a, b) => {
        // Version comparison first
        const versionA = this.extractVersion(a.id)
        const versionB = this.extractVersion(b.id)
        const versionCmp = this.compareVersions(versionB, versionA)
        if (versionCmp !== 0) return versionCmp

        // Then by tier
        const getModelRank = (id: string): number => {
          if (id.includes('pro')) return 3
          if (id.includes('flash-lite')) return 1
          if (id.includes('flash')) return 2
          return 0
        }
        return getModelRank(b.id) - getModelRank(a.id)
      })

      // Mark the latest flash as default (most popular for free tier)
      const latestFlash = tierGroups.get('flash')?.[0]
      if (latestFlash) {
        latestFlash.isDefault = true
      } else if (sorted.length > 0) {
        sorted[0].isDefault = true
      }

      // Cache the results
      this.cachedModels = sorted.length > 0 ? sorted : GEMINI_DEFAULT_MODELS
      this.modelsCacheTime = now

      logger.debug(`[Gemini] Fetched ${sorted.length} models from API`)
      return this.cachedModels
    } catch (error) {
      console.error('[Gemini] Failed to fetch models:', error)
      return GEMINI_DEFAULT_MODELS
    }
  }

  /**
   * Format a model ID into a display name
   */
  protected formatModelName(id: string): string {
    // e.g., "gemini-2.5-pro" -> "Gemini 2.5 Pro"
    return id
      .split('-')
      .map((part, index) => {
        if (index === 0) return part.charAt(0).toUpperCase() + part.slice(1)
        if (/^\d/.test(part)) return part // Keep version numbers as-is
        return part.charAt(0).toUpperCase() + part.slice(1)
      })
      .join(' ')
      .replace(/\s+(\d)/, ' $1') // Clean up spacing around numbers
  }

  /**
   * Get a description for a model based on its ID
   */
  protected getModelDescription(id: string): string {
    const lower = id.toLowerCase()
    if (lower.includes('2.5-pro') || lower.includes('2-5-pro')) {
      return 'Most capable Gemini model'
    }
    if (lower.includes('2.5-flash') || lower.includes('2-5-flash')) {
      return 'Fast and efficient'
    }
    if (lower.includes('2.0-flash-lite') || lower.includes('2-0-flash-lite')) {
      return 'Lightweight model'
    }
    if (lower.includes('2.0-flash') || lower.includes('2-0-flash')) {
      return 'Fast model'
    }
    if (lower.includes('1.5-pro') || lower.includes('1-5-pro')) {
      return 'Large context window (2M tokens)'
    }
    if (lower.includes('1.5-flash') || lower.includes('1-5-flash')) {
      return 'Fast with large context'
    }
    if (lower.includes('pro')) {
      return 'High capability model'
    }
    if (lower.includes('flash')) {
      return 'Fast and efficient model'
    }
    return 'Gemini model'
  }

  /**
   * Validate that authentication is currently valid
   * Makes a minimal API call to check if the API key is valid
   */
  async validateAuth(): Promise<{
    isValid: boolean
    requiresReauth: boolean
    error?: string
  }> {
    try {
      const apiKey = await this.getApiKey()
      if (!apiKey) {
        return {
          isValid: false,
          requiresReauth: true,
          error: 'No API key found. Please configure your Gemini API key.'
        }
      }

      // Make a minimal API call to validate the key (list models)
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.status === 401 || response.status === 403) {
        const errorText = await response.text()
        console.warn('[Gemini] Auth validation failed:', response.status, errorText)
        return {
          isValid: false,
          requiresReauth: true,
          error: `Authentication failed (${response.status}). Please check your API key.`
        }
      }

      if (!response.ok) {
        // Other errors (rate limit, server issues) - don't assume auth is invalid
        console.warn('[Gemini] Auth validation got non-OK response:', response.status)
        return {
          isValid: true,
          requiresReauth: false,
          error: `API returned ${response.status}, but auth may still be valid`
        }
      }

      return {
        isValid: true,
        requiresReauth: false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[Gemini] Auth validation error:', message)
      // Network errors don't necessarily mean auth is invalid
      return {
        isValid: true,
        requiresReauth: false,
        error: `Could not validate auth: ${message}`
      }
    }
  }

  /**
   * Detect authentication errors in agent output
   * Returns true if the output indicates an authentication failure
   */
  detectAuthError(output: string): boolean {
    const lower = output.toLowerCase()
    return (
      lower.includes('invalid api key') ||
      lower.includes('api_key_invalid') ||
      lower.includes('401') ||
      lower.includes('403') ||
      lower.includes('unauthorized') ||
      lower.includes('permission denied') ||
      lower.includes('access denied') ||
      lower.includes('authentication failed') ||
      lower.includes('invalid credentials') ||
      (lower.includes('api key') && (lower.includes('invalid') || lower.includes('expired') || lower.includes('missing'))) ||
      (lower.includes('authentication') && (lower.includes('failed') || lower.includes('error') || lower.includes('required')))
    )
  }

  /**
   * Trigger re-authentication flow
   * For Gemini, this means the user needs to update their API key in settings
   * Returns instructions for the user
   * @param _projectPath - Unused for API key-based authentication
   */
  async triggerReauth(_projectPath?: string): Promise<{ success: boolean; error?: string }> {
    // Gemini uses API keys, not OAuth - user must update in settings
    // We can't actually "re-authenticate" programmatically, just prompt user
    return {
      success: false,
      error: 'Please update your Gemini API key in Settings > Agents > Gemini. Get a new key at https://aistudio.google.com/apikey'
    }
  }

  /**
   * Get project config files for Gemini
   *
   * @returns Array of config file names to look for
   */
  getProjectConfigFiles(): string[] {
    return ['GEMINI.md', '.gemini/config.json', '.gemini/settings.json']
  }

  /**
   * Get Gemini capabilities
   *
   * @returns Object describing what features this adapter supports
   */
  getCapabilities(): AgentCapabilities {
    return {
      supportsSkills: false, // Gemini doesn't have a skills system like Claude Code
      supportsProjectConfig: true,
      supportsContextFiles: true,
      supportsNonInteractiveMode: true,
      supportsPauseResume: false
    }
  }

}

/**
 * Default Gemini adapter instance
 */
export const geminiAdapter = new GeminiAdapter()
