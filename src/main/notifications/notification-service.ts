/**
 * Notification Service
 *
 * Handles desktop notifications and audio alerts for task completion events.
 * Respects user preferences from app configuration.
 */

import { Notification } from 'electron'
import type { TaskManifest } from '@shared/types'
import { loadConfig } from '@main/storage/sqlite/config-store'
import { logger } from '@main/utils/logger'

/**
 * Show a desktop notification for a completed task
 */
async function showTaskCompletionNotification(task: TaskManifest): Promise<void> {
  const config = await loadConfig()

  // Check if notifications are enabled
  if (!config.notifications.enabled) {
    logger.debug('[NotificationService] Notifications disabled, skipping task completion notification')
    return
  }

  if (!Notification.isSupported()) {
    console.warn('[NotificationService] Notifications not supported on this platform')
    return
  }

  // Determine notification based on status
  let title = 'Task Completed'
  let body = task.prompt.length > 100 ? `${task.prompt.slice(0, 100)}...` : task.prompt

  if (task.status === 'needs_review') {
    title = '✅ Task Ready for Review'
    body = `Task completed successfully and is ready for your review.\n\n${body}`
  } else if (task.status === 'failed') {
    title = '❌ Task Failed'
    body = `Task encountered an error and needs attention.\n\n${body}`
  }

  try {
    logger.debug('[NotificationService] Showing task completion notification:', title)

    // Create and show notification
    const notification = new Notification({
      title,
      body,
      silent: !config.notifications.sound, // System sound if enabled
      urgency: 'normal',
      timeoutType: 'default'
    })

    notification.show()

    // Play custom audio alert if enabled and status is needs_review
    if (config.notifications.sound && task.status === 'needs_review') {
      playAudioAlert()
    }
  } catch (error) {
    console.error('[NotificationService] Error showing task completion notification:', error)
  }
}

/**
 * Play an audio alert for task completion
 * Uses the configured sound (default or custom)
 */
async function playAudioAlert(): Promise<void> {
  try {
    const config = await loadConfig()
    const { exec } = require('child_process')

    // If custom sound is selected and path is configured, try to play it
    if (config.notifications.defaultSound === 'custom' && config.notifications.customSoundPath) {
      logger.debug('[NotificationService] Playing custom sound:', config.notifications.customSoundPath)

      // Determine the appropriate player based on file extension and platform
      const soundPath = config.notifications.customSoundPath

      if (process.platform === 'darwin') {
        // macOS: use afplay for all audio formats
        exec(`afplay "${soundPath}"`, (error: Error | null) => {
          if (error) {
            console.error('[NotificationService] Failed to play custom audio alert:', error)
            logger.debug('[NotificationService] Falling back to default sound')
            playDefaultSound(config.notifications.defaultSound)
          }
        })
      } else if (process.platform === 'win32') {
        // Windows: use powershell to play audio
        exec(`powershell -c "(New-Object Media.SoundPlayer '${soundPath}').PlaySync()"`, (error: Error | null) => {
          if (error) {
            console.error('[NotificationService] Failed to play custom audio alert:', error)
            logger.debug('[NotificationService] Falling back to default sound')
            playDefaultSound(config.notifications.defaultSound)
          }
        })
      } else {
        // Linux: try paplay first, then aplay
        exec(`paplay "${soundPath}" || aplay "${soundPath}"`, (error: Error | null) => {
          if (error) {
            console.error('[NotificationService] Failed to play custom audio alert:', error)
            logger.debug('[NotificationService] Falling back to default sound')
            playDefaultSound(config.notifications.defaultSound)
          }
        })
      }
    } else {
      // Use selected default sound
      playDefaultSound(config.notifications.defaultSound)
    }
  } catch (error) {
    console.error('[NotificationService] Error playing audio alert:', error)
  }
}

/**
 * Play a selected default sound
 */
function playDefaultSound(soundName: string): void {
  const { exec } = require('child_process')

  try {
    if (process.platform === 'darwin') {
      // Map sound name to macOS system sound file
      // Default to Hero if sound name is 'custom' (shouldn't happen, but safe fallback)
      const actualSoundName = soundName === 'custom' ? 'Hero' : soundName
      const soundPath = `/System/Library/Sounds/${actualSoundName}.aiff`

      logger.debug('[NotificationService] Playing default sound:', actualSoundName)
      exec(`afplay "${soundPath}"`, (error: Error | null) => {
        if (error) {
          console.error('[NotificationService] Failed to play default sound:', error)
          // Fall back to Hero if the selected sound fails
          if (actualSoundName !== 'Hero') {
            exec('afplay /System/Library/Sounds/Hero.aiff')
          }
        }
      })
    } else if (process.platform === 'win32') {
      // On Windows, use the built-in notification sound
      exec('powershell -c "[console]::beep(800,300)"', (error: Error | null) => {
        if (error) {
          console.error('[NotificationService] Failed to play system sound:', error)
        }
      })
    } else {
      // On Linux, try to play a system sound using paplay or aplay
      exec('paplay /usr/share/sounds/freedesktop/stereo/complete.oga || aplay /usr/share/sounds/alsa/Front_Center.wav', (error: Error | null) => {
        if (error) {
          console.error('[NotificationService] Failed to play system sound:', error)
        }
      })
    }
  } catch (error) {
    console.error('[NotificationService] Error playing default sound:', error)
  }
}

/**
 * Initialize notification service
 * Should be called after app is ready
 */
export async function initializeNotificationService(): Promise<void> {
  // Ensure app has proper notification permissions
  if (!Notification.isSupported()) {
    console.warn('[NotificationService] Notifications are not supported on this platform')
    return
  }

  logger.debug('[NotificationService] Notifications are supported')

  // On macOS, we need to request notification permissions
  if (process.platform === 'darwin') {
    try {
      // This will prompt the user for permission if not already granted
      const mockNotification = new Notification({
        title: 'Nightshift',
        body: 'Notifications enabled',
        silent: true
      })
      // Close it immediately so it doesn't show
      mockNotification.close()
      logger.debug('[NotificationService] Notification permissions requested')
    } catch (error) {
      console.error('[NotificationService] Failed to request notification permissions:', error)
    }
  }
}

/**
 * Handle task status changes and show appropriate notifications
 */
export async function handleTaskStatusChange(task: TaskManifest): Promise<void> {
  // Only notify for completion states
  if (task.status === 'needs_review' || task.status === 'failed') {
    await showTaskCompletionNotification(task)
  }
}

/**
 * Preview a specific notification sound
 */
export async function previewNotificationSound(soundName: string, customPath?: string): Promise<void> {
  logger.debug('[NotificationService] Preview sound requested:', soundName, customPath)

  try {
    if (soundName === 'custom' && customPath) {
      // Preview custom sound
      const { exec } = require('child_process')
      const soundPath = customPath

      if (process.platform === 'darwin') {
        exec(`afplay "${soundPath}"`, (error: Error | null) => {
          if (error) {
            console.error('[NotificationService] Failed to preview custom sound:', error)
          }
        })
      } else if (process.platform === 'win32') {
        exec(`powershell -c "(New-Object Media.SoundPlayer '${soundPath}').PlaySync()"`, (error: Error | null) => {
          if (error) {
            console.error('[NotificationService] Failed to preview custom sound:', error)
          }
        })
      } else {
        exec(`paplay "${soundPath}" || aplay "${soundPath}"`, (error: Error | null) => {
          if (error) {
            console.error('[NotificationService] Failed to preview custom sound:', error)
          }
        })
      }
    } else {
      // Preview default sound
      playDefaultSound(soundName)
    }
  } catch (error) {
    console.error('[NotificationService] Error previewing sound:', error)
    throw error
  }
}

/**
 * Test notification (for settings preview)
 */
export async function showTestNotification(): Promise<void> {
  logger.debug('[NotificationService] Test notification requested')

  const config = await loadConfig()
  logger.debug('[NotificationService] Notification config:', config.notifications)

  if (!config.notifications.enabled) {
    logger.debug('[NotificationService] Notifications are disabled in config')
    return
  }

  if (!Notification.isSupported()) {
    console.error('[NotificationService] Notifications are not supported on this platform')
    return
  }

  try {
    const notification = new Notification({
      title: '🌙 Nightshift Test',
      body: 'This is a test notification from Nightshift. If you see this, notifications are working!',
      silent: !config.notifications.sound,
      urgency: 'normal',
      timeoutType: 'default'
    })

    logger.debug('[NotificationService] Showing notification...')
    notification.show()
    logger.debug('[NotificationService] Notification shown')

    // Add event listeners for debugging
    notification.on('show', () => {
      logger.debug('[NotificationService] Notification displayed')
    })
    notification.on('click', () => {
      logger.debug('[NotificationService] Notification clicked')
    })
    notification.on('close', () => {
      logger.debug('[NotificationService] Notification closed')
    })
    notification.on('failed', (_event, error) => {
      console.error('[NotificationService] Notification failed:', error)
    })

    if (config.notifications.sound) {
      logger.debug('[NotificationService] Playing audio alert...')
      playAudioAlert()
    }
  } catch (error) {
    console.error('[NotificationService] Error showing test notification:', error)
    throw error
  }
}
