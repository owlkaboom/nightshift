/**
 * IPC handlers for configuration operations
 */

import { ipcMain } from 'electron'
import type { AppConfig } from '@shared/types'
import { logger } from '@main/utils/logger'
import {
  loadConfig,
  updateConfig,
  resetConfig,
  getClaudeCodePath,
  setClaudeCodePath,
  getSelectedProjectId,
  setSelectedProjectId
} from '@main/storage'
import { processManager } from '@main/agents/process-manager'
import { initializeVault } from '@main/storage/vault/vault-store'

/**
 * Sync the processManager settings with the config values
 */
function syncProcessManagerWithConfig(config: AppConfig): void {
  processManager.setMaxConcurrent(config.maxConcurrentTasks)
  processManager.setMaxTaskDuration(config.maxTaskDurationMinutes)
}

export async function registerConfigHandlers(): Promise<void> {
  // Initialize processManager with config value on startup
  const initialConfig = await loadConfig()
  syncProcessManagerWithConfig(initialConfig)
  logger.debug(
    '[Config] Initialized processManager maxConcurrent:',
    initialConfig.maxConcurrentTasks
  )

  // Initialize vault if path is configured
  if (initialConfig.vaultPath) {
    try {
      await initializeVault(initialConfig.vaultPath)
      logger.debug('[Config] Initialized vault at:', initialConfig.vaultPath)
    } catch (error) {
      console.error('[Config] Failed to initialize vault:', error)
    }
  } else {
    logger.debug('[Config] Vault path not configured - notes will require vault setup')
  }

  // Get full configuration
  ipcMain.handle('config:get', async (): Promise<AppConfig> => {
    return loadConfig()
  })

  // Update configuration
  ipcMain.handle(
    'config:update',
    async (_, updates: Partial<AppConfig>): Promise<AppConfig> => {
      const updated = await updateConfig(updates)
      // Sync processManager if relevant settings were updated
      if (updates.maxConcurrentTasks !== undefined || updates.maxTaskDurationMinutes !== undefined) {
        syncProcessManagerWithConfig(updated)
        logger.debug(
          '[Config] Updated processManager settings:',
          `maxConcurrent=${updated.maxConcurrentTasks}, maxDuration=${updated.maxTaskDurationMinutes}min`
        )
      }
      // Re-initialize vault if path was updated
      if (updates.vaultPath !== undefined) {
        if (updated.vaultPath) {
          try {
            await initializeVault(updated.vaultPath)
            logger.debug('[Config] Re-initialized vault at:', updated.vaultPath)
          } catch (error) {
            console.error('[Config] Failed to re-initialize vault:', error)
            throw error
          }
        } else {
          logger.debug('[Config] Vault path cleared')
        }
      }
      return updated
    }
  )

  // Reset configuration to defaults
  ipcMain.handle('config:reset', async (): Promise<AppConfig> => {
    const config = await resetConfig()
    syncProcessManagerWithConfig(config)
    logger.debug(
      '[Config] Reset processManager maxConcurrent:',
      config.maxConcurrentTasks
    )
    return config
  })

  // Get Claude Code executable path
  ipcMain.handle('config:getClaudeCodePath', async (): Promise<string> => {
    return getClaudeCodePath()
  })

  // Set Claude Code executable path
  ipcMain.handle(
    'config:setClaudeCodePath',
    async (_, path: string): Promise<void> => {
      await setClaudeCodePath(path)
    }
  )

  // Get selected project ID
  ipcMain.handle('config:getSelectedProjectId', async (): Promise<string | null> => {
    return getSelectedProjectId()
  })

  // Set selected project ID
  ipcMain.handle(
    'config:setSelectedProjectId',
    async (_, projectId: string | null): Promise<void> => {
      await setSelectedProjectId(projectId)
    }
  )
}
