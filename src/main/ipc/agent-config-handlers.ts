/**
 * IPC handlers for agent configuration operations
 *
 * Handles agent selection, API key storage, and per-agent settings.
 * API keys are stored securely using Electron's safeStorage API.
 */

import { ipcMain } from 'electron'
import type { AgentConfigInfo, SecureStorageInfo } from '@shared/ipc-types'
import type { AgentConfig, AgentId } from '@shared/types'
import { AGENT_IDS } from '@shared/types'
import { logger } from '@main/utils/logger'
import {
  loadConfig,
  updateConfig,
  isEncryptionAvailable,
  getStorageBackend,
  setAgentApiKey,
  deleteAgentApiKey,
  hasAgentApiKey
} from '@main/storage'
import { agentRegistry } from '@main/agents/registry'

/**
 * Agents that require an API key to function
 * Claude Code uses OAuth, so it doesn't need an API key stored here
 */
const AGENTS_REQUIRING_API_KEY: Set<string> = new Set([AGENT_IDS.GEMINI, AGENT_IDS.OPENROUTER])

/**
 * Build AgentConfigInfo for a given agent ID
 */
async function buildAgentConfigInfo(agentId: string): Promise<AgentConfigInfo | null> {
  const adapter = agentRegistry.get(agentId)
  if (!adapter) {
    return null
  }

  const config = await loadConfig()
  const agentConfig = config.agents[agentId as AgentId] || { enabled: false }

  const [available, executablePath, hasKey] = await Promise.all([
    adapter.isAvailable(),
    adapter.getExecutablePath(),
    hasAgentApiKey(agentId)
  ])

  return {
    id: adapter.id,
    name: adapter.name,
    enabled: agentConfig.enabled ?? false,
    available,
    hasApiKey: hasKey,
    requiresApiKey: AGENTS_REQUIRING_API_KEY.has(agentId),
    tier: agentConfig.tier,
    customPath: agentConfig.customPath,
    executablePath,
    capabilities: adapter.getCapabilities()
  }
}

/**
 * Validate an API key for a specific agent
 * This performs a lightweight validation (format check, test API call if possible)
 */
async function validateApiKey(
  agentId: string,
  apiKey: string
): Promise<{ valid: boolean; error?: string }> {
  if (!apiKey || apiKey.trim() === '') {
    return { valid: false, error: 'API key cannot be empty' }
  }

  // Agent-specific validation
  switch (agentId) {
    case AGENT_IDS.GEMINI: {
      // Gemini API keys should start with "AI" and be 39 characters
      if (!apiKey.startsWith('AI') || apiKey.length !== 39) {
        return {
          valid: false,
          error: 'Invalid Gemini API key format. Keys should start with "AI" and be 39 characters.'
        }
      }

      // Optionally: Make a test API call to validate the key
      // For now, we just validate the format
      // In the future, we could call the Gemini API to verify
      return { valid: true }
    }

    case AGENT_IDS.CLAUDE_CODE: {
      // Claude Code typically uses OAuth, not API keys
      // If someone wants to store one anyway, just accept it
      return { valid: true }
    }

    case AGENT_IDS.OPENROUTER: {
      // OpenRouter API keys start with "sk-or-" and are typically 67 characters
      if (!apiKey.startsWith('sk-or-')) {
        return {
          valid: false,
          error: 'Invalid OpenRouter API key format. Keys should start with "sk-or-"'
        }
      }
      if (apiKey.length < 30) {
        return {
          valid: false,
          error: 'OpenRouter API key appears too short'
        }
      }
      return { valid: true }
    }

    default:
      // Unknown agent, accept any non-empty key
      return { valid: true }
  }
}

export async function registerAgentConfigHandlers(): Promise<void> {
  // List all agent configurations
  ipcMain.handle('agentConfig:list', async (): Promise<AgentConfigInfo[]> => {
    const adapters = agentRegistry.getAll()
    const results: AgentConfigInfo[] = []

    for (const adapter of adapters) {
      const info = await buildAgentConfigInfo(adapter.id)
      if (info) {
        results.push(info)
      }
    }

    return results
  })

  // Get specific agent configuration
  ipcMain.handle(
    'agentConfig:get',
    async (_, agentId: string): Promise<AgentConfigInfo | null> => {
      return buildAgentConfigInfo(agentId)
    }
  )

  // Get selected agent ID
  ipcMain.handle('agentConfig:getSelected', async (): Promise<string> => {
    const config = await loadConfig()
    return config.selectedAgentId
  })

  // Set selected agent ID
  ipcMain.handle('agentConfig:setSelected', async (_, agentId: string): Promise<void> => {
    const adapter = agentRegistry.get(agentId)
    if (!adapter) {
      throw new Error(`Unknown agent: ${agentId}`)
    }

    // Check if agent is available
    const available = await adapter.isAvailable()
    if (!available) {
      throw new Error(`Agent '${adapter.name}' is not available. Please install it first.`)
    }

    // Check if agent requires API key
    if (AGENTS_REQUIRING_API_KEY.has(agentId)) {
      const hasKey = await hasAgentApiKey(agentId)
      if (!hasKey) {
        throw new Error(`Agent '${adapter.name}' requires an API key. Please add one first.`)
      }
    }

    await updateConfig({ selectedAgentId: agentId as AgentId })

    // Update the registry's default adapter
    agentRegistry.setDefault(agentId)

    logger.debug(`[AgentConfig] Selected agent changed to: ${agentId}`)
  })

  // Set agent enabled state
  ipcMain.handle(
    'agentConfig:setEnabled',
    async (_, agentId: string, enabled: boolean): Promise<void> => {
      const config = await loadConfig()
      const currentAgentConfig = config.agents[agentId as AgentId] || { enabled: false }

      const updatedAgents = {
        ...config.agents,
        [agentId]: { ...currentAgentConfig, enabled }
      }

      await updateConfig({ agents: updatedAgents })
      logger.debug(`[AgentConfig] Agent '${agentId}' enabled: ${enabled}`)
    }
  )

  // Set agent API key (securely stored)
  ipcMain.handle(
    'agentConfig:setApiKey',
    async (_, agentId: string, apiKey: string): Promise<void> => {
      // Validate the API key first
      const validation = await validateApiKey(agentId, apiKey)
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid API key')
      }

      await setAgentApiKey(agentId, apiKey)
      logger.debug(`[AgentConfig] API key stored for agent: ${agentId}`)
    }
  )

  // Delete agent API key
  ipcMain.handle('agentConfig:deleteApiKey', async (_, agentId: string): Promise<void> => {
    await deleteAgentApiKey(agentId)
    logger.debug(`[AgentConfig] API key deleted for agent: ${agentId}`)
  })

  // Check if agent has API key stored
  ipcMain.handle('agentConfig:hasApiKey', async (_, agentId: string): Promise<boolean> => {
    return hasAgentApiKey(agentId)
  })

  // Set agent tier
  ipcMain.handle(
    'agentConfig:setTier',
    async (_, agentId: string, tier: string): Promise<void> => {
      const config = await loadConfig()
      const currentAgentConfig: AgentConfig = config.agents[agentId as AgentId] || {
        enabled: false
      }

      const updatedAgents = {
        ...config.agents,
        [agentId]: { ...currentAgentConfig, tier }
      }

      await updateConfig({ agents: updatedAgents })
      logger.debug(`[AgentConfig] Agent '${agentId}' tier set to: ${tier}`)
    }
  )

  // Set agent custom executable path
  ipcMain.handle(
    'agentConfig:setCustomPath',
    async (_, agentId: string, path: string | null): Promise<void> => {
      const config = await loadConfig()
      const currentAgentConfig: AgentConfig = config.agents[agentId as AgentId] || {
        enabled: false
      }

      const updatedConfig: AgentConfig = { ...currentAgentConfig }
      if (path) {
        updatedConfig.customPath = path
      } else {
        delete updatedConfig.customPath
      }

      const updatedAgents = {
        ...config.agents,
        [agentId]: updatedConfig
      }

      await updateConfig({ agents: updatedAgents })

      // Update the adapter's custom path immediately
      const adapter = agentRegistry.get(agentId)
      if (adapter) {
        adapter.setCustomPath(path)
      }

      logger.debug(`[AgentConfig] Agent '${agentId}' custom path set to: ${path || '(auto-detect)'}`)
    }
  )

  // Test agent CLI executable
  ipcMain.handle(
    'agentConfig:testCli',
    async (_, agentId: string): Promise<{ success: boolean; version?: string; error?: string }> => {
      const adapter = agentRegistry.get(agentId)
      if (!adapter) {
        return { success: false, error: `Unknown agent: ${agentId}` }
      }

      return adapter.testCli()
    }
  )

  // Set agent-specific setting (stored in settings object)
  ipcMain.handle(
    'agentConfig:setSetting',
    async (_, agentId: string, key: string, value: unknown): Promise<void> => {
      const config = await loadConfig()
      const currentAgentConfig: AgentConfig = config.agents[agentId as AgentId] || {
        enabled: false
      }

      const updatedConfig: AgentConfig = {
        ...currentAgentConfig,
        settings: {
          ...(currentAgentConfig.settings || {}),
          [key]: value
        }
      }

      const updatedAgents = {
        ...config.agents,
        [agentId]: updatedConfig
      }

      await updateConfig({ agents: updatedAgents })
      logger.debug(`[AgentConfig] Agent '${agentId}' setting '${key}' set to: ${value}`)
    }
  )

  // Get agent-specific setting
  ipcMain.handle(
    'agentConfig:getSetting',
    async (_, agentId: string, key: string): Promise<unknown> => {
      const config = await loadConfig()
      const agentConfig = config.agents[agentId as AgentId]
      return agentConfig?.settings?.[key]
    }
  )

  // Validate API key
  ipcMain.handle(
    'agentConfig:validateApiKey',
    async (
      _,
      agentId: string,
      apiKey: string
    ): Promise<{ valid: boolean; error?: string }> => {
      return validateApiKey(agentId, apiKey)
    }
  )

  // Get secure storage info
  ipcMain.handle('agentConfig:getSecureStorageInfo', async (): Promise<SecureStorageInfo> => {
    return {
      isEncryptionAvailable: isEncryptionAvailable(),
      storageBackend: getStorageBackend()
    }
  })

  logger.debug('[AgentConfig] Handlers registered')
}

/**
 * Initialize agent configuration on app startup
 * Sets the registry's default agent based on config and loads custom paths
 */
export async function initializeAgentConfig(): Promise<void> {
  const config = await loadConfig()

  // Load custom paths for all agents from config
  const adapters = agentRegistry.getAll()
  for (const adapter of adapters) {
    const agentConfig = config.agents[adapter.id as AgentId]
    if (agentConfig?.customPath) {
      adapter.setCustomPath(agentConfig.customPath)
      logger.debug(`[AgentConfig] Loaded custom path for '${adapter.id}': ${agentConfig.customPath}`)
    }
  }

  // Set the default agent in the registry
  const selectedAgent = config.selectedAgentId
  if (selectedAgent && agentRegistry.get(selectedAgent)) {
    try {
      agentRegistry.setDefault(selectedAgent)
      logger.debug(`[AgentConfig] Initialized default agent: ${selectedAgent}`)
    } catch (error) {
      console.warn(`[AgentConfig] Failed to set default agent '${selectedAgent}':`, error)
    }
  }
}
