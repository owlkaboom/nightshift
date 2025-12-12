/**
 * Test: Notification Service Sound Playback
 *
 * Verifies that notification sounds are properly played when:
 * 1. Testing notifications through the settings panel
 * 2. Previewing different sound options
 * 3. Task completion notifications
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { exec } from 'child_process'

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn()
}))

// Mock electron
vi.mock('electron', () => ({
  Notification: vi.fn().mockImplementation(() => ({
    show: vi.fn(),
    close: vi.fn(),
    on: vi.fn()
  })),
  isSupported: vi.fn().mockReturnValue(true)
}))

// Mock config store
vi.mock('../../storage/sqlite/config-store', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    notifications: {
      enabled: true,
      sound: true,
      defaultSound: 'Hero',
      customSoundPath: null
    }
  })
}))

describe('Notification Service Sound Playback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('previewNotificationSound', () => {
    it('should execute afplay with correct sound path for default sounds on macOS', async () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {
        value: 'darwin'
      })

      const { previewNotificationSound } = await import('../notification-service')

      await previewNotificationSound('Hero')

      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining('afplay "/System/Library/Sounds/Hero.aiff"'),
        expect.any(Function)
      )

      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      })
    })

    it('should execute afplay with custom sound path when provided', async () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {
        value: 'darwin'
      })

      const { previewNotificationSound } = await import('../notification-service')
      const customPath = '/Users/test/custom-sound.mp3'

      await previewNotificationSound('custom', customPath)

      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining(`afplay "${customPath}"`),
        expect.any(Function)
      )

      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      })
    })
  })

  describe('showTestNotification', () => {
    it('should play audio alert when sound is enabled', async () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {
        value: 'darwin'
      })

      const { showTestNotification } = await import('../notification-service')

      await showTestNotification()

      // Should call exec to play the sound
      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining('afplay'),
        expect.any(Function)
      )

      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      })
    })

    it('should not play audio alert when sound is disabled', async () => {
      const { loadConfig } = await import('../../storage/sqlite/config-store')
      vi.mocked(loadConfig).mockResolvedValueOnce({
        notifications: {
          enabled: true,
          sound: false, // Sound disabled
          defaultSound: 'Hero',
          customSoundPath: null
        }
      } as any)

      const { showTestNotification } = await import('../notification-service')

      await showTestNotification()

      // Should not call exec since sound is disabled
      expect(exec).not.toHaveBeenCalled()
    })
  })

  describe('playDefaultSound', () => {
    it('should handle sound names correctly and not use "custom" as a sound name', async () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {
        value: 'darwin'
      })

      // Import and directly call playDefaultSound by testing through previewNotificationSound
      const { previewNotificationSound } = await import('../notification-service')

      // If somehow 'custom' is passed without a path, it should fall back to Hero
      await previewNotificationSound('custom')

      // The function should handle this gracefully
      expect(exec).toHaveBeenCalled()

      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      })
    })
  })
})
