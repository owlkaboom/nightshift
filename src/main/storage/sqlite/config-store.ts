/**
 * SQLite Config Store
 *
 * High-performance configuration storage using SQLite.
 * Maintains same API as the file-based config store for compatibility.
 */

import type { AppConfig } from '@shared/types'
import { DEFAULT_CONFIG } from '@shared/types'
import { getDatabase } from '@main/storage/database'

// ============ Type Conversions ============

interface ConfigRow {
  id: number
  claude_code_path: string
  selected_agent_id: string
  agents: string
  max_concurrent_tasks: number
  max_task_duration_minutes: number
  rate_limit_check_interval_seconds: number
  auto_play_usage_threshold: number
  default_scan_paths: string
  theme: string
  notifications: string
  sync: string
  archive_retention_days: number
  vault_path: string | null
  selected_project_id: string | null
  debug_logging: number
}

function rowToConfig(row: ConfigRow): AppConfig {
  return {
    claudeCodePath: row.claude_code_path,
    selectedAgentId: row.selected_agent_id as AppConfig['selectedAgentId'],
    agents: JSON.parse(row.agents),
    maxConcurrentTasks: row.max_concurrent_tasks,
    maxTaskDurationMinutes: row.max_task_duration_minutes,
    rateLimitCheckIntervalSeconds: row.rate_limit_check_interval_seconds,
    autoPlayUsageThreshold: row.auto_play_usage_threshold,
    defaultScanPaths: JSON.parse(row.default_scan_paths),
    theme: row.theme,
    notifications: JSON.parse(row.notifications),
    sync: JSON.parse(row.sync),
    archiveRetentionDays: row.archive_retention_days,
    vaultPath: row.vault_path,
    selectedProjectId: row.selected_project_id,
    debugLogging: row.debug_logging === 1
  }
}

function configToParams(config: AppConfig): Record<string, unknown> {
  return {
    claude_code_path: config.claudeCodePath,
    selected_agent_id: config.selectedAgentId,
    agents: JSON.stringify(config.agents),
    max_concurrent_tasks: config.maxConcurrentTasks,
    max_task_duration_minutes: config.maxTaskDurationMinutes,
    rate_limit_check_interval_seconds: config.rateLimitCheckIntervalSeconds,
    auto_play_usage_threshold: config.autoPlayUsageThreshold,
    default_scan_paths: JSON.stringify(config.defaultScanPaths),
    theme: config.theme,
    notifications: JSON.stringify(config.notifications),
    sync: JSON.stringify(config.sync),
    archive_retention_days: config.archiveRetentionDays,
    vault_path: config.vaultPath,
    selected_project_id: config.selectedProjectId,
    debug_logging: config.debugLogging ? 1 : 0
  }
}

// ============ Core Operations ============

/**
 * Load the application configuration
 */
export async function loadConfig(): Promise<AppConfig> {
  const db = getDatabase()
  const row = db
    .prepare('SELECT * FROM config WHERE id = 1')
    .get() as ConfigRow | undefined

  if (!row) {
    // Initialize with defaults
    await saveConfig(DEFAULT_CONFIG)
    return DEFAULT_CONFIG
  }

  const stored = rowToConfig(row)

  // Deep merge with defaults to handle missing fields
  return {
    ...DEFAULT_CONFIG,
    ...stored,
    agents: {
      ...DEFAULT_CONFIG.agents,
      ...(stored.agents || {})
    },
    notifications: {
      ...DEFAULT_CONFIG.notifications,
      ...(stored.notifications || {})
    },
    sync: {
      ...DEFAULT_CONFIG.sync,
      ...(stored.sync || {})
    }
  }
}

/**
 * Save the application configuration
 */
export async function saveConfig(config: AppConfig): Promise<void> {
  const db = getDatabase()
  const params = configToParams(config)

  db.prepare(`
    INSERT OR REPLACE INTO config (
      id,
      claude_code_path,
      selected_agent_id,
      agents,
      max_concurrent_tasks,
      max_task_duration_minutes,
      rate_limit_check_interval_seconds,
      auto_play_usage_threshold,
      default_scan_paths,
      theme,
      notifications,
      sync,
      archive_retention_days,
      vault_path,
      selected_project_id,
      debug_logging
    ) VALUES (
      1,
      @claude_code_path,
      @selected_agent_id,
      @agents,
      @max_concurrent_tasks,
      @max_task_duration_minutes,
      @rate_limit_check_interval_seconds,
      @auto_play_usage_threshold,
      @default_scan_paths,
      @theme,
      @notifications,
      @sync,
      @archive_retention_days,
      @vault_path,
      @selected_project_id,
      @debug_logging
    )
  `).run(params)
}

/**
 * Update specific configuration fields
 */
export async function updateConfig(
  updates: Partial<AppConfig>
): Promise<AppConfig> {
  const current = await loadConfig()
  const updated = { ...current, ...updates }
  await saveConfig(updated)
  return updated
}

/**
 * Get a specific config value
 */
export async function getConfigValue<K extends keyof AppConfig>(
  key: K
): Promise<AppConfig[K]> {
  const config = await loadConfig()
  return config[key]
}

/**
 * Set a specific config value
 */
export async function setConfigValue<K extends keyof AppConfig>(
  key: K,
  value: AppConfig[K]
): Promise<void> {
  await updateConfig({ [key]: value } as Partial<AppConfig>)
}

/**
 * Reset configuration to defaults
 */
export async function resetConfig(): Promise<AppConfig> {
  await saveConfig(DEFAULT_CONFIG)
  return DEFAULT_CONFIG
}

/**
 * Get the Claude Code executable path
 */
export async function getClaudeCodePath(): Promise<string> {
  return getConfigValue('claudeCodePath')
}

/**
 * Set the Claude Code executable path
 */
export async function setClaudeCodePath(path: string): Promise<void> {
  await setConfigValue('claudeCodePath', path)
}

/**
 * Get the selected project ID
 */
export async function getSelectedProjectId(): Promise<string | null> {
  return getConfigValue('selectedProjectId')
}

/**
 * Set the selected project ID
 */
export async function setSelectedProjectId(projectId: string | null): Promise<void> {
  await setConfigValue('selectedProjectId', projectId)
}
