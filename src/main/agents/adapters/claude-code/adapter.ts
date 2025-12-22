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
import { spawn } from 'child_process'
import { platform, homedir } from 'os'
import { launchInTerminal } from '@main/utils/terminal'
import { quoteExecutablePath } from '@main/utils/paths'
import { logger } from '@main/utils/logger'
import { BaseAgentAdapter, wrapChildProcess } from '../base-adapter'
import { findClaudeCli, resolveCliExecution, POSSIBLE_PATHS } from './cli-resolution'
import { detectRateLimit, detectUsageLimit, detectAuthError, parseOutputStream } from './output-parser'
import { fetchUsagePercentage, fetchAvailableModels } from './api'

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
    logger.debug('[ClaudeCode] Custom path set to:', path || '(auto-detect)')
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
      const { promisify } = await import('util')
      const { exec } = await import('child_process')
      const execAsync = promisify(exec)

      // Resolve how to execute this CLI (may need node)
      const execution = resolveCliExecution(execPath)
      const cmd = execution.prependArgs.length > 0
        ? `"${execution.command}" "${execution.prependArgs[0]}" --version`
        : `"${execPath}" --version`

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await execAsync(cmd, { encoding: 'utf8', timeout: 10000, shell: true } as any)
      const stdout = String(result.stdout)
      const stderr = String(result.stderr)

      const output = stdout.trim() || stderr.trim()
      if (output) {
        // Extract version from output like "claude-code 2.0.32" or just "2.0.32"
        const versionMatch = output.match(/(\d+\.\d+\.\d+(?:-[a-z0-9.]+)?)/i)
        const version = versionMatch ? versionMatch[1] : output
        logger.debug('[ClaudeCode] CLI test successful, version:', version)
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
      const { promisify } = await import('util')
      const { exec } = await import('child_process')
      const execAsync = promisify(exec)

      // Resolve how to execute this CLI (may need node)
      const execution = resolveCliExecution(path)
      const cmd = execution.prependArgs.length > 0
        ? `"${execution.command}" "${execution.prependArgs[0]}" --version`
        : `"${path}" --version`

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await execAsync(cmd, { encoding: 'utf8', timeout: 10000, shell: true } as any)
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
      logger.debug('[ClaudeCode] Using custom path:', this.customPath)
      this.cachedPath = this.customPath
      return this.customPath
    }

    if (this.cachedPath) return this.cachedPath

    const path = await findClaudeCli()
    if (path) {
      this.cachedPath = path
    }
    return path
  }

  /**
   * Invoke Claude Code with a prompt
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
      logger.debug('[ClaudeCode] Using model:', model)
    }

    // Add thinking mode if enabled (extended thinking for complex reasoning)
    const thinkingMode = options.agentOptions?.thinkingMode as boolean | undefined
    if (thinkingMode) {
      args.push('--thinking')
      logger.debug('[ClaudeCode] Thinking mode enabled')
    }

    // Add --resume support for continuing conversations
    const resumeSessionId = options.agentOptions?.resumeSessionId as string | undefined
    if (resumeSessionId) {
      args.push('--resume', resumeSessionId)
      logger.debug('[ClaudeCode] Resuming session:', resumeSessionId)
    }

    // Add context files as allowed directories if provided
    if (options.contextFiles && options.contextFiles.length > 0) {
      for (const file of options.contextFiles) {
        args.push('--add-dir', file)
      }
    }

    const isWindows = platform() === 'win32'

    // On Windows with shell: true, multi-line prompts get truncated.
    // Pass prompt via stdin on Windows, as argument on other platforms.
    if (!isWindows) {
      args.push(options.prompt)
    }

    logger.debug('[ClaudeCode] Invoking with args:', args.join(' '))
    logger.debug('[ClaudeCode] Working directory:', options.workingDirectory)
    logger.debug('[ClaudeCode] Executable path:', execPath)

    // Resolve how to execute this CLI (may need explicit node invocation)
    const execution = resolveCliExecution(execPath)
    const spawnArgs = [...execution.prependArgs, ...args]
    const spawnCommand = isWindows ? quoteExecutablePath(execution.command) : execution.command

    logger.debug('[ClaudeCode] Spawn command:', spawnCommand)
    logger.debug('[ClaudeCode] Spawn args:', spawnArgs.join(' '))

    // Spawn the process
    const child = spawn(spawnCommand, spawnArgs, {
      cwd: options.workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: isWindows,
      env: { ...process.env, CI: 'true', TERM: 'dumb' }
    })

    logger.debug('[ClaudeCode] Process spawned with PID:', child.pid)

    // Handle stdin
    if (child.stdin) {
      if (isWindows) {
        child.stdin.write(options.prompt)
        child.stdin.end()
        logger.debug('[ClaudeCode] Prompt written to stdin and closed (Windows mode)')
      } else {
        child.stdin.end()
        logger.debug('[ClaudeCode] stdin closed')
      }
    }

    // Log process events for debugging
    child.on('spawn', () => {
      logger.debug('[ClaudeCode] Process spawn event fired, PID:', child.pid)
    })

    child.on('error', (err) => {
      console.error('[ClaudeCode] Process error:', err.message)
    })

    child.on('exit', (code, signal) => {
      logger.debug('[ClaudeCode] Process exited with code:', code, 'signal:', signal)
    })

    child.on('close', (code, signal) => {
      logger.debug('[ClaudeCode] Process closed with code:', code, 'signal:', signal)
    })

    // Log stdout/stderr data for debugging
    child.stdout?.on('data', (chunk) => {
      logger.debug('[ClaudeCode] stdout chunk received, size:', chunk.length)
    })

    child.stderr?.on('data', (chunk) => {
      logger.debug('[ClaudeCode] stderr chunk received, size:', chunk.length)
    })

    return wrapChildProcess(child, this.name)
  }

  /**
   * Parse output stream for events
   */
  async *parseOutput(stream: NodeJS.ReadableStream): AsyncIterable<AgentOutputEvent> {
    yield* parseOutputStream(stream)
  }

  /**
   * Detect rate limit errors
   */
  detectRateLimit(output: string): boolean {
    return detectRateLimit(output)
  }

  /**
   * Detect usage limit errors
   */
  detectUsageLimit(output: string): { isUsageLimit: boolean; resetAt?: Date } {
    return detectUsageLimit(output)
  }

  /**
   * Detect authentication errors
   */
  detectAuthError(output: string): boolean {
    return detectAuthError(output)
  }

  /**
   * Check if we're currently within usage limits (pre-flight check)
   */
  async checkUsageLimits(): Promise<{ canProceed: boolean; resetAt?: Date; message?: string }> {
    const execPath = await this.getExecutablePath()
    if (!execPath) {
      return { canProceed: false, message: 'Claude Code CLI not found' }
    }

    return new Promise((resolve) => {
      const checkArgs = ['-p', '--output-format', 'json', 'Reply with only the word: ok']
      const isWindows = platform() === 'win32'

      // Resolve how to execute this CLI
      const execution = resolveCliExecution(execPath)
      const spawnArgs = [...execution.prependArgs, ...checkArgs]
      const spawnCommand = isWindows ? quoteExecutablePath(execution.command) : execution.command

      const child = spawn(spawnCommand, spawnArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: isWindows,
        env: { ...process.env, CI: 'true', TERM: 'dumb' }
      })

      let stdout = ''
      let stderr = ''
      let resolved = false

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          child.kill('SIGTERM')
          console.warn('[ClaudeCode] Usage check timed out after 30s')
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
          try {
            const json = JSON.parse(result)
            if (json.type === 'error') {
              const errorMsg = json.error || json.message || result
              const usageLimitResult = detectUsageLimit(errorMsg)
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
            const usageLimitResult = detectUsageLimit(result)
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
          const errorMessage = stderr || stdout || `Process exited with code ${code}`
          const usageLimitResult = detectUsageLimit(errorMessage)
          if (usageLimitResult.isUsageLimit) {
            resolve({
              canProceed: false,
              resetAt: usageLimitResult.resetAt,
              message: errorMessage
            })
            return
          }
          console.warn('[ClaudeCode] Usage check encountered non-limit error:', errorMessage)
          resolve({ canProceed: true })
        }
      })

      child.on('error', (err) => {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)
        console.warn('[ClaudeCode] Usage check spawn error:', err.message)
        resolve({ canProceed: true })
      })
    })
  }

  /**
   * Get current usage percentage from the Anthropic API
   */
  async getUsagePercentage(): Promise<{
    fiveHour: { utilization: number; resetsAt: string } | null
    sevenDay: { utilization: number; resetsAt: string } | null
    error: string | null
  }> {
    return fetchUsagePercentage()
  }

  /**
   * Fetch available models from the Anthropic API
   */
  async fetchAvailableModels(): Promise<AgentModelInfo[]> {
    return fetchAvailableModels()
  }

  /**
   * Start a chat session for planning
   */
  chat(
    options: AgentChatOptions
  ): { process: AgentProcess; parseOutput: () => AsyncIterable<AgentChatEvent> } {
    const execPath = this.cachedPath
    if (!execPath) {
      throw new Error('Claude Code CLI not found. Ensure getExecutablePath() is called before chat().')
    }

    const chatArgs: string[] = [
      '-p',
      '--verbose',
      '--output-format', 'stream-json',
      '--dangerously-skip-permissions'
    ]

    if (options.conversationId) {
      chatArgs.push('--resume', options.conversationId)
      logger.debug('[ClaudeCode] Resuming conversation:', options.conversationId)
    }

    const isWindows = platform() === 'win32'
    if (!isWindows) {
      chatArgs.push(options.message)
    }

    logger.debug('[ClaudeCode] Starting chat with args:', chatArgs.join(' '))
    logger.debug('[ClaudeCode] Working directory:', options.workingDirectory)

    // Resolve how to execute this CLI
    const execution = resolveCliExecution(execPath)
    const spawnArgs = [...execution.prependArgs, ...chatArgs]
    const spawnCommand = isWindows ? quoteExecutablePath(execution.command) : execution.command

    const child = spawn(spawnCommand, spawnArgs, {
      cwd: options.workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: isWindows,
      env: { ...process.env, CI: 'true', TERM: 'dumb' }
    })

    logger.debug('[ClaudeCode] Chat process spawned with PID:', child.pid)

    if (child.stdin) {
      if (isWindows) {
        child.stdin.write(options.message)
        child.stdin.end()
        logger.debug('[ClaudeCode] Message written to stdin and closed (Windows mode)')
      } else {
        child.stdin.end()
      }
    }

    const agentProcess = wrapChildProcess(child, this.name)

    const parseOutputFn = async function* (): AsyncIterable<AgentChatEvent> {
      const decoder = new TextDecoder()
      let buffer = ''
      let conversationId: string | undefined

      for await (const chunk of agentProcess.stdout) {
        buffer += decoder.decode(chunk as Buffer, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue

          try {
            const json = JSON.parse(line)

            if (json.session_id && !conversationId) {
              conversationId = json.session_id
              logger.debug('[ClaudeCode] Got conversation ID:', conversationId)
            }

            if (json.type === 'assistant') {
              const content = json.message?.content
              if (content && Array.isArray(content)) {
                for (const block of content) {
                  if (block.type === 'text' && block.text) {
                    yield { type: 'text', content: block.text, conversationId }
                  } else if (block.type === 'tool_use') {
                    yield { type: 'tool_use', tool: block.name, toolInput: block.input, conversationId }
                  }
                }
              }
            } else if (json.type === 'result') {
              yield { type: 'complete', conversationId }
            } else if (json.type === 'error') {
              yield { type: 'error', error: json.error || json.message || 'Unknown error', conversationId }
            }
          } catch {
            // Not JSON, ignore for chat mode
          }
        }
      }

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
    }

    return { process: agentProcess, parseOutput: parseOutputFn }
  }

  /**
   * Validate that authentication is currently valid
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
      const authArgs = ['-p', '--output-format', 'json', 'Reply with only the word: ok']
      const isWindows = platform() === 'win32'

      // Resolve how to execute this CLI
      const execution = resolveCliExecution(execPath)
      const spawnArgs = [...execution.prependArgs, ...authArgs]
      const spawnCommand = isWindows ? quoteExecutablePath(execution.command) : execution.command

      const child = spawn(spawnCommand, spawnArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: isWindows,
        env: { ...process.env, CI: 'true', TERM: 'dumb' }
      })

      let stdout = ''
      let stderr = ''
      let resolved = false

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          child.kill('SIGTERM')
          console.warn('[ClaudeCode] Auth validation timed out after 30s')
          resolve({ isValid: true, requiresReauth: false })
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

        if (detectAuthError(result)) {
          console.warn('[ClaudeCode] Auth validation detected auth error:', result.slice(0, 200))
          resolve({
            isValid: false,
            requiresReauth: true,
            error: 'Authentication required. Please run Claude Code in a terminal to authenticate.'
          })
          return
        }

        if (code === 0) {
          logger.debug('[ClaudeCode] Auth validation passed')
          resolve({ isValid: true, requiresReauth: false })
          return
        }

        const errorMessage = stderr || stdout || `Process exited with code ${code}`
        if (detectAuthError(errorMessage)) {
          resolve({
            isValid: false,
            requiresReauth: true,
            error: 'Authentication required. Please run Claude Code in a terminal to authenticate.'
          })
          return
        }

        console.warn('[ClaudeCode] Auth validation got non-zero exit but not auth error:', code)
        resolve({ isValid: true, requiresReauth: false })
      })

      child.on('error', (err) => {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)
        console.warn('[ClaudeCode] Auth validation spawn error:', err.message)
        resolve({ isValid: true, requiresReauth: false })
      })
    })
  }

  /**
   * Trigger re-authentication flow
   */
  async triggerReauth(projectPath?: string): Promise<{ success: boolean; error?: string }> {
    const execPath = await this.getExecutablePath()
    if (!execPath) {
      return { success: false, error: 'Claude Code CLI not found' }
    }

    const workingDir = projectPath || homedir()
    logger.debug(
      `[ClaudeCode] Launching Claude Code in terminal for re-authentication (cwd: ${workingDir})...`
    )

    try {
      await launchInTerminal({
        command: execPath,
        args: [],
        cwd: workingDir,
        title: projectPath ? `Claude Code - ${projectPath}` : 'Claude Code Authentication',
        keepOpen: true
      })

      logger.debug('[ClaudeCode] Terminal launched successfully')
      return { success: true, error: undefined }
    } catch (err) {
      const error = err as Error
      console.error('[ClaudeCode] Failed to launch terminal:', error)
      return { success: false, error: `Failed to launch terminal: ${error.message}` }
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
      supportsPauseResume: false
    }
  }
}

/**
 * Default Claude Code adapter instance
 */
export const claudeCodeAdapter = new ClaudeCodeAdapter()
