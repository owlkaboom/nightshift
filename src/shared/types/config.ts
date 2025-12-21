/**
 * Configuration types for Nightshift
 */

import type { ProjectEcosystemInfo } from './project'
import type { AgentId } from './agent'

/**
 * Theme options - matches theme IDs from themes.ts
 * 'system' is a special value that auto-selects based on OS preference
 */
export type Theme = string // Theme ID from themes.ts or 'system'

/**
 * Agent-specific configuration (non-sensitive settings)
 * Sensitive data like API keys are stored in secure storage, not here
 */
export interface AgentConfig {
  /** Whether this agent is enabled */
  enabled: boolean

  /** Custom executable path (optional, overrides auto-detection) */
  customPath?: string

  /** Agent-specific tier or plan (e.g., 'free', 'tier_1' for Gemini) */
  tier?: string

  /** Additional agent-specific settings */
  settings?: Record<string, unknown>
}

/**
 * Agent configuration by agent ID
 */
export type AgentConfigs = {
  [K in AgentId]?: AgentConfig
}

/**
 * Built-in notification sounds available on macOS
 */
export type DefaultNotificationSound =
  | 'Hero'
  | 'Glass'
  | 'Ping'
  | 'Pop'
  | 'Purr'
  | 'Submarine'
  | 'Tink'
  | 'custom'

/**
 * Notification settings
 */
export interface NotificationSettings {
  /** Whether desktop notifications are enabled */
  enabled: boolean

  /** Whether to play sound with notifications */
  sound: boolean

  /** Selected default sound or 'custom' to use customSoundPath */
  defaultSound: DefaultNotificationSound

  /** Path to custom sound file (used when defaultSound is 'custom') */
  customSoundPath: string | null
}

/**
 * Cloud sync settings (Phase 4)
 */
export interface SyncSettings {
  /** Whether sync is enabled */
  enabled: boolean

  /** Sync provider (google-drive, etc.) */
  provider: string | null

  /** Last successful sync timestamp */
  lastSyncedAt: string | null
}

/**
 * Global config stored in ~/.nightshift/config.json (local-only)
 */
export interface AppConfig {
  /** Path to Claude Code CLI executable (legacy, prefer agents config) */
  claudeCodePath: string

  /** Selected default agent ID */
  selectedAgentId: AgentId

  /** Per-agent configuration */
  agents: AgentConfigs

  /** Maximum concurrent tasks (global default) */
  maxConcurrentTasks: number

  /** Maximum duration (in minutes) for a single task before auto-timeout */
  maxTaskDurationMinutes: number

  /** Interval (seconds) to check for rate limit recovery */
  rateLimitCheckIntervalSeconds: number

  /** Usage percentage threshold (0-100) at which to pause auto-play */
  autoPlayUsageThreshold: number

  /** Default directories to scan for projects */
  defaultScanPaths: string[]

  /** UI theme */
  theme: Theme

  /** Notification preferences */
  notifications: NotificationSettings

  /** Cloud sync settings (Phase 4) */
  sync: SyncSettings

  /** Days to keep completed/rejected tasks before auto-archive */
  archiveRetentionDays: number

  /** Path to markdown vault for notes (null = unconfigured) */
  vaultPath: string | null

  /** Last selected project ID (persisted across app restarts) */
  selectedProjectId: string | null

  /** Enable verbose debug logging */
  debugLogging: boolean
}

/**
 * Integration credentials (stored in local-state.json)
 */
export interface IntegrationCredentials {
  jira?: {
    baseUrl: string
    email: string
    token: string
  }
  github?: {
    token: string
  }
  gitlab?: {
    baseUrl: string
    token: string
  }
}

/**
 * Local state stored in ~/.nightshift/local-state.json (machine-specific)
 */
export interface LocalState {
  /** Machine identifier for multi-machine sync */
  machineId: string

  /** DEPRECATED: Project paths are now stored on the Project object directly */
  projectPaths: Record<string, string>

  /** Claude Code ecosystem info per project */
  claudeCodeEcosystem: {
    [projectId: string]: ProjectEcosystemInfo
  }

  /** Integration credentials */
  integrations: IntegrationCredentials
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: AppConfig = {
  claudeCodePath: '/usr/local/bin/claude',
  selectedAgentId: 'claude-code',
  agents: {
    'claude-code': { enabled: true },
    gemini: { enabled: true, tier: 'free' },
    openrouter: { enabled: false }
  },
  maxConcurrentTasks: 1, // Start with sequential for MVP
  maxTaskDurationMinutes: 15, // Default timeout for runaway tasks
  rateLimitCheckIntervalSeconds: 300,
  autoPlayUsageThreshold: 92, // Pause auto-play when usage exceeds this percentage
  defaultScanPaths: ['~/dev', '~/projects'],
  theme: 'dark',
  notifications: {
    enabled: true,
    sound: true,
    defaultSound: 'Hero',
    customSoundPath: null
  },
  sync: {
    enabled: false,
    provider: null,
    lastSyncedAt: null
  },
  archiveRetentionDays: 30,
  vaultPath: null,
  selectedProjectId: null,
  debugLogging: false
}

/**
 * Default local state values
 */
export function createDefaultLocalState(machineId: string): LocalState {
  return {
    machineId,
    projectPaths: {},
    claudeCodeEcosystem: {},
    integrations: {}
  }
}

/**
 * Generate a machine ID
 */
export function generateMachineId(): string {
  return `machine_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}
