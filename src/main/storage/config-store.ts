/**
 * Configuration store for ~/.nightshift/config.json
 */

import type { AppConfig } from '@shared/types'
import { DEFAULT_CONFIG } from '@shared/types'
import { getConfigPath } from '@main/utils/paths'
import { readJsonWithDefault, writeJson } from './file-store'

/**
 * Load the application configuration
 * Merges stored config with defaults to handle missing fields from older configs
 */
export async function loadConfig(): Promise<AppConfig> {
  const path = getConfigPath()
  const stored = await readJsonWithDefault(path, DEFAULT_CONFIG)

  // Deep merge with defaults to handle missing fields from older config versions
  return {
    ...DEFAULT_CONFIG,
    ...stored,
    // Ensure nested objects are properly merged
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
  const path = getConfigPath()
  await writeJson(path, config)
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
