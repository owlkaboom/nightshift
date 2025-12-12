# Agent System

## Overview

The agent system provides an abstraction layer for AI coding tools. This allows Nightshift to support multiple agents (Claude Code, Gemini, OpenRouter) while keeping core application code agent-agnostic.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Code                          │
│         (never imports specific agent implementations)       │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      AgentRegistry                           │
│                 (singleton, lazy loading)                    │
│                                                              │
│  getAdapter(id) → AgentAdapter                              │
│  getAvailableAdapters() → AgentAdapter[]                    │
│  getDefaultAdapter() → AgentAdapter                         │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    BaseAgentAdapter                          │
│              (shared functionality - abstract)               │
│                                                              │
│  Provides: wrapChildProcess(), parseOutput(), parseLine(),  │
│  detectRateLimit(), detectUsageLimit(), extractResetTime(), │
│  getExecutablePath(), spawnProcess(), detectAuthError()     │
└─────────────────────────────┬───────────────────────────────┘
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌────────────┐  ┌────────────┐  ┌────────────┐
       │ClaudeCode  │  │   Gemini   │  │ OpenRouter │
       │  Adapter   │  │   Adapter  │  │  Adapter   │
       └────────────┘  └────────────┘  └────────────┘
```

## Key Types

### AgentAdapter Interface

```typescript
interface AgentAdapter {
  // Identity
  readonly id: string    // Unique identifier (e.g., 'claude-code')
  readonly name: string  // Display name (e.g., 'Claude Code')

  // Availability
  isAvailable(): Promise<boolean>
  getExecutablePath(): Promise<string | null>

  // Execution
  invoke(options: AgentInvokeOptions): AgentProcess
  parseOutput(stream: ReadableStream): AsyncIterable<AgentOutputEvent>

  // Limit detection
  detectRateLimit(output: string): boolean
  detectUsageLimit(output: string): UsageLimitResult
  detectAuthError(output: string): boolean

  // Auth & Usage
  validateAuth(): Promise<AuthValidationResult>
  checkUsageLimits(): Promise<UsageLimitCheckResult>
  getUsagePercentage(): Promise<UsagePercentageResult>

  // Models
  fetchAvailableModels(): Promise<AgentModelInfo[]>

  // Configuration
  getProjectConfigFiles(): string[]
  getCapabilities(): AgentCapabilities
}
```

### Supporting Types

```typescript
interface AgentInvokeOptions {
  workingDirectory: string
  prompt: string
  contextFiles?: string[]
  agentOptions?: {
    model?: string
    [key: string]: unknown
  }
}

interface AgentProcess {
  pid: number
  stdout: NodeJS.ReadableStream
  stderr: NodeJS.ReadableStream
  kill(): void
  wait(): Promise<{ exitCode: number }>
}

interface AgentOutputEvent {
  type: 'log' | 'error' | 'complete' | 'rate-limit' | 'usage-limit'
  message: string
  timestamp: Date
  resetAt?: Date  // For usage-limit events
}

interface UsageLimitResult {
  isUsageLimit: boolean
  resetAt?: Date
}

interface AuthValidationResult {
  isValid: boolean
  requiresReauth: boolean
  error?: string
}

interface AgentCapabilities {
  supportsSkills: boolean
  supportsProjectConfig: boolean
  supportsContextFiles: boolean
  supportsNonInteractiveMode: boolean
  supportsPauseResume: boolean
}
```

## BaseAgentAdapter

The `BaseAgentAdapter` abstract class provides shared functionality for all adapters, reducing code duplication.

### Location
`src/main/agents/adapters/base-adapter.ts`

### Shared Functionality

| Method | Purpose |
|--------|---------|
| `wrapChildProcess()` | Wraps ChildProcess as AgentProcess with consistent interface |
| `getExecutablePath()` | Finds CLI in PATH and known locations |
| `parseOutput()` | Async generator for line-by-line stream parsing |
| `parseLine()` | Parses JSON or plain text lines into events |
| `detectRateLimit()` | Detects rate limit patterns in output |
| `detectUsageLimit()` | Detects quota/billing limit patterns |
| `extractResetTime()` | Extracts reset time from error messages |
| `detectAuthError()` | Detects authentication failure patterns |
| `spawnProcess()` | Spawns process with logging and common setup |

### Abstract Methods (must implement)

```typescript
abstract readonly possiblePaths: string[]     // CLI install locations
abstract readonly cliCommand: string          // CLI command name
abstract readonly defaultModels: AgentModelInfo[]

abstract invoke(options: AgentInvokeOptions): AgentProcess
abstract validateAuth(): Promise<AuthValidationResult>
abstract checkUsageLimits(): Promise<UsageLimitCheckResult>
abstract getUsagePercentage(): Promise<UsagePercentageResult>
abstract fetchAvailableModels(): Promise<AgentModelInfo[]>
abstract getProjectConfigFiles(): string[]
abstract getCapabilities(): AgentCapabilities
```

## Supported Adapters

### Claude Code Adapter

**Location:** `src/main/agents/adapters/claude-code.ts`

Primary adapter for Anthropic's Claude Code CLI.

**Features:**
- OAuth token authentication (system keychain)
- Usage API for limit checking
- `chat()` method for planning sessions
- Model list fetching from Anthropic API

**CLI Arguments:**
```
claude -p --verbose --output-format stream-json --dangerously-skip-permissions [prompt]
```

### Gemini Adapter

**Location:** `src/main/agents/adapters/gemini.ts`

Adapter for Google's Gemini CLI.

**Features:**
- API key authentication (env or secure storage)
- Rate tier tracking (FREE, TIER_1, TIER_2, TIER_3)
- Local rate limit tracking
- Model list fetching from Google AI API

**CLI Arguments:**
```
gemini --model [model] --output-format stream-json -y [prompt]
```

### OpenRouter Adapter

**Location:** `src/main/agents/adapters/openrouter.ts`

Adapter for accessing multiple models via OpenRouter API.

**Features:**
- Requires both Claude CLI and OpenRouter CLI
- Credit-based billing
- Multi-provider model access
- Model list fetching from OpenRouter API

**Environment:**
```
ANTHROPIC_BASE_URL=http://localhost:4141/api/v1
OPENROUTER_API_KEY=[key]
```

## Agent Registry

Singleton that manages available agents.

### Location
`src/main/agents/registry.ts`

### Usage

```typescript
import { agentRegistry } from '../agents'

// Get specific adapter
const adapter = agentRegistry.getAdapter('claude-code')

// Get all available adapters
const available = await agentRegistry.getAvailableAdapters()

// Get default adapter
const defaultAdapter = agentRegistry.getDefaultAdapter()

// Get adapter for a specific task
const taskAdapter = agentRegistry.getAdapterForTask(task)
```

## Process Manager

Handles spawning and managing agent processes.

### Location
`src/main/agents/process-manager.ts`

### Responsibilities

- Spawn agent processes with correct arguments
- Stream output to log files
- Parse output events via adapter
- Handle process termination
- Detect rate/usage limits
- Track running processes
- Broadcast status updates via IPC

## Adding a New Agent

1. **Create adapter file** in `src/main/agents/adapters/`:

```typescript
// src/main/agents/adapters/new-agent.ts
import { BaseAgentAdapter } from './base-adapter'
import type { AgentCapabilities, AgentInvokeOptions, AgentProcess } from '@shared/types'

export class NewAgentAdapter extends BaseAgentAdapter {
  readonly id = 'new-agent'
  readonly name = 'New Agent'

  protected readonly cliCommand = 'newagent'
  protected readonly possiblePaths = [
    '/usr/local/bin/newagent',
    // ... other locations
  ]
  protected readonly defaultModels = [
    { id: 'default', name: 'Default Model', isDefault: true }
  ]

  invoke(options: AgentInvokeOptions): AgentProcess {
    const args = [/* ... */]
    return this.spawnProcess(this.cachedPath!, args, options)
  }

  // Implement remaining abstract methods...
}

export const newAgentAdapter = new NewAgentAdapter()
```

2. **Export from index** in `src/main/agents/adapters/index.ts`:

```typescript
export { NewAgentAdapter, newAgentAdapter } from './new-agent'
```

3. **Register in registry** in `src/main/agents/registry.ts`:

```typescript
import { newAgentAdapter } from './adapters'

// Add to adapters array
```

4. **Add agent ID** in `src/shared/types/agent.ts`:

```typescript
export const AGENT_IDS = {
  // ...
  NEW_AGENT: 'new-agent'
} as const
```

## Rate/Usage Limit Handling

Agents detect limits via pattern matching in output:

```typescript
// Rate limits (temporary, retry soon)
detectRateLimit(output: string): boolean {
  const lower = output.toLowerCase()
  return lower.includes('rate limit') ||
         lower.includes('429') ||
         lower.includes('too many requests')
}

// Usage limits (quota exceeded, wait longer)
detectUsageLimit(output: string): UsageLimitResult {
  const lower = output.toLowerCase()
  const isUsageLimit = lower.includes('quota exceeded') ||
                       lower.includes('billing') ||
                       lower.includes('out of credits')

  if (!isUsageLimit) return { isUsageLimit: false }

  const resetAt = this.extractResetTime(output)
  return { isUsageLimit: true, resetAt }
}
```

When detected:
1. Task marked as `failed` with specific error type
2. Usage limit store updated with reset time
3. Auto-run paused until limit clears
4. UI shows limit status and countdown

## Skills Integration

Skills modify agent behavior via prompt injection:

```typescript
interface Skill {
  id: string
  name: string
  description: string
  prompt: string      // Injected into agent prompt
  enabled: boolean
  isBuiltIn: boolean
}
```

Built-in skills include:
- TypeScript Expert
- React Best Practices
- Security Conscious
- Documentation Focus

## Relevant Files

| File | Purpose |
|------|---------|
| `src/shared/types/agent.ts` | AgentAdapter interface, types |
| `src/main/agents/adapters/base-adapter.ts` | Shared adapter base class |
| `src/main/agents/adapters/claude-code.ts` | Claude Code implementation |
| `src/main/agents/adapters/gemini.ts` | Gemini implementation |
| `src/main/agents/adapters/openrouter.ts` | OpenRouter implementation |
| `src/main/agents/registry.ts` | Agent registry singleton |
| `src/main/agents/process-manager.ts` | Process management |
| `src/main/agents/planning-manager.ts` | Planning session management |
| `src/main/ipc/agent-handlers.ts` | IPC handlers for agent ops |
| `src/main/storage/secure-store.ts` | API key storage |
