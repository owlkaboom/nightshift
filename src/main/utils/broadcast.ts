/**
 * Utility for broadcasting events to all renderer windows
 */

import { BrowserWindow } from 'electron'
import type { TaskManifest } from '@shared/types'
import type { UsageLimitState, AgentAuthState } from '@shared/ipc-types'

/**
 * Broadcast a task status change to all renderer windows
 */
export function broadcastTaskStatusChanged(task: TaskManifest): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('task:statusChanged', task)
    }
  }
}

/**
 * Broadcast a usage limit state change to all renderer windows
 */
export function broadcastUsageLimitStateChanged(state: UsageLimitState): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('usageLimit:stateChanged', state)
    }
  }
}

/**
 * Broadcast an agent auth state change to all renderer windows
 */
export function broadcastAgentAuthStateChanged(state: AgentAuthState): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('agentAuth:stateChanged', state)
    }
  }
}

/**
 * Broadcast an event to all renderer windows
 */
export function broadcastToAll(channel: string, data: unknown): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data)
    }
  }
}

/**
 * Broadcast startup progress to all renderer windows
 */
export function broadcastStartupProgress(status: {
  stage: string
  message: string
  complete: boolean
}): void {
  broadcastToAll('app:startupProgress', status)
}
