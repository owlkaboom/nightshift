/**
 * IPC handlers for project memory operations
 */

import { ipcMain } from 'electron'
import type { AddMemoryEntryData, MemoryStats } from '@shared/ipc-types'
import type { ProjectMemory, MemoryEntry, CodebaseStructure } from '@shared/types'
import {
  loadProjectMemory,
  buildMemoryContext,
  getMemoryStats,
  addMemoryEntry,
  updateCodebaseStructure,
  compactMemory,
  clearProjectMemory,
  hasProjectMemory
} from '@main/storage'

/**
 * Register memory IPC handlers
 */
export function registerMemoryHandlers(): void {
  // Get full project memory
  ipcMain.handle('memory:get', async (_, projectId: string): Promise<ProjectMemory> => {
    return loadProjectMemory(projectId)
  })

  // Get condensed context string for prompt injection
  ipcMain.handle('memory:getContext', async (_, projectId: string): Promise<string> => {
    return buildMemoryContext(projectId)
  })

  // Get memory statistics
  ipcMain.handle('memory:getStats', async (_, projectId: string): Promise<MemoryStats> => {
    return getMemoryStats(projectId)
  })

  // Add a memory entry
  ipcMain.handle('memory:addEntry', async (_, data: AddMemoryEntryData): Promise<MemoryEntry> => {
    return addMemoryEntry(data.projectId, data.category, data.content, data.source)
  })

  // Update codebase structure
  ipcMain.handle(
    'memory:updateStructure',
    async (_, projectId: string, structure: CodebaseStructure): Promise<void> => {
      return updateCodebaseStructure(projectId, structure)
    }
  )

  // Compact memory (remove stale entries)
  ipcMain.handle('memory:compact', async (_, projectId: string): Promise<number> => {
    return compactMemory(projectId)
  })

  // Clear all project memory
  ipcMain.handle('memory:clear', async (_, projectId: string): Promise<void> => {
    return clearProjectMemory(projectId)
  })

  // Check if project has memory
  ipcMain.handle('memory:hasMemory', async (_, projectId: string): Promise<boolean> => {
    return hasProjectMemory(projectId)
  })
}
