/**
 * IPC Handlers for Tag Operations
 *
 * Provides the bridge between renderer process tag requests
 * and main process tag store operations.
 */

import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { getTagStore } from '@main/storage/tag-store'
import type { Tag } from '@shared/types/tag'
import { logger } from '@main/utils/logger'

/**
 * Registers all tag-related IPC handlers
 * Initializes the tag store before registering handlers
 */
export async function registerTagHandlers(): Promise<void> {
  const tagStore = getTagStore()
  await tagStore.initialize()

  /**
   * Lists all tags
   */
  ipcMain.handle('tag:list', async (): Promise<Tag[]> => {
    try {
      return await tagStore.list()
    } catch (error) {
      console.error('[TagHandlers] Error listing tags:', error)
      throw error
    }
  })

  /**
   * Gets a specific tag by ID
   */
  ipcMain.handle('tag:get', async (_event: IpcMainInvokeEvent, id: string): Promise<Tag | null> => {
    try {
      return await tagStore.get(id)
    } catch (error) {
      console.error(`[TagHandlers] Error getting tag ${id}:`, error)
      throw error
    }
  })

  /**
   * Creates a new tag
   */
  ipcMain.handle(
    'tag:create',
    async (_event: IpcMainInvokeEvent, name: string, color?: string): Promise<Tag> => {
      try {
        return await tagStore.create(name, color)
      } catch (error) {
        console.error('[TagHandlers] Error creating tag:', error)
        throw error
      }
    }
  )

  /**
   * Updates an existing tag
   */
  ipcMain.handle(
    'tag:update',
    async (
      _event: IpcMainInvokeEvent,
      id: string,
      updates: Partial<Omit<Tag, 'id' | 'createdAt'>>
    ): Promise<Tag | null> => {
      try {
        return await tagStore.update(id, updates)
      } catch (error) {
        console.error(`[TagHandlers] Error updating tag ${id}:`, error)
        throw error
      }
    }
  )

  /**
   * Deletes a tag
   */
  ipcMain.handle('tag:delete', async (_event: IpcMainInvokeEvent, id: string): Promise<boolean> => {
    try {
      return await tagStore.delete(id)
    } catch (error) {
      console.error(`[TagHandlers] Error deleting tag ${id}:`, error)
      throw error
    }
  })

  /**
   * Gets tags by their IDs
   */
  ipcMain.handle(
    'tag:getByIds',
    async (_event: IpcMainInvokeEvent, ids: string[]): Promise<Tag[]> => {
      try {
        return await tagStore.getByIds(ids)
      } catch (error) {
        console.error('[TagHandlers] Error getting tags by IDs:', error)
        throw error
      }
    }
  )

  /**
   * Searches tags by name
   */
  ipcMain.handle(
    'tag:search',
    async (_event: IpcMainInvokeEvent, query: string): Promise<Tag[]> => {
      try {
        return await tagStore.search(query)
      } catch (error) {
        console.error('[TagHandlers] Error searching tags:', error)
        throw error
      }
    }
  )

  logger.debug('[TagHandlers] Registered tag IPC handlers')
}
