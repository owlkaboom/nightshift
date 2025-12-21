/**
 * IPC handlers for system operations
 */

import { ipcMain, dialog, shell, app } from 'electron'
import { getStorageStatus } from '@main/storage'
import { broadcastStartupProgress } from '@main/utils/broadcast'
import { showTestNotification, previewNotificationSound } from '@main/notifications/notification-service'
import { getSoundsDir } from '@main/utils/paths'
import { copyFile, mkdir, readFile } from 'fs/promises'
import { join } from 'path'
import { logger } from '@main/utils/logger'
import { updateConfig } from '@main/storage/config-store'
import { getMainWindow } from '@main/window'

// Startup status state
export interface StartupStatus {
  stage: string
  message: string
  complete: boolean
}

let currentStartupStatus: StartupStatus = {
  stage: 'initializing',
  message: 'Starting up...',
  complete: false
}

/**
 * Generate a random alphanumeric ID
 * @param length - Length of the ID to generate
 * @returns Random alphanumeric string (uppercase and lowercase letters + numbers)
 */
function generateAlphaId(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Update and broadcast startup status
 */
export function setStartupStatus(status: Partial<StartupStatus>): void {
  currentStartupStatus = { ...currentStartupStatus, ...status }
  broadcastStartupProgress(currentStartupStatus)
}

/**
 * Mark startup as complete
 */
export function completeStartup(): void {
  setStartupStatus({ stage: 'complete', message: 'Ready!', complete: true })
}

export function registerSystemHandlers(): void {
  // Get current startup status
  ipcMain.handle('system:getStartupStatus', async (): Promise<StartupStatus> => {
    return currentStartupStatus
  })
  // Open directory selection dialog
  ipcMain.handle('system:selectDirectory', async (): Promise<string | null> => {
    const mainWindow = getMainWindow()
    if (!mainWindow) {
      throw new Error('Main window not available')
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  // Open file selection dialog
  ipcMain.handle(
    'system:selectFile',
    async (_, filters?: Electron.FileFilter[]): Promise<string | null> => {
      const mainWindow = getMainWindow()
      if (!mainWindow) {
        throw new Error('Main window not available')
      }

      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: filters || []
      })

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }

      return result.filePaths[0]
    }
  )

  // Open external URL in default browser
  ipcMain.handle('system:openExternal', async (_, url: string): Promise<void> => {
    await shell.openExternal(url)
  })

  // Open a path in the system file manager
  ipcMain.handle('system:openPath', async (_, path: string): Promise<void> => {
    await shell.openPath(path)
  })

  // Get app version
  ipcMain.handle('system:getVersion', async (): Promise<string> => {
    return app.getVersion()
  })

  // Get platform
  ipcMain.handle('system:getPlatform', async (): Promise<NodeJS.Platform> => {
    return process.platform
  })

  // Get storage status (for debugging)
  ipcMain.handle('system:getStorageStatus', async () => {
    return getStorageStatus()
  })

  // Test notification
  ipcMain.handle('system:testNotification', async (): Promise<void> => {
    await showTestNotification()
  })

  // Preview notification sound
  ipcMain.handle('system:previewNotificationSound', async (_, soundName: string, customPath?: string): Promise<void> => {
    await previewNotificationSound(soundName, customPath)
  })

  // Open the changelog file
  ipcMain.handle('system:openChangelog', async (): Promise<void> => {
    // In development, use the project root. In production, use the app resources directory
    const isDev = !app.isPackaged
    const changelogPath = isDev
      ? join(app.getAppPath(), 'CHANGELOG.md')
      : join(process.resourcesPath, 'CHANGELOG.md')

    await shell.openPath(changelogPath)
  })

  // Get changelog content
  ipcMain.handle('system:getChangelog', async (): Promise<string> => {
    const isDev = !app.isPackaged
    const changelogPath = isDev
      ? join(app.getAppPath(), 'CHANGELOG.md')
      : join(process.resourcesPath, 'CHANGELOG.md')

    try {
      const content = await readFile(changelogPath, 'utf-8')
      // Skip the header and preamble, start from the first version section
      const versionStart = content.indexOf('\n## [')
      if (versionStart !== -1) {
        return content.slice(versionStart + 1) // +1 to skip the leading newline
      }
      return content
    } catch {
      return '# Changelog\n\nNo changelog available.'
    }
  })

  // Copy notification sound to app directory
  ipcMain.handle('system:copyNotificationSound', async (_, sourcePath: string): Promise<string> => {
    try {
      // Ensure sounds directory exists
      const soundsDir = getSoundsDir()
      await mkdir(soundsDir, { recursive: true })

      // Extract the original filename without extension
      const originalFilename = sourcePath.split(/[/\\]/).pop() || 'custom-notification'
      const ext = originalFilename.split('.').pop()
      const nameWithoutExt = originalFilename.substring(0, originalFilename.lastIndexOf('.')) || originalFilename

      // Generate a random alphanumeric ID (8 characters)
      const alphaId = generateAlphaId(8)

      // Create filename: originalName-ALPHAID.ext
      const filename = `${nameWithoutExt}-${alphaId}.${ext}`
      const destPath = join(soundsDir, filename)

      // Copy the file
      await copyFile(sourcePath, destPath)

      logger.debug('[SystemHandlers] Copied notification sound:', sourcePath, '->', destPath)

      return destPath
    } catch (error) {
      console.error('[SystemHandlers] Error copying notification sound:', error)
      throw error
    }
  })

  // Open logs folder in system file manager
  ipcMain.handle('system:openLogsFolder', async (): Promise<void> => {
    const logsDir = logger.getLogsDir()
    await shell.openPath(logsDir)
  })

  // Get debug logging status
  ipcMain.handle('system:getDebugLogging', async (): Promise<boolean> => {
    return logger.isDebugEnabled()
  })

  // Set debug logging status
  ipcMain.handle('system:setDebugLogging', async (_, enabled: boolean): Promise<void> => {
    logger.setDebugEnabled(enabled)
    // Persist to config
    await updateConfig({ debugLogging: enabled })
  })
}
