/**
 * IPC handlers for notes
 */

import { ipcMain } from 'electron'
import type { Note, NoteStatus, CreateNoteData } from '@shared/types'
import * as vaultStore from '../storage/vault/vault-store'
import * as notesCache from '../storage/vault/notes-cache'

/**
 * Register all note IPC handlers
 */
export function registerNoteHandlers(): void {
  /**
   * List all notes
   */
  ipcMain.handle('note:list', async (): Promise<Note[]> => {
    // Use cache if initialized, otherwise fall back to disk read
    if (notesCache.isCacheInitialized()) {
      return notesCache.getCachedNotes()
    }
    return vaultStore.loadNotes()
  })

  /**
   * Get a note by ID
   */
  ipcMain.handle('note:get', async (_event, noteId: string): Promise<Note | null> => {
    // Use cache if initialized, otherwise fall back to disk read
    if (notesCache.isCacheInitialized()) {
      return notesCache.getCachedNote(noteId)
    }
    return vaultStore.getNote(noteId)
  })

  /**
   * Create a new note
   */
  ipcMain.handle(
    'note:create',
    async (_event, data: CreateNoteData): Promise<Note> => {
      const note = await vaultStore.createNoteRecord(data)
      // Update cache
      if (notesCache.isCacheInitialized()) {
        notesCache.updateNoteInCache(note)
      }
      return note
    }
  )

  /**
   * Update a note
   */
  ipcMain.handle(
    'note:update',
    async (
      _event,
      noteId: string,
      updates: Partial<Note>
    ): Promise<Note | null> => {
      const note = await vaultStore.updateNote(noteId, updates)
      // Update cache
      if (note && notesCache.isCacheInitialized()) {
        notesCache.updateNoteInCache(note)
      }
      return note
    }
  )

  /**
   * Delete a note
   */
  ipcMain.handle(
    'note:delete',
    async (_event, noteId: string): Promise<boolean> => {
      const success = await vaultStore.deleteNote(noteId)
      // Update cache
      if (success && notesCache.isCacheInitialized()) {
        notesCache.removeNoteFromCache(noteId)
      }
      return success
    }
  )

  /**
   * Search notes (full-text search)
   */
  ipcMain.handle(
    'note:search',
    async (_event, query: string): Promise<Note[]> => {
      // Use cache if initialized, otherwise fall back to disk read
      if (notesCache.isCacheInitialized()) {
        return notesCache.searchCachedNotes(query)
      }
      return vaultStore.searchNotes(query)
    }
  )

  /**
   * List notes by primary project
   */
  ipcMain.handle(
    'note:listByProject',
    async (_event, projectId: string): Promise<Note[]> => {
      // Use cache if initialized, otherwise fall back to disk read
      if (notesCache.isCacheInitialized()) {
        return notesCache.getCachedNotesByProject(projectId)
      }
      return vaultStore.getNotesByProject(projectId)
    }
  )

  /**
   * List notes referencing a project
   */
  ipcMain.handle(
    'note:listReferencingProject',
    async (_event, projectId: string): Promise<Note[]> => {
      // Use cache if initialized, otherwise fall back to disk read
      if (notesCache.isCacheInitialized()) {
        return notesCache.getCachedNotesReferencingProject(projectId)
      }
      return vaultStore.getNotesReferencingProject(projectId)
    }
  )

  /**
   * List notes referencing a group
   */
  ipcMain.handle(
    'note:listReferencingGroup',
    async (_event, groupId: string): Promise<Note[]> => {
      // Use cache if initialized, otherwise fall back to disk read
      if (notesCache.isCacheInitialized()) {
        return notesCache.getCachedNotesReferencingGroup(groupId)
      }
      return vaultStore.getNotesReferencingGroup(groupId)
    }
  )

  /**
   * List recent notes
   */
  ipcMain.handle(
    'note:listRecent',
    async (_event, limit?: number): Promise<Note[]> => {
      // Use cache if initialized, otherwise fall back to disk read
      if (notesCache.isCacheInitialized()) {
        return notesCache.getCachedRecentNotes(limit)
      }
      return vaultStore.getRecentNotes(limit)
    }
  )

  /**
   * List pinned notes
   */
  ipcMain.handle('note:listPinned', async (): Promise<Note[]> => {
    // Use cache if initialized, otherwise fall back to disk read
    if (notesCache.isCacheInitialized()) {
      return notesCache.getCachedPinnedNotes()
    }
    return vaultStore.getPinnedNotes()
  })

  /**
   * List notes by status
   */
  ipcMain.handle(
    'note:listByStatus',
    async (_event, status: NoteStatus): Promise<Note[]> => {
      // Use cache if initialized, otherwise fall back to disk read
      if (notesCache.isCacheInitialized()) {
        return notesCache.getCachedNotesByStatus(status)
      }
      return vaultStore.getNotesByStatus(status)
    }
  )

  /**
   * List notes by tag
   */
  ipcMain.handle(
    'note:listByTag',
    async (_event, tag: string): Promise<Note[]> => {
      // Use cache if initialized, otherwise fall back to disk read
      if (notesCache.isCacheInitialized()) {
        return notesCache.getCachedNotesByTag(tag)
      }
      return vaultStore.getNotesByTag(tag)
    }
  )

  /**
   * Toggle pin status
   */
  ipcMain.handle(
    'note:togglePin',
    async (_event, noteId: string): Promise<Note | null> => {
      const note = await vaultStore.toggleNotePin(noteId)
      // Update cache
      if (note && notesCache.isCacheInitialized()) {
        notesCache.updateNoteInCache(note)
      }
      return note
    }
  )

  /**
   * Archive a note
   */
  ipcMain.handle(
    'note:archive',
    async (_event, noteId: string): Promise<Note | null> => {
      const note = await vaultStore.archiveNote(noteId)
      // Update cache
      if (note && notesCache.isCacheInitialized()) {
        notesCache.updateNoteInCache(note)
      }
      return note
    }
  )

  /**
   * Unarchive a note
   */
  ipcMain.handle(
    'note:unarchive',
    async (_event, noteId: string): Promise<Note | null> => {
      const note = await vaultStore.unarchiveNote(noteId)
      // Update cache
      if (note && notesCache.isCacheInitialized()) {
        notesCache.updateNoteInCache(note)
      }
      return note
    }
  )

  /**
   * Link a note to a task
   */
  ipcMain.handle(
    'note:linkToTask',
    async (_event, noteId: string, taskId: string): Promise<Note | null> => {
      const note = await vaultStore.linkNoteToTask(noteId, taskId)
      // Update cache
      if (note && notesCache.isCacheInitialized()) {
        notesCache.updateNoteInCache(note)
      }
      return note
    }
  )

  /**
   * Unlink a note from a task
   */
  ipcMain.handle(
    'note:unlinkFromTask',
    async (_event, noteId: string, taskId: string): Promise<Note | null> => {
      const note = await vaultStore.unlinkNoteFromTask(noteId, taskId)
      // Update cache
      if (note && notesCache.isCacheInitialized()) {
        notesCache.updateNoteInCache(note)
      }
      return note
    }
  )

  /**
   * Link a note to a planning session
   */
  ipcMain.handle(
    'note:linkToPlanning',
    async (_event, noteId: string, planningId: string): Promise<Note | null> => {
      const note = await vaultStore.linkNoteToPlanningSession(noteId, planningId)
      // Update cache
      if (note && notesCache.isCacheInitialized()) {
        notesCache.updateNoteInCache(note)
      }
      return note
    }
  )

  /**
   * Unlink a note from a planning session
   */
  ipcMain.handle(
    'note:unlinkFromPlanning',
    async (_event, noteId: string, planningId: string): Promise<Note | null> => {
      const note = await vaultStore.unlinkNoteFromPlanningSession(noteId, planningId)
      // Update cache
      if (note && notesCache.isCacheInitialized()) {
        notesCache.updateNoteInCache(note)
      }
      return note
    }
  )

  /**
   * Get all unique tags
   */
  ipcMain.handle('note:getAllTags', async (): Promise<string[]> => {
    // Use cache if initialized, otherwise fall back to disk read
    if (notesCache.isCacheInitialized()) {
      return notesCache.getCachedAllTags()
    }
    return vaultStore.getAllTags()
  })
}
