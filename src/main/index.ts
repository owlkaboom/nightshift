import { app, BrowserWindow, session, shell } from 'electron'
import { join } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { createWindow } from './window'
import { initializeStorage, getStorageStatus } from './storage'
import { registerIpcHandlers } from './ipc'
import { needsMigration, migrateFromWorktrees } from './migration/v2-migration'
import { cleanupExpiredTasks } from './storage/retention-service'
import { cleanupOrphanedTaskLogs } from './storage/orphaned-logs-cleanup'
import { loadWhisperModel, ensureWhisperDeps } from './whisper/whisper-service'
import { initializeLogger, closeLogger, logger } from './utils/logger'
import { setStartupStatus, completeStartup } from './ipc/system-handlers'
import { initializeNotificationService } from './notifications/notification-service'

app.whenReady().then(async () => {
  // Initialize file logger early to capture all startup logs
  initializeLogger()
  console.log('Nightshift starting...')

  // Set app user model id for Windows
  electronApp.setAppUserModelId('com.nightshift.app')

  // Handle microphone permissions for speech recognition
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    // Allow microphone access for speech recognition
    if (permission === 'media') {
      callback(true)
      return
    }
    // Allow other common permissions
    if (['clipboard-read', 'clipboard-sanitized-write'].includes(permission)) {
      callback(true)
      return
    }
    // Deny unknown permissions by default
    callback(false)
  })

  // Also handle permission checks (for Chrome's permission API)
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === 'media') {
      return true
    }
    return false
  })

  // Set dock icon on macOS (only needed for dev mode - production uses app bundle icon)
  if (is.dev && process.platform === 'darwin' && app.dock) {
    try {
      const iconPath = join(__dirname, '../../build/icon.png')
      app.dock.setIcon(iconPath)
    } catch {
      // Ignore icon loading errors - dock will use default icon
    }
  }

  // Initialize storage layer
  setStartupStatus({ stage: 'storage', message: 'Initializing database...' })
  try {
    await initializeStorage()
    const status = await getStorageStatus()
    logger.debug('Storage initialized:', status)

    // Load config and set debug logging mode
    const { loadConfig } = await import('./storage/config-store')
    const config = await loadConfig()
    logger.setDebugEnabled(config.debugLogging)
  } catch (error) {
    console.error('Failed to initialize storage:', error)
  }

  // Run v2 migration if needed (worktree removal)
  try {
    if (await needsMigration()) {
      setStartupStatus({ stage: 'migration', message: 'Running migrations...' })
      logger.debug('Running v2 migration (worktree removal)...')
      const result = await migrateFromWorktrees()
      logger.debug('Migration result:', result.message)
      if (result.details.length > 0) {
        result.details.forEach((d) => logger.debug('  ', d))
      }
    }
  } catch (error) {
    console.error('Migration error (non-fatal):', error)
  }

  // Register IPC handlers (needed before groups-to-tags migration)
  setStartupStatus({ stage: 'ipc', message: 'Setting up communication...' })
  await registerIpcHandlers()
  logger.debug('IPC handlers registered')

  // Initialize notification service
  await initializeNotificationService()
  logger.debug('Notification service initialized')

  // Run retention cleanup (delete old completed tasks)
  // Non-blocking - errors are logged but don't fail startup
  cleanupExpiredTasks().catch((err) => {
    console.error('[Startup] Retention cleanup failed:', err)
  })

  // Clean up orphaned task logs (logs for tasks that no longer exist in database)
  // Non-blocking - errors are logged but don't fail startup
  cleanupOrphanedTaskLogs().catch((err) => {
    console.error('[Startup] Orphaned logs cleanup failed:', err)
  })

  // Ensure Whisper dependencies are installed, then preload model (non-blocking)
  // This installs deps on first run and ensures the model is ready for recording
  setStartupStatus({ stage: 'whisper', message: 'Preparing voice recognition...' })
  ensureWhisperDeps((msg) => {
    logger.debug('[Whisper]', msg)
    setStartupStatus({ stage: 'whisper', message: msg })
  })
    .then(async (available) => {
      if (available) {
        setStartupStatus({ stage: 'whisper', message: 'Loading speech model...' })
        await loadWhisperModel('tiny.en')
        logger.debug('Whisper model preloaded')
      } else {
        logger.debug('[Whisper] Dependencies not available, skipping model preload')
      }
      // Mark startup complete after whisper is done (or skipped)
      completeStartup()
    })
    .catch((err) => {
      console.warn('Failed to preload Whisper model:', err)
      // Still mark complete even if whisper fails
      completeStartup()
    })

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Create the main window
  createWindow()

  app.on('activate', () => {
    // On macOS re-create window when dock icon is clicked and no windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up logger on quit
app.on('will-quit', () => {
  console.log('Nightshift shutting down...')
  closeLogger()
})

// Handle external links
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    // Open external links in the default browser
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })
})
