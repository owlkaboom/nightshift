/**
 * IPC handlers for local Whisper transcription
 */

import { ipcMain } from 'electron'
import type { WhisperModelKey } from '../whisper/whisper-service'
import {
  getWhisperStatus,
  getWhisperDepsStatus,
  installWhisperDeps,
  isWhisperAvailable,
  loadWhisperModel,
  unloadWhisperModel,
  transcribeAudio,
  WHISPER_MODELS
} from '../whisper/whisper-service'
import { broadcastToAll } from '../utils/broadcast'

export function registerWhisperHandlers(): void {
  // Get Whisper dependencies status
  ipcMain.handle('whisper:getDepsStatus', async () => {
    return {
      ...getWhisperDepsStatus(),
      available: await isWhisperAvailable()
    }
  })

  // Install Whisper dependencies
  ipcMain.handle('whisper:installDeps', async () => {
    try {
      const result = await installWhisperDeps((message) => {
        broadcastToAll('whisper:installProgress', { message })
      })
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Installation failed'
      }
    }
  })

  // Get Whisper service status
  ipcMain.handle('whisper:getStatus', async () => {
    return getWhisperStatus()
  })

  // Get available models
  ipcMain.handle('whisper:getModels', async () => {
    return Object.entries(WHISPER_MODELS).map(([key, info]) => ({
      key,
      ...info
    }))
  })

  // Load a Whisper model
  ipcMain.handle('whisper:loadModel', async (_, modelKey: WhisperModelKey) => {
    try {
      await loadWhisperModel(modelKey, (progress) => {
        // Broadcast progress to all windows
        broadcastToAll('whisper:loadProgress', { modelKey, progress })
      })
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load model'
      }
    }
  })

  // Unload the current model
  ipcMain.handle('whisper:unloadModel', async () => {
    unloadWhisperModel()
    return { success: true }
  })

  // Transcribe audio buffer (sent as base64)
  ipcMain.handle(
    'whisper:transcribe',
    async (
      _,
      audioBase64: string,
      options?: { language?: string; returnTimestamps?: boolean }
    ) => {
      try {
        // Convert base64 to ArrayBuffer
        const audioBuffer = Buffer.from(audioBase64, 'base64').buffer

        const result = await transcribeAudio(audioBuffer, options)
        return { success: true, result }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Transcription failed'
        }
      }
    }
  )
}
