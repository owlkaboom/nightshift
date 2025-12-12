/**
 * Claude Code CLI Adapter
 *
 * Implements the AgentAdapter interface for Claude Code CLI.
 */

import type {
  AgentCapabilities,
  AgentChatEvent,
  AgentChatOptions,
  AgentInvokeOptions,
  AgentModelInfo,
  AgentOutputEvent,
  AgentProcess
} from '@shared/types'
import { AGENT_IDS, CLAUDE_CODE_MODELS } from '@shared/types'
import { exec, spawn, type ChildProcess } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { homedir, platform } from 'os'
import { launchInTerminal } from '../../utils/terminal'
import { join } from 'path'
import { promisify } from 'util'
import { BaseAgentAdapter } from './base-adapter'
import { quoteExecutablePath } from '../../utils/paths'

const execAsync = promisify(exec)

/** API endpoint for usage data */
const USAGE_API_URL = 'https://api.anthropic.com/api/oauth/usage'

/** API endpoint for models list */
const MODELS_API_URL = 'https://api.anthropic.com/v1/models'

/** Cache duration for models list (24 hours in ms) */
const MODELS_CACHE_DURATION = 24 * 60 * 60 * 1000

/** User agent to use for API requests */
const USER_AGENT = 'claude-code/2.0.32'

/** Beta header required for OAuth API */
const ANTHROPIC_BETA = 'oauth-2025-04-20'

/**
 * Possible paths where Claude Code CLI might be installed
 */
const POSSIBLE_PATHS = platform() === 'win32'
  ? [
      // npm global install on Windows
      join(process.env.APPDATA || '', 'npm', 'claude.cmd'),
      join(process.env.APPDATA || '', 'npm', 'claude'),
      // npm prefix on Windows
      join(process.env.PROGRAMFILES || '', 'nodejs', 'claude.cmd'),
      join(process.env.PROGRAMFILES || '', 'nodejs', 'claude'),
      // Local AppData npm
      join(process.env.LOCALAPPDATA || '', 'npm', 'claude.cmd'),
      join(process.env.LOCALAPPDATA || '', 'npm', 'claude'),
      // User profile npm
      join(homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd'),
      join(homedir(), 'AppData', 'Roaming', 'npm', 'claude'),
      // nvm-windows
      join(process.env.NVM_HOME || join(homedir(), 'AppData', 'Roaming', 'nvm'), '*/claude.cmd'),
      // Scoop
      join(homedir(), 'scoop', 'shims', 'claude.cmd'),
      // Chocolatey
      join(process.env.ChocolateyInstall || 'C:\\ProgramData\\chocolatey', 'bin', 'claude.cmd')
    ]
  : [
      // npm global install (Unix)
      '/usr/local/bin/claude',
      '/usr/bin/claude',
      // homebrew (Apple Silicon)
      '/opt/homebrew/bin/claude',
      // homebrew (Intel)
      '/usr/local/Homebrew/bin/claude',
      // user local
      join(homedir(), '.local/bin/claude'),
      // npm global prefix
      join(homedir(), '.npm-global/bin/claude'),
      // npm packages
      join(homedir(), '.npm/bin/claude'),
      // yarn global
      join(homedir(), '.yarn/bin/claude'),
      // pnpm global
      join(homedir(), '.pnpm/bin/claude'),
      join(homedir(), '.local/share/pnpm/claude'),
      // nvm (try multiple node versions, sorted descending)
      join(homedir(), '.nvm/versions/node/*/bin/claude'),
      // volta
      join(homedir(), '.volta/bin/claude'),
      // fnm (Fast Node Manager)
      join(homedir(), '.fnm/node-versions/*/installation/bin/claude'),
      // asdf
      join(homedir(), '.asdf/installs/nodejs/*/bin/claude')
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
            console.log(`[ClaudeCode] wait() resolved via 'exit' event, code=${code}, pid=${child.pid}`)
            resolve({ exitCode: code ?? 1 })
          }
        })
        child.on('error', (err) => {
          if (!resolved) {
            resolved = true
            console.log(`[ClaudeCode] wait() resolved via 'error' event, error=${err.message}, pid=${child.pid}`)
            resolve({ exitCode: 1 })
          }
        })
      })
    }
  }
}

/**
 * Claude Code CLI Adapter implementation
 */
export class ClaudeCodeAdapter extends BaseAgentAdapter {
  readonly id = AGENT_IDS.CLAUDE_CODE
  readonly name = 'Claude Code'

  protected readonly possiblePaths = POSSIBLE_PATHS
  protected readonly cliCommand = 'claude'
  protected readonly defaultModels = CLAUDE_CODE_MODELS

  private customPath: string | null = null

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
    console.log('[ClaudeCode] Custom path set to:', path || '(auto-detect)')
  }

  /**
   * Build spawn environment with enhanced PATH
   * Ensures node binary is in PATH when Claude CLI is a node script
   */
  private buildSpawnEnv(execPath: string): NodeJS.ProcessEnv {
    const env = { ...process.env }

    // Extract the directory containing the claude executable
    const { dirname } = require('path')
    const claudeBinDir = dirname(execPath)

    // If claude is in an nvm directory, ensure node is also in PATH
    // Example: /Users/user/.nvm/versions/node/v22.14.0/bin/claude
    // We need: /Users/user/.nvm/versions/node/v22.14.0/bin in PATH
    if (claudeBinDir.includes('.nvm') ||
        claudeBinDir.includes('.fnm') ||
        claudeBinDir.includes('.volta') ||
        claudeBinDir.includes('nvm')) {
      // Add the bin directory to the front of PATH
      const existingPath = env.PATH || env.Path || ''
      const pathSeparator = platform() === 'win32' ? ';' : ':'

      // Only add if not already in PATH
      if (!existingPath.split(pathSeparator).includes(claudeBinDir)) {
        env.PATH = `${claudeBinDir}${pathSeparator}${existingPath}`
        console.log('[ClaudeCode] Enhanced PATH with node bin directory:', claudeBinDir)
      }
    }

    // Ensure non-interactive mode
    env.CI = 'true'
    env.TERM = 'dumb'

    return env
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
        error: 'Could not find Claude CLI executable. Please set a custom path or install Claude Code.'
      }
    }

    try {
      // Build environment with enhanced PATH
      const spawnEnv = this.buildSpawnEnv(execPath)

      // On all platforms, use shell for proper executable resolution
      // This handles .cmd files on Windows and script shebangs on Unix
      const cmd = `"${execPath}" --version`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options: any = { encoding: 'utf8', timeout: 10000, shell: true, env: spawnEnv }
      const result = await execAsync(cmd, options)
      const stdout = String(result.stdout)
      const stderr = String(result.stderr)

      const output = stdout.trim() || stderr.trim()
      if (output) {
        // Extract version from output like "claude-code 2.0.32" or just "2.0.32"
        const versionMatch = output.match(/(\d+\.\d+\.\d+(?:-[a-z0-9.]+)?)/i)
        const version = versionMatch ? versionMatch[1] : output
        console.log('[ClaudeCode] CLI test successful, version:', version)
        return { success: true, version }
      }

      return { success: true, version: 'unknown' }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[ClaudeCode] CLI test failed:', message)
      return {
        success: false,
        error: `Failed to run CLI: ${message}`
      }
    }
  }

  /**
   * Check if Claude Code CLI is available
   */
  async isAvailable(): Promise<boolean> {
    const path = await this.getExecutablePath()
    if (!path) return false

    try {
      // Build environment with enhanced PATH
      const spawnEnv = this.buildSpawnEnv(path)

      // Try to run --version to verify it works (non-blocking)
      // Use shell: true on all platforms for proper executable resolution
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options: any = { encoding: 'utf8', timeout: 10000, shell: true, env: spawnEnv }
      await execAsync(`"${path}" --version`, options)
      return true
    } catch {
      return false
    }
  }

  /**
   * Find the Claude Code executable (async to avoid blocking main thread)
   */
  async getExecutablePath(): Promise<string | null> {
    // If custom path is set, use it directly and cache it for invoke()
    if (this.customPath) {
      console.log('[ClaudeCode] Using custom path:', this.customPath)
      this.cachedPath = this.customPath
      return this.customPath
    }

    if (this.cachedPath) return this.cachedPath

    const isWindows = platform() === 'win32'
    const isMac = platform() === 'darwin'

    // First check if 'claude' is in PATH using a login shell to get full environment
    // This is critical for GUI-launched apps that don't inherit the user's shell PATH
    try {
      if (isWindows) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await execAsync('where claude', { encoding: 'utf8', timeout: 5000, shell: true } as any)
        const stdout = String(result.stdout)
        const path = stdout.trim().split('\n')[0].trim()
        if (path && existsSync(path)) {
          console.log('[ClaudeCode] Found claude via where command:', path)
          this.cachedPath = path
          return path
        }
      } else {
        // On Mac/Linux, try multiple shell strategies to find the executable
        // This is necessary because GUI apps don't inherit shell PATH

        // Strategy 1: Try direct which (works if in system PATH)
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await execAsync('which claude', { encoding: 'utf8', timeout: 3000 } as any)
          const path = String(result.stdout).trim()
          if (path && existsSync(path)) {
            console.log('[ClaudeCode] Found claude via which:', path)
            this.cachedPath = path
            return path
          }
        } catch {
          console.log('[ClaudeCode] which command failed, trying login shell')
        }

        // Strategy 2: Try bash login shell (loads ~/.bash_profile, ~/.bashrc)
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await execAsync('bash -l -c "which claude"', { encoding: 'utf8', timeout: 5000 } as any)
          const path = String(result.stdout).trim()
          if (path && existsSync(path)) {
            console.log('[ClaudeCode] Found claude via bash login shell:', path)
            this.cachedPath = path
            return path
          }
        } catch {
          console.log('[ClaudeCode] bash login shell failed, trying zsh')
        }

        // Strategy 3: Try zsh login shell (loads ~/.zshrc, ~/.zprofile) - common on modern macOS
        if (isMac) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await execAsync('zsh -l -c "which claude"', { encoding: 'utf8', timeout: 5000 } as any)
            const path = String(result.stdout).trim()
            if (path && existsSync(path)) {
              console.log('[ClaudeCode] Found claude via zsh login shell:', path)
              this.cachedPath = path
              return path
            }
          } catch {
            console.log('[ClaudeCode] zsh login shell failed, checking known locations')
          }
        }
      }
    } catch (error) {
      console.log('[ClaudeCode] Could not find claude in PATH, checking known locations')
    }

    // Check known installation paths
    for (const path of POSSIBLE_PATHS) {
      // Skip empty paths (can happen if env vars are undefined)
      if (!path || path.includes('undefined')) continue

      // Handle glob-like patterns (for nvm)
      if (path.includes('*')) {
        try {
          const { glob } = await import('glob')
          const matches = await glob(path.replace(/\\/g, '/'), { nodir: true }) // glob needs forward slashes
          // Sort by version number (descending) to get latest version
          const sortedMatches = matches.sort((a, b) => b.localeCompare(a))
          if (sortedMatches.length > 0 && existsSync(sortedMatches[0])) {
            console.log('[ClaudeCode] Found claude via glob pattern:', sortedMatches[0])
            this.cachedPath = sortedMatches[0]
            return sortedMatches[0]
          }
        } catch (err) {
          console.log('[ClaudeCode] glob pattern failed:', path, err)
        }
      } else if (existsSync(path)) {
        console.log('[ClaudeCode] Found claude at known path:', path)
        this.cachedPath = path
        return path
      }
    }

    console.log('[ClaudeCode] Could not find claude executable')
    return null
  }

  /**
   * Invoke Claude Code with a prompt
   * Note: This method is sync but getExecutablePath is cached after first async call,
   * so we use a sync wrapper that throws if path not yet resolved.
   */
  invoke(options: AgentInvokeOptions): AgentProcess {
    // Use cached path - callers should ensure getExecutablePath() was called first
    const execPath = this.cachedPath
    if (!execPath) {
      throw new Error('Claude Code CLI not found. Ensure getExecutablePath() is called before invoke().')
    }

    const args: string[] = [
      '-p', // Non-interactive mode, output to stdout (print mode)
      '--verbose', // Enable verbose output (required for stream-json)
      '--output-format', 'stream-json', // Get structured JSON output for parsing
      '--dangerously-skip-permissions' // Bypass permission checks for automation
    ]

    // Add model selection if specified in options
    const model = options.agentOptions?.model as string | undefined
    if (model) {
      args.push('--model', model)
      console.log('[ClaudeCode] Using model:', model)
    }

    // Add thinking mode if enabled (extended thinking for complex reasoning)
    const thinkingMode = options.agentOptions?.thinkingMode as boolean | undefined
    if (thinkingMode) {
      args.push('--thinking')
      console.log('[ClaudeCode] Thinking mode enabled')
    }

    // Add context files as allowed directories if provided
    if (options.contextFiles && options.contextFiles.length > 0) {
      for (const file of options.contextFiles) {
        args.push('--add-dir', file)
      }
    }

    // On Windows, always use shell: true for proper executable resolution
    // This handles .cmd, .bat, .exe, and PATH-resolved executables
    const isWindows = platform() === 'win32'

    // On Windows with shell: true, multi-line prompts with empty lines get truncated
    // because the shell interprets empty lines as command separators.
    // Solution: Pass prompt via stdin on Windows instead of as a command-line argument.
    // On non-Windows, we can safely pass the prompt as an argument.
    if (!isWindows) {
      args.push(options.prompt)
    }

    console.log('[ClaudeCode] Invoking with args:', args.join(' '))
    console.log('[ClaudeCode] Working directory:', options.workingDirectory)
    console.log('[ClaudeCode] Executable path:', execPath)
    if (isWindows) {
      console.log('[ClaudeCode] Prompt will be passed via stdin (Windows mode)')
    }

    // Build environment with enhanced PATH
    const spawnEnv = this.buildSpawnEnv(execPath)

    // Quote the executable path if using shell mode (handles spaces in path)
    const spawnPath = isWindows ? quoteExecutablePath(execPath) : execPath

    // Spawn the process
    const child = spawn(spawnPath, args, {
      cwd: options.workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: isWindows,
      env: spawnEnv
    })

    console.log('[ClaudeCode] Process spawned with PID:', child.pid)

    // On Windows, write the prompt to stdin then close it
    // On non-Windows, just close stdin immediately
    if (child.stdin) {
      if (isWindows) {
        child.stdin.write(options.prompt)
        child.stdin.end()
        console.log('[ClaudeCode] Prompt written to stdin and closed (Windows mode)')
      } else {
        child.stdin.end()
        console.log('[ClaudeCode] stdin closed')
      }
    }

    // Log process events for debugging
    child.on('spawn', () => {
      console.log('[ClaudeCode] Process spawn event fired, PID:', child.pid)
    })

    child.on('error', (err) => {
      console.error('[ClaudeCode] Process error:', err.message)
    })

    child.on('exit', (code, signal) => {
      console.log('[ClaudeCode] Process exited with code:', code, 'signal:', signal)
    })

    child.on('close', (code, signal) => {
      console.log('[ClaudeCode] Process closed with code:', code, 'signal:', signal)
    })

    // Log stdout/stderr data for debugging
    child.stdout?.on('data', (chunk) => {
      console.log('[ClaudeCode] stdout chunk received, size:', chunk.length)
    })

    child.stderr?.on('data', (chunk) => {
      console.log('[ClaudeCode] stderr chunk received, size:', chunk.length)
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
   * Returns the raw line as the message so it can be written directly to the log
   * The AgentLogViewer will parse the JSON for display
   */
  protected parseLine(line: string): AgentOutputEvent | null {
    const timestamp = new Date()

    // Try to parse as JSON (Claude Code --print outputs JSON-lines)
    try {
      const json = JSON.parse(line)

      // Determine event type for internal routing, but preserve raw line as message
      if (json.type === 'error') {
        // Check if the error is a usage limit
        const errorMessage = json.error || json.message || line
        const usageLimitResult = this.detectUsageLimit(errorMessage)
        if (usageLimitResult.isUsageLimit) {
          return {
            type: 'usage-limit',
            message: line,
            timestamp,
            resetAt: usageLimitResult.resetAt
          }
        }

        // Check if the error is a rate limit
        if (this.detectRateLimit(errorMessage)) {
          return {
            type: 'rate-limit',
            message: line,
            timestamp
          }
        }

        return {
          type: 'error',
          message: line, // Keep raw JSON for log viewer
          timestamp
        }
      } else if (json.type === 'result') {
        return {
          type: 'complete',
          message: line, // Keep raw JSON for log viewer
          timestamp
        }
      }

      // Default: treat as log, keep raw JSON line
      return {
        type: 'log',
        message: line,
        timestamp
      }
    } catch {
      // Not JSON, treat as plain text
      // Check usage limit first (more specific)
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
   * Detect rate limit errors (temporary, retry soon)
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
   * Check if we're currently within usage limits (pre-flight check)
   * Runs a minimal prompt to verify we can make API calls
   * Uses async spawn to avoid blocking the main thread
   */
  async checkUsageLimits(): Promise<{ canProceed: boolean; resetAt?: Date; message?: string }> {
    const execPath = await this.getExecutablePath()
    if (!execPath) {
      return { canProceed: false, message: 'Claude Code CLI not found' }
    }

    return new Promise((resolve) => {
      const args = ['-p', '--output-format', 'json', 'Reply with only the word: ok']

      // On Windows, always use shell: true for proper executable resolution
      const isWindows = platform() === 'win32'

      // Build environment with enhanced PATH
      const spawnEnv = this.buildSpawnEnv(execPath)

      // Quote the executable path if using shell mode (handles spaces in path)
      const spawnPath = isWindows ? quoteExecutablePath(execPath) : execPath

      const child = spawn(spawnPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: isWindows,
        env: spawnEnv
      })

      let stdout = ''
      let stderr = ''
      let resolved = false

      // Set a 30-second timeout
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          child.kill('SIGTERM')
          console.warn('[ClaudeCode] Usage check timed out after 30s')
          // On timeout, allow proceeding - actual task will handle errors
          resolve({ canProceed: true })
        }
      }, 30000)

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString()
      })

      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString()
      })

      // Close stdin immediately
      child.stdin?.end()

      child.on('close', (code) => {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)

        const result = stdout || stderr

        // If process exited cleanly, check the output
        if (code === 0) {
          // Try to parse as JSON to check for error responses
          try {
            const json = JSON.parse(result)
            if (json.type === 'error') {
              const errorMsg = json.error || json.message || result
              const usageLimitResult = this.detectUsageLimit(errorMsg)
              if (usageLimitResult.isUsageLimit) {
                resolve({
                  canProceed: false,
                  resetAt: usageLimitResult.resetAt,
                  message: errorMsg
                })
                return
              }
            }
          } catch {
            // Not JSON or parse error - check raw output for limits
            const usageLimitResult = this.detectUsageLimit(result)
            if (usageLimitResult.isUsageLimit) {
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
          // Non-zero exit code - check for usage limits in output
          const errorMessage = stderr || stdout || `Process exited with code ${code}`
          const usageLimitResult = this.detectUsageLimit(errorMessage)
          if (usageLimitResult.isUsageLimit) {
            resolve({
              canProceed: false,
              resetAt: usageLimitResult.resetAt,
              message: errorMessage
            })
            return
          }

          // For other errors (network, CLI issues, etc.), allow proceeding
          // The actual task execution will handle errors appropriately
          console.warn('[ClaudeCode] Usage check encountered non-limit error:', errorMessage)
          resolve({ canProceed: true })
        }
      })

      child.on('error', (err) => {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)
        console.warn('[ClaudeCode] Usage check spawn error:', err.message)
        // On spawn error, allow proceeding - actual task will handle errors
        resolve({ canProceed: true })
      })
    })
  }

  /**
   * Detect usage limit errors (quota exceeded, need to wait longer)
   * These are different from rate limits - they indicate the user has
   * reached their API usage quota and need to wait for reset.
   */
  detectUsageLimit(output: string): { isUsageLimit: boolean; resetAt?: Date } {
    const lower = output.toLowerCase()

    // Check for usage limit patterns
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
    // Common patterns: "resets at", "try again at", "available at", "will reset"
    let resetAt: Date | undefined

    // Pattern: "resets at HH:MM" or "resets at HH:MM:SS"
    const timeMatch = output.match(/(?:reset|available|try again)(?:\s+at)?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM))?)/i)
    if (timeMatch) {
      const today = new Date()
      const [hours, minutes] = timeMatch[1].split(':').map(Number)
      resetAt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes)
      // If the time is in the past, assume it's tomorrow
      if (resetAt < today) {
        resetAt.setDate(resetAt.getDate() + 1)
      }
    }

    // Pattern: "in X hours/minutes"
    const durationMatch = output.match(/(?:reset|available|try again)\s+in\s+(\d+)\s*(hour|minute|min|hr|h|m)s?/i)
    if (durationMatch && !resetAt) {
      const amount = parseInt(durationMatch[1], 10)
      const unit = durationMatch[2].toLowerCase()
      resetAt = new Date()
      if (unit.startsWith('h')) {
        resetAt.setHours(resetAt.getHours() + amount)
      } else {
        resetAt.setMinutes(resetAt.getMinutes() + amount)
      }
    }

    // Pattern: ISO timestamp
    const isoMatch = output.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/i)
    if (isoMatch && !resetAt) {
      resetAt = new Date(isoMatch[1])
    }

    return { isUsageLimit: true, resetAt }
  }

  /**
   * Get the OAuth access token from the system keychain or credentials file
   */
  private async getOAuthToken(): Promise<string | null> {
    const currentPlatform = platform()

    if (currentPlatform === 'darwin') {
      // macOS: Use security command to get from Keychain
      try {
        const { stdout } = await execAsync(
          'security find-generic-password -s "Claude Code-credentials" -w'
        )
        const credentials = JSON.parse(stdout.trim())
        return credentials.claudeAiOauth?.accessToken || null
      } catch (error) {
        console.warn('[ClaudeCode] Failed to get OAuth token from Keychain:', error)
      }
    } else if (currentPlatform === 'linux') {
      // Linux: Try to read from credentials file
      try {
        const credentialsPath = join(homedir(), '.config', 'claude-code', 'credentials.json')
        if (existsSync(credentialsPath)) {
          const credentials = JSON.parse(readFileSync(credentialsPath, 'utf-8'))
          return credentials.claudeAiOauth?.accessToken || null
        }
      } catch (error) {
        console.warn('[ClaudeCode] Failed to read credentials file:', error)
      }
    } else if (currentPlatform === 'win32') {
      // Windows: Try credentials file in various locations
      // Claude Code CLI (Electron app) typically stores in LOCALAPPDATA
      const possibleCredentialPaths = [
        // LOCALAPPDATA (preferred for Electron apps)
        join(process.env.LOCALAPPDATA || '', 'claude-code', 'credentials.json'),
        join(process.env.LOCALAPPDATA || '', 'Claude Code', 'credentials.json'),
        // APPDATA fallback
        join(process.env.APPDATA || '', 'claude-code', 'credentials.json'),
        join(process.env.APPDATA || '', 'Claude Code', 'credentials.json')
      ]

      for (const credentialsPath of possibleCredentialPaths) {
        try {
          if (existsSync(credentialsPath)) {
            const credentials = JSON.parse(readFileSync(credentialsPath, 'utf-8'))
            if (credentials.claudeAiOauth?.accessToken) {
              return credentials.claudeAiOauth.accessToken
            }
          }
        } catch (error) {
          console.warn('[ClaudeCode] Failed to read credentials file at', credentialsPath, ':', error)
        }
      }
    }

    return null
  }

  /**
   * Get current usage percentage from the Anthropic API
   * Returns null values gracefully if token unavailable or API fails
   */
  async getUsagePercentage(): Promise<{
    fiveHour: { utilization: number; resetsAt: string } | null
    sevenDay: { utilization: number; resetsAt: string } | null
    error: string | null
  }> {
    const unavailable = { fiveHour: null, sevenDay: null, error: null }

    try {
      const token = await this.getOAuthToken()
      if (!token) {
        // Token not available - usage info simply not accessible
        return unavailable
      }

      const response = await fetch(USAGE_API_URL, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'anthropic-beta': ANTHROPIC_BETA,
          'User-Agent': USER_AGENT,
          Accept: 'application/json'
        }
      })

      if (!response.ok) {
        // API error - return unavailable without surfacing error to user
        return unavailable
      }

      const data = (await response.json()) as {
        five_hour?: { utilization: number; resets_at: string }
        seven_day?: { utilization: number; resets_at: string }
      }

      return {
        fiveHour: data.five_hour
          ? { utilization: data.five_hour.utilization, resetsAt: data.five_hour.resets_at }
          : null,
        sevenDay: data.seven_day
          ? { utilization: data.seven_day.utilization, resetsAt: data.seven_day.resets_at }
          : null,
        error: null
      }
    } catch {
      // Any error - usage info simply not available
      return unavailable
    }
  }

  /**
   * Fetch available models from the Anthropic API
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
      const token = await this.getOAuthToken()
      if (!token) {
        console.warn('[ClaudeCode] No OAuth token available, using default models')
        return CLAUDE_CODE_MODELS
      }

      const response = await fetch(MODELS_API_URL, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': ANTHROPIC_BETA,
          'User-Agent': USER_AGENT,
          Accept: 'application/json'
        }
      })

      if (!response.ok) {
        console.warn('[ClaudeCode] Models API error:', response.status)
        return CLAUDE_CODE_MODELS
      }

      const data = (await response.json()) as {
        data?: Array<{
          id: string
          display_name?: string
          created_at?: string
        }>
      }

      if (!data.data || !Array.isArray(data.data)) {
        console.warn('[ClaudeCode] Unexpected models API response format')
        return CLAUDE_CODE_MODELS
      }

      // Filter and transform models - only include Claude models suitable for coding
      const models: AgentModelInfo[] = data.data
        .filter((model) => {
          const id = model.id.toLowerCase()
          // Include claude-4, claude-3.5, and claude-3 models
          // Exclude embedding models and other non-chat models
          return (
            (id.includes('claude-sonnet') ||
              id.includes('claude-opus') ||
              id.includes('claude-haiku')) &&
            !id.includes('embedding')
          )
        })
        .map((model) => {
          const id = model.id
          // Generate a display name if not provided
          const name = model.display_name || this.formatModelName(id)
          const description = this.getModelDescription(id)

          return { id, name, description }
        })

      // Group by tier and find the latest in each tier for default
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

      // Sort each tier group by version and mark latest
      for (const [tier, tierModels] of tierGroups) {
        tierModels.sort((a, b) => {
          const versionA = this.extractVersion(a.id)
          const versionB = this.extractVersion(b.id)
          return this.compareVersions(versionB, versionA) // Descending
        })
      }

      // Sort the final list: default first, then by tier (opus > sonnet > haiku), then by version
      const sorted = models.sort((a, b) => {
        const getModelRank = (id: string): number => {
          if (id.includes('opus')) return 3
          if (id.includes('sonnet')) return 2
          if (id.includes('haiku')) return 1
          return 0
        }
        const rankA = getModelRank(a.id)
        const rankB = getModelRank(b.id)
        if (rankA !== rankB) return rankB - rankA

        // Newer versions first
        const versionA = this.extractVersion(a.id)
        const versionB = this.extractVersion(b.id)
        return this.compareVersions(versionB, versionA)
      })

      // Mark the latest sonnet as default
      const latestSonnet = tierGroups.get('sonnet')?.[0]
      if (latestSonnet) {
        latestSonnet.isDefault = true
      } else if (sorted.length > 0) {
        sorted[0].isDefault = true
      }

      // Cache the results
      this.cachedModels = sorted.length > 0 ? sorted : CLAUDE_CODE_MODELS
      this.modelsCacheTime = now

      console.log(`[ClaudeCode] Fetched ${sorted.length} models from API`)
      return this.cachedModels
    } catch (error) {
      console.error('[ClaudeCode] Failed to fetch models:', error)
      return CLAUDE_CODE_MODELS
    }
  }

  /**
   * Format a model ID into a display name
   */
  protected formatModelName(id: string): string {
    // e.g., "claude-sonnet-4-20250514" -> "Claude Sonnet 4"
    // e.g., "claude-3-5-sonnet-20241022" -> "Claude 3.5 Sonnet"
    const parts = id.split('-')
    let name = ''

    for (const part of parts) {
      // Skip date suffixes (8 digits)
      if (/^\d{8}$/.test(part)) continue

      // Handle version numbers
      if (part === '3' || part === '4' || part === '5') {
        name += ` ${part}`
      } else if (/^\d+$/.test(part)) {
        // Other numbers (like "5" in "3-5") become decimals
        name = name.trimEnd() + `.${part}`
      } else {
        // Capitalize words
        name += ` ${part.charAt(0).toUpperCase() + part.slice(1)}`
      }
    }

    return name.trim()
  }

  /**
   * Get a description for a model based on its ID
   */
  protected getModelDescription(_id: string): string {
    return 'Claude model'
  }

  /**
   * Start a chat session for planning
   * Uses -p mode with streaming JSON output
   * Supports --resume for multi-turn conversations
   */
  chat(
    options: AgentChatOptions
  ): { process: AgentProcess; parseOutput: () => AsyncIterable<AgentChatEvent> } {
    const execPath = this.cachedPath
    if (!execPath) {
      throw new Error('Claude Code CLI not found. Ensure getExecutablePath() is called before chat().')
    }

    const args: string[] = [
      '-p', // Non-interactive mode
      '--verbose',
      '--output-format', 'stream-json',
      '--dangerously-skip-permissions' // Bypass permission checks for automation
    ]

    // Add --resume for continuing a conversation
    if (options.conversationId) {
      args.push('--resume', options.conversationId)
      console.log('[ClaudeCode] Resuming conversation:', options.conversationId)
    }

    // On Windows, always use shell: true for proper executable resolution
    const isWindows = platform() === 'win32'

    // On Windows with shell: true, multi-line prompts with empty lines get truncated
    // because the shell interprets empty lines as command separators.
    // Solution: Pass message via stdin on Windows instead of as a command-line argument.
    // On non-Windows, we can safely pass the message as an argument.
    if (!isWindows) {
      args.push(options.message)
    }

    console.log('[ClaudeCode] Starting chat with args:', args.join(' '))
    console.log('[ClaudeCode] Working directory:', options.workingDirectory)
    if (isWindows) {
      console.log('[ClaudeCode] Message will be passed via stdin (Windows mode)')
    }

    // Build environment with enhanced PATH
    const spawnEnv = this.buildSpawnEnv(execPath)

    // Quote the executable path if using shell mode (handles spaces in path)
    const spawnPath = isWindows ? quoteExecutablePath(execPath) : execPath

    // Spawn the process
    const child = spawn(spawnPath, args, {
      cwd: options.workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: isWindows,
      env: spawnEnv
    })

    console.log('[ClaudeCode] Chat process spawned with PID:', child.pid)

    // On Windows, write the message to stdin then close it
    // On non-Windows, just close stdin immediately
    if (child.stdin) {
      if (isWindows) {
        child.stdin.write(options.message)
        child.stdin.end()
        console.log('[ClaudeCode] Message written to stdin and closed (Windows mode)')
      } else {
        child.stdin.end()
      }
    }

    const agentProcess = wrapChildProcess(child)

    // Create async iterator for parsing output
    const parseOutput = async function* (this: ClaudeCodeAdapter): AsyncIterable<AgentChatEvent> {
      const decoder = new TextDecoder()
      let buffer = ''
      let conversationId: string | undefined

      for await (const chunk of agentProcess.stdout) {
        buffer += decoder.decode(chunk as Buffer, { stream: true })

        // Process complete lines
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue

          try {
            const json = JSON.parse(line)

            // Extract conversation ID from init or first response
            if (json.session_id && !conversationId) {
              conversationId = json.session_id
              console.log('[ClaudeCode] Got conversation ID:', conversationId)
            }

            // Handle different message types
            if (json.type === 'assistant') {
              // Assistant message chunk
              const content = json.message?.content
              if (content && Array.isArray(content)) {
                for (const block of content) {
                  if (block.type === 'text' && block.text) {
                    yield {
                      type: 'text',
                      content: block.text,
                      conversationId
                    }
                  }
                }
              }
            } else if (json.type === 'result') {
              // Conversation complete
              yield {
                type: 'complete',
                conversationId
              }
            } else if (json.type === 'error') {
              yield {
                type: 'error',
                error: json.error || json.message || 'Unknown error',
                conversationId
              }
            }
          } catch {
            // Not JSON, ignore for chat mode
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const json = JSON.parse(buffer)
          if (json.session_id && !conversationId) {
            conversationId = json.session_id
          }
          if (json.type === 'result') {
            yield { type: 'complete', conversationId }
          }
        } catch {
          // Ignore
        }
      }
    }.bind(this)

    return { process: agentProcess, parseOutput }
  }

  /**
   * Validate that authentication is currently valid
   * Uses the CLI directly to check auth (avoids keychain access issues in Electron)
   */
  async validateAuth(): Promise<{
    isValid: boolean
    requiresReauth: boolean
    error?: string
  }> {
    const execPath = await this.getExecutablePath()
    if (!execPath) {
      return {
        isValid: false,
        requiresReauth: false,
        error: 'Claude Code CLI not found'
      }
    }

    return new Promise((resolve) => {
      // Run a minimal prompt to verify auth works
      const args = ['-p', '--output-format', 'json', 'Reply with only the word: ok']

      const isWindows = platform() === 'win32'

      // Build environment with enhanced PATH
      const spawnEnv = this.buildSpawnEnv(execPath)

      // Quote the executable path if using shell mode (handles spaces in path)
      const spawnPath = isWindows ? quoteExecutablePath(execPath) : execPath

      const child = spawn(spawnPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: isWindows,
        env: spawnEnv
      })

      let stdout = ''
      let stderr = ''
      let resolved = false

      // Set a 30-second timeout
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          child.kill('SIGTERM')
          console.warn('[ClaudeCode] Auth validation timed out after 30s')
          // On timeout, assume auth is valid - actual task will handle errors
          resolve({ isValid: true, requiresReauth: false })
        }
      }, 30000)

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString()
      })

      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString()
      })

      // Close stdin immediately
      child.stdin?.end()

      child.on('close', (code) => {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)

        const result = stdout || stderr

        // Check for auth-related errors in output
        if (this.detectAuthError(result)) {
          console.warn('[ClaudeCode] Auth validation detected auth error:', result.slice(0, 200))
          resolve({
            isValid: false,
            requiresReauth: true,
            error: 'Authentication required. Please run Claude Code in a terminal to authenticate.'
          })
          return
        }

        // If process exited cleanly, auth is valid
        if (code === 0) {
          console.log('[ClaudeCode] Auth validation passed')
          resolve({ isValid: true, requiresReauth: false })
          return
        }

        // Non-zero exit - check if it's an auth error
        const errorMessage = stderr || stdout || `Process exited with code ${code}`
        if (this.detectAuthError(errorMessage)) {
          resolve({
            isValid: false,
            requiresReauth: true,
            error: 'Authentication required. Please run Claude Code in a terminal to authenticate.'
          })
          return
        }

        // Other errors (network, CLI issues) - allow proceeding
        console.warn('[ClaudeCode] Auth validation got non-zero exit but not auth error:', code)
        resolve({ isValid: true, requiresReauth: false })
      })

      child.on('error', (err) => {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)
        console.warn('[ClaudeCode] Auth validation spawn error:', err.message)
        // On spawn error, assume auth is valid - actual task will handle errors
        resolve({ isValid: true, requiresReauth: false })
      })
    })
  }

  /**
   * Detect authentication errors in agent output
   * Returns true if the output indicates an authentication failure
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
      (lower.includes('oauth') && (lower.includes('error') || lower.includes('failed'))) ||
      (lower.includes('credential') && (lower.includes('invalid') || lower.includes('expired')))
    )
  }

  /**
   * Trigger re-authentication flow
   * Launches Claude Code in a new terminal window for interactive authentication
   * @param projectPath - Optional project path to authenticate within that project's context
   */
  async triggerReauth(projectPath?: string): Promise<{ success: boolean; error?: string }> {
    const execPath = await this.getExecutablePath()
    if (!execPath) {
      return { success: false, error: 'Claude Code CLI not found' }
    }

    const workingDir = projectPath || homedir()
    console.log(
      `[ClaudeCode] Launching Claude Code in terminal for re-authentication (cwd: ${workingDir})...`
    )

    try {
      // Launch Claude Code in a new terminal window
      // The user will authenticate interactively in the terminal
      // If a project path is provided, authenticate in that project's context
      await launchInTerminal({
        command: execPath,
        args: [],
        cwd: workingDir,
        title: projectPath ? `Claude Code - ${projectPath}` : 'Claude Code Authentication',
        keepOpen: true
      })

      console.log('[ClaudeCode] Terminal launched successfully')

      // Return success immediately - the user will authenticate in the terminal
      // The next task execution will validate the auth
      return {
        success: true,
        error: undefined
      }
    } catch (err) {
      const error = err as Error
      console.error('[ClaudeCode] Failed to launch terminal:', error)
      return {
        success: false,
        error: `Failed to launch terminal: ${error.message}`
      }
    }
  }

  /**
   * Get project config files for Claude Code
   */
  getProjectConfigFiles(): string[] {
    return ['CLAUDE.md', '.claude/settings.json', '.claude/commands']
  }

  /**
   * Get Claude Code capabilities
   */
  getCapabilities(): AgentCapabilities {
    return {
      supportsSkills: true,
      supportsProjectConfig: true,
      supportsContextFiles: true,
      supportsNonInteractiveMode: true,
      supportsPauseResume: false // Claude Code doesn't have native pause/resume
    }
  }

}

/**
 * Default Claude Code adapter instance
 */
export const claudeCodeAdapter = new ClaudeCodeAdapter()
