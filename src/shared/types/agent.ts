/**
 * Agent abstraction types for Nightshift
 *
 * IMPORTANT: The architecture is designed to support multiple AI agents
 * (Claude Code, Aider, Amazon Q, etc.). Even for MVP, we use generic
 * naming and interfaces.
 *
 * Key Rule: Core app code should NEVER import directly from
 * agents/adapters/claude-code.ts. Use the AgentAdapter interface
 * and registry instead.
 */

/**
 * Options for invoking an agent
 */
export interface AgentInvokeOptions {
  /** The prompt/instructions for the agent */
  prompt: string

  /** Working directory (should be the worktree path) */
  workingDirectory: string

  /** Additional context files to include */
  contextFiles?: string[]

  /** Agent-specific options (passed through to adapter) */
  agentOptions?: Record<string, unknown>
}

/**
 * Options for starting a chat with an agent
 */
export interface AgentChatOptions {
  /** The user's message */
  message: string

  /** Working directory for context */
  workingDirectory: string

  /** Conversation ID for resuming (multi-turn) */
  conversationId?: string
}

/**
 * Event emitted during chat streaming
 */
export interface AgentChatEvent {
  /** Type of event */
  type: 'text' | 'tool_use' | 'complete' | 'error'

  /** Content chunk (for text events) */
  content?: string

  /** Tool name (for tool_use events) */
  tool?: string

  /** Tool input (for tool_use events) */
  toolInput?: Record<string, unknown>

  /** Conversation ID (returned on first response) */
  conversationId?: string

  /** Error message (for error events) */
  error?: string
}

/**
 * Handle to a running agent process
 */
export interface AgentProcess {
  /** Process ID */
  readonly pid: number

  /** Standard output stream */
  readonly stdout: NodeJS.ReadableStream

  /** Standard error stream */
  readonly stderr: NodeJS.ReadableStream

  /** Kill the process */
  kill(): void

  /** Wait for process to complete */
  wait(): Promise<{ exitCode: number }>
}

/**
 * Events emitted during agent execution
 */
export interface AgentOutputEvent {
  /** Event type */
  type: 'log' | 'error' | 'progress' | 'rate-limit' | 'usage-limit' | 'complete'

  /** Event message/content */
  message: string

  /** When the event occurred */
  timestamp: Date

  /** For usage-limit events, when the limit resets (if available) */
  resetAt?: Date

  /** Session ID from Claude Code (for --resume) */
  sessionId?: string
}

/**
 * Agent capabilities (what features the agent supports)
 */
export interface AgentCapabilities {
  /** Whether agent supports skills/plugins */
  supportsSkills: boolean

  /** Whether agent uses a project config file (CLAUDE.md, .aider, etc.) */
  supportsProjectConfig: boolean

  /** Whether agent can accept additional context files */
  supportsContextFiles: boolean

  /** Whether agent can run in non-interactive/headless mode */
  supportsNonInteractiveMode: boolean

  /** Whether agent supports pausing/resuming */
  supportsPauseResume: boolean
}

/**
 * Agent adapter interface
 *
 * Each AI coding tool (Claude Code, Aider, etc.) implements this interface.
 * The interface is designed to be generic enough to support various tools
 * while exposing common functionality.
 */
export interface AgentAdapter {
  /** Unique identifier for this agent type */
  readonly id: string

  /** Display name for UI */
  readonly name: string

  /** Check if the agent CLI is installed and available */
  isAvailable(): Promise<boolean>

  /** Get the path to the agent executable (async to avoid blocking main thread) */
  getExecutablePath(): Promise<string | null>

  /** Invoke the agent with a prompt in a working directory */
  invoke(options: AgentInvokeOptions): AgentProcess

  /** Parse output stream for status updates */
  parseOutput(stream: NodeJS.ReadableStream): AsyncIterable<AgentOutputEvent>

  /** Detect rate limit errors in output */
  detectRateLimit(output: string): boolean

  /** Detect usage limit errors in output (e.g., API quota exceeded) */
  detectUsageLimit(output: string): { isUsageLimit: boolean; resetAt?: Date }

  /**
   * Check if we're currently within usage limits (pre-flight check)
   * Returns true if we can proceed, false if we should wait
   * This is a lightweight check that should be fast
   */
  checkUsageLimits(): Promise<{ canProceed: boolean; resetAt?: Date; message?: string }>

  /**
   * Get current usage percentage from the API
   * Returns utilization percentages for different time windows
   */
  getUsagePercentage(): Promise<{
    fiveHour: { utilization: number; resetsAt: string } | null
    sevenDay: { utilization: number; resetsAt: string } | null
    error: string | null
  }>

  /**
   * Validate that authentication is currently valid (token not expired)
   * This is a pre-flight check before starting tasks
   */
  validateAuth(): Promise<{
    isValid: boolean
    requiresReauth: boolean
    error?: string
  }>

  /**
   * Detect authentication errors in agent output
   * Used to catch auth failures during task execution
   */
  detectAuthError(output: string): boolean

  /**
   * Trigger re-authentication flow for the agent
   * This opens a terminal or browser window for the user to authenticate
   * Returns true if re-authentication was successful
   * @param projectPath - Optional project path to authenticate within that project's context
   */
  triggerReauth(projectPath?: string): Promise<{ success: boolean; error?: string }>

  /**
   * Analyze agent output to detect if the work is incomplete
   * Called after task completes with exitCode=0 to determine if the agent
   * indicated more work is needed (phases, TODOs, continuation signals)
   *
   * @param outputLog - Full log of agent output events
   * @returns Detection result with reason and suggested next steps
   */
  detectIncompleteWork(outputLog: AgentOutputEvent[]): {
    isIncomplete: boolean
    reason?: 'multi-phase' | 'todo-items' | 'continuation-signal' | 'approval-needed' | 'token-limit'
    details?: string
    suggestedNextSteps?: string[]
  }

  /** Get agent-specific config files to look for in a project */
  getProjectConfigFiles(): string[]

  /** Get agent capabilities */
  getCapabilities(): AgentCapabilities

  /**
   * Set a custom executable path for this agent
   * This overrides auto-detection
   */
  setCustomPath(path: string | null): void

  /**
   * Test that the CLI is working correctly
   * Returns version string on success
   */
  testCli(): Promise<{ success: boolean; version?: string; error?: string }>
}

/**
 * Agent registry for managing available agents
 */
export interface AgentRegistry {
  /** Register an agent adapter */
  register(adapter: AgentAdapter): void

  /** Get an adapter by ID */
  get(id: string): AgentAdapter | undefined

  /** Get all registered adapters */
  getAll(): AgentAdapter[]

  /** Get available adapters (CLI is installed) */
  getAvailable(): Promise<AgentAdapter[]>

  /** Get the default adapter */
  getDefault(): AgentAdapter
}

/**
 * Agent IDs (use these constants instead of hardcoding strings)
 */
export const AGENT_IDS = {
  CLAUDE_CODE: 'claude-code',
  GEMINI: 'gemini',
  OPENROUTER: 'openrouter',
  AIDER: 'aider', // Future
  AMAZON_Q: 'amazon-q', // Future
  CODEX: 'codex' // Future
} as const

export type AgentId = (typeof AGENT_IDS)[keyof typeof AGENT_IDS]

/**
 * Model tier aliases (user-facing semantic names)
 * These aliases automatically map to the latest version of each tier
 */
export type ModelAlias = 'sonnet' | 'opus' | 'haiku' | 'flash' | 'pro'

/**
 * Model information for an agent
 */
export interface AgentModelInfo {
  /** Model identifier used in API calls (e.g., "claude-sonnet-4-5-20250514") */
  id: string
  /** Display name for UI (e.g., "Claude Sonnet 4.5") */
  name: string
  /** Brief description of the model */
  description?: string
  /** Whether this is the default model for the agent */
  isDefault?: boolean
  /** Optional alias for this model (e.g., "sonnet" for latest Sonnet) */
  alias?: ModelAlias
  /** The tier/family this model belongs to (used for alias resolution) */
  tier?: 'sonnet' | 'opus' | 'haiku' | 'flash' | 'pro' | string
  /** Version number extracted from the model ID (for sorting) */
  version?: string
  /** Whether this is a legacy/older version (not the latest in its tier) */
  isLegacy?: boolean
}

/**
 * Available models for Claude Code
 * Uses the --model flag in claude CLI
 */
export const CLAUDE_CODE_MODELS: AgentModelInfo[] = [
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', description: 'Our smart model for complex agents and coding', isDefault: true },
  { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', description: 'Premium model combining maximum intelligence with practical performance' }
]

/**
 * Available models for Gemini
 */
export const GEMINI_MODELS: AgentModelInfo[] = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast and efficient', isDefault: true  },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable Gemini model'},
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Previous generation fast model' },
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: 'Lightweight model' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Large context window (2M tokens)' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast with large context' }
]

/**
 * OpenRouter models - dynamically fetched, but these are common defaults
 * OpenRouter provides access to many models from different providers
 */
export const OPENROUTER_DEFAULT_MODELS: AgentModelInfo[] = [
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', description: 'Anthropic\'s smart model for complex tasks', isDefault: true },
  { id: 'anthropic/claude-opus-4', name: 'Claude Opus 4', description: 'Anthropic\'s most capable model' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'OpenAI\'s flagship multimodal model' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and cost-effective' },
  { id: 'google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro', description: 'Google\'s most capable model' },
  { id: 'google/gemini-2.5-flash-preview', name: 'Gemini 2.5 Flash', description: 'Fast and efficient' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', description: 'Meta\'s open-weight model' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', description: 'DeepSeek\'s flagship chat model' }
]

/**
 * Get available models for an agent
 */
export function getAgentModels(agentId: string): AgentModelInfo[] {
  switch (agentId) {
    case AGENT_IDS.CLAUDE_CODE:
      return CLAUDE_CODE_MODELS
    case AGENT_IDS.GEMINI:
      return GEMINI_MODELS
    case AGENT_IDS.OPENROUTER:
      return OPENROUTER_DEFAULT_MODELS
    default:
      return []
  }
}

/**
 * Get the default model for an agent
 */
export function getAgentDefaultModel(agentId: string): string | null {
  const models = getAgentModels(agentId)
  const defaultModel = models.find((m) => m.isDefault)
  return defaultModel?.id ?? models[0]?.id ?? null
}
