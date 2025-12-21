/**
 * OpenRouter Adapter
 *
 * Implements the AgentAdapter interface for OpenRouter API access.
 * OpenRouter provides access to multiple AI models (Claude, GPT-4, Gemini, etc.)
 * through a unified API.
 *
 * This adapter uses the Claude Code CLI with the @openrouter/cli proxy to
 * translate between OpenAI's API format (used by OpenRouter) and Anthropic's
 * format (used by Claude Code CLI).
 *
 * Requirements:
 * 1. Claude Code CLI installed
 * 2. @openrouter/cli installed (`npm install -g @openrouter/cli`)
 * 3. OpenRouter API key from https://openrouter.ai/keys
 */

import { exec, spawn, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
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
import { AGENT_IDS, OPENROUTER_DEFAULT_MODELS } from '@shared/types'
import { getAgentApiKey } from '@main/storage/secure-store'
import { BaseAgentAdapter } from './base-adapter'
import { quoteExecutablePath } from '@main/utils/paths'

/** OpenRouter API endpoints */
const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1'
const MODELS_API_URL = `${OPENROUTER_API_BASE}/models`

/** Cache duration for models list (24 hours in ms) */
const MODELS_CACHE_DURATION = 24 * 60 * 60 * 1000

/** Default port for the OpenRouter proxy (when using @openrouter/cli) */
const DEFAULT_PROXY_PORT = 4141

/**
 * Possible paths where Claude Code CLI might be installed
 */
const CLAUDE_CLI_PATHS = platform() === 'win32'
  ? [
      join(process.env.APPDATA || '', 'npm', 'claude.cmd'),
      join(process.env.APPDATA || '', 'npm', 'claude'),
      join(homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd'),
      join(homedir(), 'AppData', 'Roaming', 'npm', 'claude')
    ]
  : [
      '/usr/local/bin/claude',
      '/usr/bin/claude',
      '/opt/homebrew/bin/claude',
      join(homedir(), '.local/bin/claude'),
      join(homedir(), '.npm-global/bin/claude'),
      join(homedir(), '.nvm/versions/node/*/bin/claude')
    ]

/**
 * Possible paths where openrouter-cli might be installed
 */
const OPENROUTER_CLI_PATHS = platform() === 'win32'
  ? [
      join(process.env.APPDATA || '', 'npm', 'openrouter.cmd'),
      join(process.env.APPDATA || '', 'npm', 'openrouter'),
      join(homedir(), 'AppData', 'Roaming', 'npm', 'openrouter.cmd'),
      join(homedir(), 'AppData', 'Roaming', 'npm', 'openrouter')
    ]
  : [
      '/usr/local/bin/openrouter',
      '/usr/bin/openrouter',
      '/opt/homebrew/bin/openrouter',
      join(homedir(), '.local/bin/openrouter'),
      join(homedir(), '.npm-global/bin/openrouter'),
      join(homedir(), '.nvm/versions/node/*/bin/openrouter')
    ]

/**
 * Wrap a ChildProcess as an AgentProcess
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
            logger.debug(`[OpenRouter] wait() resolved via 'exit' event, code=${code}, pid=${child.pid}`)
            resolve({ exitCode: code ?? 1 })
          }
        })
        child.on('error', (err) => {
          if (!resolved) {
            resolved = true
            logger.debug(
              `[OpenRouter] wait() resolved via 'error' event, error=${err.message}, pid=${child.pid}`
            )
            resolve({ exitCode: 1 })
          }
        })
      })
    }
  }
}

/**
 * OpenRouter Adapter implementation
 *
 * Uses Claude Code CLI with the OpenRouter proxy to access various AI models.
 */
export class OpenRouterAdapter extends BaseAgentAdapter {
  readonly id = AGENT_IDS.OPENROUTER
  readonly name = 'OpenRouter'

  protected readonly possiblePaths = CLAUDE_CLI_PATHS
  protected readonly cliCommand = 'claude'
  protected readonly defaultModels = OPENROUTER_DEFAULT_MODELS

  private customPath: string | null = null
  private cachedClaudePath: string | null = null
  private cachedOpenRouterCliPath: string | null = null
  private cachedApiKey: string | null = null

  /**
   * Set a custom executable path for this agent (Claude CLI)
   * This overrides auto-detection
   */
  setCustomPath(path: string | null): void {
    this.customPath = path
    // Clear cached path to force re-detection if custom path is cleared
    if (!path) {
      this.cachedClaudePath = null
    }
    logger.debug('[OpenRouter] Custom Claude CLI path set to:', path || '(auto-detect)')
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
        error: 'Could not find Claude CLI executable. Please install Claude Code CLI.'
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
        const versionMatch = output.match(/(\d+\.\d+\.\d+(?:-[a-z0-9.]+)?)/i)
        const version = versionMatch ? versionMatch[1] : output
        logger.debug('[OpenRouter] CLI test successful, version:', version)
        return { success: true, version }
      }

      return { success: true, version: 'unknown' }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[OpenRouter] CLI test failed:', message)
      return {
        success: false,
        error: `Failed to run CLI: ${message}`
      }
    }
  }

  /**
   * Check if OpenRouter adapter is available
   * Requires both Claude CLI and OpenRouter CLI to be installed, plus an API key
   */
  async isAvailable(): Promise<boolean> {
    const claudePath = await this.getClaudeCliPath()
    if (!claudePath) {
      logger.debug('[OpenRouter] Not available: Claude CLI not found')
      return false
    }

    const openrouterPath = await this.getOpenRouterCliPath()
    if (!openrouterPath) {
      logger.debug('[OpenRouter] Not available: OpenRouter CLI not found')
      return false
    }

    // Verify both CLIs work
    // Use shell: true on all platforms for proper executable resolution
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: any = { encoding: 'utf8', timeout: 10000, shell: true }

    try {
      await execAsync(`"${claudePath}" --version`, options)
      await execAsync(`"${openrouterPath}" --version`, options)
      return true
    } catch (error) {
      console.warn('[OpenRouter] CLI verification failed:', error)
      return false
    }
  }

  /**
   * Get the path to Claude CLI (used by the OpenRouter proxy)
   * This is the "executable" from the adapter's perspective
   */
  async getExecutablePath(): Promise<string | null> {
    return this.getClaudeCliPath()
  }

  /**
   * Find the Claude Code CLI executable path
   */
  private async getClaudeCliPath(): Promise<string | null> {
    // If custom path is set, use it directly
    if (this.customPath) {
      logger.debug('[OpenRouter] Using custom Claude CLI path:', this.customPath)
      return this.customPath
    }

    if (this.cachedClaudePath) return this.cachedClaudePath

    const isWindows = platform() === 'win32'

    // First check if 'claude' is in PATH
    try {
      const shellCmd = isWindows ? 'where claude' : 'which claude'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pathOptions: any = { encoding: 'utf8', timeout: 5000 }
      if (isWindows) pathOptions.shell = true
      const result = await execAsync(shellCmd, pathOptions)
      const stdout = String(result.stdout)
      const path = stdout.trim().split('\n')[0].trim()
      if (path && existsSync(path)) {
        logger.debug('[OpenRouter] Found claude via PATH:', path)
        this.cachedClaudePath = path
        return path
      }
    } catch {
      // Not in PATH, check known locations
    }

    // Check known installation paths
    for (const path of CLAUDE_CLI_PATHS) {
      // Skip empty paths
      if (!path || path.includes('undefined')) continue

      if (path.includes('*')) {
        try {
          const { glob } = await import('glob')
          const matches = await glob(path.replace(/\\/g, '/'))
          if (matches.length > 0 && existsSync(matches[0])) {
            logger.debug('[OpenRouter] Found claude via glob:', matches[0])
            this.cachedClaudePath = matches[0]
            return matches[0]
          }
        } catch {
          // glob not available or no matches
        }
      } else if (existsSync(path)) {
        logger.debug('[OpenRouter] Found claude at known path:', path)
        this.cachedClaudePath = path
        return path
      }
    }

    logger.debug('[OpenRouter] Could not find Claude CLI')
    return null
  }

  /**
   * Find the OpenRouter CLI executable path
   */
  private async getOpenRouterCliPath(): Promise<string | null> {
    if (this.cachedOpenRouterCliPath) return this.cachedOpenRouterCliPath

    const isWindows = platform() === 'win32'

    // First check if 'openrouter' is in PATH
    try {
      const shellCmd = isWindows ? 'where openrouter' : 'which openrouter'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pathOptions: any = { encoding: 'utf8', timeout: 5000 }
      if (isWindows) pathOptions.shell = true
      const result = await execAsync(shellCmd, pathOptions)
      const stdout = String(result.stdout)
      const path = stdout.trim().split('\n')[0].trim()
      if (path && existsSync(path)) {
        this.cachedOpenRouterCliPath = path
        return path
      }
    } catch {
      // Not in PATH, check known locations
    }

    // Check known installation paths
    for (const path of OPENROUTER_CLI_PATHS) {
      if (path.includes('*')) {
        try {
          const { glob } = await import('glob')
          const matches = await glob(path)
          if (matches.length > 0 && existsSync(matches[0])) {
            this.cachedOpenRouterCliPath = matches[0]
            return matches[0]
          }
        } catch {
          // glob not available or no matches
        }
      } else if (existsSync(path)) {
        this.cachedOpenRouterCliPath = path
        return path
      }
    }

    return null
  }

  /**
   * Invoke the agent with a prompt
   *
   * Uses Claude CLI with environment variables pointing to the OpenRouter proxy
   */
  invoke(options: AgentInvokeOptions & { apiKey?: string }): AgentProcess {
    const execPath = this.cachedClaudePath
    if (!execPath) {
      throw new Error('Claude CLI not found. Ensure getExecutablePath() is called before invoke().')
    }

    // Get API key from options or fall back to cached
    const apiKey = options.apiKey || this.cachedApiKey
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured. Please add your API key in settings.')
    }

    const args: string[] = [
      '-p', // Non-interactive mode
      '--verbose',
      '--output-format', 'stream-json',
      '--dangerously-skip-permissions'
    ]

    // Add model selection if specified
    // OpenRouter models use format: provider/model (e.g., anthropic/claude-sonnet-4)
    const model = options.agentOptions?.model as string | undefined
    if (model) {
      args.push('--model', model)
      logger.debug('[OpenRouter] Using model:', model)
    }

    // Add context files as allowed directories if provided
    if (options.contextFiles && options.contextFiles.length > 0) {
      for (const file of options.contextFiles) {
        args.push('--add-dir', file)
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

    logger.debug('[OpenRouter] Invoking with args:', args.join(' '))
    logger.debug('[OpenRouter] Working directory:', options.workingDirectory)
    logger.debug('[OpenRouter] Executable path:', execPath)
    if (isWindows) {
      logger.debug('[OpenRouter] Prompt will be passed via stdin (Windows mode)')
    }

    // Quote the executable path if using shell mode (handles spaces in path)
    const spawnPath = isWindows ? quoteExecutablePath(execPath) : execPath

    // Spawn the process with OpenRouter proxy environment
    const child = spawn(spawnPath, args, {
      cwd: options.workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: isWindows,
      env: {
        ...process.env,
        CI: 'true',
        TERM: 'dumb',
        // Configure Claude CLI to use OpenRouter proxy (user must run `openrouter` CLI separately)
        ANTHROPIC_BASE_URL: `http://localhost:${DEFAULT_PROXY_PORT}/api/v1`,
        OPENROUTER_API_KEY: apiKey
      }
    })

    logger.debug('[OpenRouter] Process spawned with PID:', child.pid)

    // On Windows, write the prompt to stdin then close it
    // On non-Windows, just close stdin immediately
    if (child.stdin) {
      if (isWindows) {
        child.stdin.write(options.prompt)
        child.stdin.end()
        logger.debug('[OpenRouter] Prompt written to stdin and closed (Windows mode)')
      } else {
        child.stdin.end()
        logger.debug('[OpenRouter] stdin closed')
      }
    }

    // Log process events for debugging
    child.on('spawn', () => {
      logger.debug('[OpenRouter] Process spawn event fired, PID:', child.pid)
    })

    child.on('error', (err) => {
      console.error('[OpenRouter] Process error:', err.message)
    })

    child.on('exit', (code, signal) => {
      logger.debug('[OpenRouter] Process exited with code:', code, 'signal:', signal)
    })

    child.on('close', (code, signal) => {
      logger.debug('[OpenRouter] Process closed with code:', code, 'signal:', signal)
    })

    // Log stdout/stderr data for debugging
    child.stdout?.on('data', (chunk) => {
      logger.debug('[OpenRouter] stdout chunk received, size:', chunk.length)
    })

    child.stderr?.on('data', (chunk) => {
      logger.debug('[OpenRouter] stderr chunk received, size:', chunk.length)
    })

    return wrapChildProcess(child)
  }

  /**
   * Parse output stream for events
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
   */
  protected parseLine(line: string): AgentOutputEvent | null {
    const timestamp = new Date()

    // Try to parse as JSON (Claude Code outputs JSON-lines)
    try {
      const json = JSON.parse(line)

      if (json.type === 'error') {
        const errorMessage = json.error || json.message || line

        // Check for usage/rate limits
        const usageLimitResult = this.detectUsageLimit(errorMessage)
        if (usageLimitResult.isUsageLimit) {
          return {
            type: 'usage-limit',
            message: line,
            timestamp,
            resetAt: usageLimitResult.resetAt
          }
        }

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
      } else if (json.type === 'result') {
        return {
          type: 'complete',
          message: line,
          timestamp
        }
      }

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
   */
  detectRateLimit(output: string): boolean {
    const lower = output.toLowerCase()
    return (
      lower.includes('rate limit') ||
      lower.includes('rate_limit') ||
      lower.includes('429') ||
      lower.includes('too many requests') ||
      lower.includes('overloaded') ||
      lower.includes('requests per minute')
    )
  }

  /**
   * Detect usage limit errors (credit/quota exhaustion)
   */
  detectUsageLimit(output: string): { isUsageLimit: boolean; resetAt?: Date } {
    const lower = output.toLowerCase()

    const isUsageLimit =
      lower.includes('usage limit') ||
      lower.includes('quota exceeded') ||
      lower.includes('insufficient credits') ||
      lower.includes('out of credits') ||
      lower.includes('credit balance') ||
      lower.includes('billing') ||
      lower.includes('payment required') ||
      lower.includes('402') ||
      lower.includes('exceeded your')

    if (!isUsageLimit) {
      return { isUsageLimit: false }
    }

    // Try to extract reset time
    let resetAt: Date | undefined

    // Pattern: "try again in X hours/minutes"
    const durationMatch = output.match(
      /(?:reset|available|try again)\s+in\s+(\d+)\s*(hour|minute|min|hr|h|m)s?/i
    )
    if (durationMatch) {
      const amount = parseInt(durationMatch[1], 10)
      const unit = durationMatch[2].toLowerCase()
      resetAt = new Date()
      if (unit.startsWith('h')) {
        resetAt.setHours(resetAt.getHours() + amount)
      } else {
        resetAt.setMinutes(resetAt.getMinutes() + amount)
      }
    }

    return { isUsageLimit: true, resetAt }
  }

  /**
   * Check if we can proceed with requests
   * For OpenRouter, this checks if we have credits available
   */
  async checkUsageLimits(): Promise<{ canProceed: boolean; resetAt?: Date; message?: string }> {
    const apiKey = await this.getApiKey()
    if (!apiKey) {
      return { canProceed: false, message: 'OpenRouter API key not configured' }
    }

    // Check credit balance via OpenRouter API
    try {
      const response = await fetch(`${OPENROUTER_API_BASE}/auth/key`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return { canProceed: false, message: 'Invalid OpenRouter API key' }
        }
        // Other errors - allow proceeding, actual request will handle errors
        return { canProceed: true }
      }

      const data = (await response.json()) as {
        data?: {
          limit?: number
          usage?: number
          limit_remaining?: number
        }
      }

      if (data.data?.limit_remaining !== undefined && data.data.limit_remaining <= 0) {
        return {
          canProceed: false,
          message: 'OpenRouter credit limit reached. Please add credits at https://openrouter.ai/credits'
        }
      }

      return { canProceed: true }
    } catch (error) {
      console.warn('[OpenRouter] Failed to check usage limits:', error)
      // On network errors, allow proceeding - actual request will handle errors
      return { canProceed: true }
    }
  }

  /**
   * Get current usage percentage
   * Returns credit usage from OpenRouter API
   */
  async getUsagePercentage(): Promise<{
    fiveHour: { utilization: number; resetsAt: string } | null
    sevenDay: { utilization: number; resetsAt: string } | null
    error: string | null
  }> {
    const apiKey = await this.getApiKey()
    if (!apiKey) {
      return {
        fiveHour: null,
        sevenDay: null,
        error: 'OpenRouter API key not configured'
      }
    }

    try {
      const response = await fetch(`${OPENROUTER_API_BASE}/auth/key`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        return {
          fiveHour: null,
          sevenDay: null,
          error: `API returned ${response.status}`
        }
      }

      const data = (await response.json()) as {
        data?: {
          limit?: number
          usage?: number
          limit_remaining?: number
        }
      }

      // OpenRouter uses credit-based billing, not time-based limits
      // We'll show usage as a percentage of the limit
      if (data.data?.limit && data.data?.usage !== undefined) {
        const utilization = (data.data.usage / data.data.limit) * 100

        return {
          // Use fiveHour to show credit usage (arbitrary mapping)
          fiveHour: {
            utilization,
            resetsAt: 'N/A (credit-based)'
          },
          sevenDay: null,
          error: null
        }
      }

      return {
        fiveHour: null,
        sevenDay: null,
        error: null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        fiveHour: null,
        sevenDay: null,
        error: message
      }
    }
  }

  /**
   * Load and cache the API key
   */
  async loadApiKey(): Promise<string | null> {
    const key = await this.getApiKey()
    this.cachedApiKey = key
    return key
  }

  /**
   * Get the OpenRouter API key
   */
  private async getApiKey(): Promise<string | null> {
    // 1. Check Nightshift secure storage first
    try {
      const secureKey = await getAgentApiKey(AGENT_IDS.OPENROUTER)
      if (secureKey) {
        return secureKey
      }
    } catch (error) {
      console.warn('[OpenRouter] Failed to read from secure storage:', error)
    }

    // 2. Check environment variable
    if (process.env.OPENROUTER_API_KEY) {
      return process.env.OPENROUTER_API_KEY
    }

    return null
  }

  /**
   * Validate that authentication is valid
   */
  async validateAuth(): Promise<{
    isValid: boolean
    requiresReauth: boolean
    error?: string
  }> {
    const apiKey = await this.getApiKey()
    if (!apiKey) {
      return {
        isValid: false,
        requiresReauth: true,
        error: 'No OpenRouter API key found. Please add your API key in settings.'
      }
    }

    try {
      const response = await fetch(`${OPENROUTER_API_BASE}/auth/key`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.status === 401 || response.status === 403) {
        return {
          isValid: false,
          requiresReauth: true,
          error: 'Invalid OpenRouter API key. Please check your API key at https://openrouter.ai/keys'
        }
      }

      if (!response.ok) {
        return {
          isValid: true,
          requiresReauth: false,
          error: `API returned ${response.status}, but key may still be valid`
        }
      }

      return {
        isValid: true,
        requiresReauth: false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      // Network errors don't necessarily mean auth is invalid
      return {
        isValid: true,
        requiresReauth: false,
        error: `Could not validate auth: ${message}`
      }
    }
  }

  /**
   * Detect authentication errors in output
   */
  detectAuthError(output: string): boolean {
    const lower = output.toLowerCase()
    return (
      lower.includes('invalid api key') ||
      lower.includes('api_key_invalid') ||
      lower.includes('401') ||
      lower.includes('403') ||
      lower.includes('unauthorized') ||
      lower.includes('authentication failed') ||
      lower.includes('invalid credentials') ||
      (lower.includes('api key') && (lower.includes('invalid') || lower.includes('expired')))
    )
  }

  /**
   * Trigger re-authentication flow
   * For OpenRouter, this means the user needs to update their API key in settings
   * Returns instructions for the user
   * @param _projectPath - Unused for API key-based authentication
   */
  async triggerReauth(_projectPath?: string): Promise<{ success: boolean; error?: string }> {
    // OpenRouter uses API keys, not OAuth - user must update in settings
    return {
      success: false,
      error: 'Please update your OpenRouter API key in Settings > Agents > OpenRouter. Get a new key at https://openrouter.ai/keys'
    }
  }

  /**
   * Fetch available models from OpenRouter API
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
        console.warn('[OpenRouter] No API key available, using default models')
        return OPENROUTER_DEFAULT_MODELS
      }

      const response = await fetch(MODELS_API_URL, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        console.warn('[OpenRouter] Models API error:', response.status)
        return OPENROUTER_DEFAULT_MODELS
      }

      const data = (await response.json()) as {
        data?: Array<{
          id: string
          name?: string
          description?: string
          context_length?: number
          pricing?: {
            prompt?: string
            completion?: string
          }
        }>
      }

      if (!data.data || !Array.isArray(data.data)) {
        console.warn('[OpenRouter] Unexpected models API response format')
        return OPENROUTER_DEFAULT_MODELS
      }

      // Filter and transform models - prioritize popular coding models
      const models: AgentModelInfo[] = data.data
        .filter((model) => {
          const id = model.id.toLowerCase()
          // Include models known to be good for coding
          return (
            id.includes('claude') ||
            id.includes('gpt-4') ||
            id.includes('gemini') ||
            id.includes('llama') ||
            id.includes('deepseek') ||
            id.includes('mistral') ||
            id.includes('codestral')
          )
        })
        .map((model) => {
          return {
            id: model.id,
            name: model.name || this.formatModelName(model.id),
            description: model.description || this.getModelDescription(model.id)
          }
        })

      // Group by provider and tier
      const providerTierGroups = new Map<string, Map<string, AgentModelInfo[]>>()

      for (const model of models) {
        const provider = model.id.split('/')[0]
        const tier = this.extractTier(model.id)

        if (!providerTierGroups.has(provider)) {
          providerTierGroups.set(provider, new Map())
        }

        const tierGroups = providerTierGroups.get(provider)!
        if (tier) {
          if (!tierGroups.has(tier)) {
            tierGroups.set(tier, [])
          }
          tierGroups.get(tier)!.push(model)
        }
      }

      // Sort each tier group by version
      for (const tierGroups of providerTierGroups.values()) {
        for (const tierModels of tierGroups.values()) {
          tierModels.sort((a, b) => {
            const versionA = this.extractVersion(a.id)
            const versionB = this.extractVersion(b.id)
            return this.compareVersions(versionB, versionA) // Descending
          })
        }
      }

      // Sort the final list: by provider preference, then by tier, then by version
      const sorted = models.sort((a, b) => {
        // Provider preference first
        const getProviderRank = (id: string): number => {
          if (id.startsWith('anthropic/')) return 5
          if (id.startsWith('openai/')) return 4
          if (id.startsWith('google/')) return 3
          if (id.startsWith('meta-llama/')) return 2
          return 1
        }
        const providerCmp = getProviderRank(b.id) - getProviderRank(a.id)
        if (providerCmp !== 0) return providerCmp

        // Then by tier (for same provider)
        const getTierRank = (id: string): number => {
          if (id.includes('opus')) return 5
          if (id.includes('sonnet')) return 4
          if (id.includes('haiku')) return 3
          if (id.includes('pro')) return 3
          if (id.includes('flash')) return 2
          return 1
        }
        const tierCmp = getTierRank(b.id) - getTierRank(a.id)
        if (tierCmp !== 0) return tierCmp

        // Finally by version
        const versionA = this.extractVersion(a.id)
        const versionB = this.extractVersion(b.id)
        return this.compareVersions(versionB, versionA)
      })

      // Mark the latest anthropic/claude-sonnet as default
      const latestClaudeSonnet = providerTierGroups.get('anthropic')?.get('sonnet')?.[0]
      if (latestClaudeSonnet) {
        latestClaudeSonnet.isDefault = true
      } else if (sorted.length > 0) {
        sorted[0].isDefault = true
      }

      // Cache the results
      const finalModels = sorted.length > 0 ? sorted : OPENROUTER_DEFAULT_MODELS
      this.cachedModels = finalModels
      this.modelsCacheTime = now

      logger.debug(`[OpenRouter] Fetched ${sorted.length} models from API`)
      return finalModels
    } catch (error) {
      console.error('[OpenRouter] Failed to fetch models:', error)
      return OPENROUTER_DEFAULT_MODELS
    }
  }

  /**
   * Format a model ID into a display name
   */
  protected formatModelName(id: string): string {
    // e.g., "anthropic/claude-sonnet-4" -> "Claude Sonnet 4"
    // Remove provider prefix
    const modelPart = id.includes('/') ? id.split('/')[1] : id

    return modelPart
      .split('-')
      .map((part) => {
        if (/^\d/.test(part)) return part // Keep version numbers as-is
        return part.charAt(0).toUpperCase() + part.slice(1)
      })
      .join(' ')
  }

  /**
   * Get a description for a model based on its ID
   */
  protected getModelDescription(id: string): string {
    const lower = id.toLowerCase()
    if (lower.includes('claude')) {
      if (lower.includes('opus')) return "Anthropic's most capable model"
      if (lower.includes('sonnet')) return "Anthropic's balanced model"
      if (lower.includes('haiku')) return "Anthropic's fastest model"
    }
    if (lower.includes('gpt-4o')) return "OpenAI's flagship model"
    if (lower.includes('gpt-4')) return 'OpenAI GPT-4'
    if (lower.includes('gemini')) {
      if (lower.includes('pro')) return "Google's most capable model"
      if (lower.includes('flash')) return "Google's fast model"
    }
    if (lower.includes('llama')) return "Meta's open-weight model"
    if (lower.includes('deepseek')) return 'DeepSeek model'
    if (lower.includes('mistral')) return 'Mistral AI model'
    return 'AI model via OpenRouter'
  }

  /**
   * Get project config files
   * OpenRouter doesn't have its own config file format
   */
  getProjectConfigFiles(): string[] {
    // Inherit Claude Code's config files since we use Claude CLI
    return ['CLAUDE.md', '.claude/settings.json', '.claude/commands']
  }

  /**
   * Get adapter capabilities
   */
  getCapabilities(): AgentCapabilities {
    return {
      supportsSkills: true, // Inherits from Claude Code CLI
      supportsProjectConfig: true,
      supportsContextFiles: true,
      supportsNonInteractiveMode: true,
      supportsPauseResume: false
    }
  }

}

/**
 * Default OpenRouter adapter instance
 */
export const openrouterAdapter = new OpenRouterAdapter()
