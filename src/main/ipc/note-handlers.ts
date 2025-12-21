/**
 * IPC handlers for notes
 */

import { ipcMain } from 'electron'
import type { Note, NoteStatus, CreateNoteData, NoteGroup, CreateNoteGroupData } from '@shared/types'
import * as vaultStore from '@main/storage/vault/vault-store'
import * as notesCache from '@main/storage/vault/notes-cache'
import * as noteGroupsStore from '@main/storage/sqlite/note-groups-store'

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

  /**
   * Reorder notes
   */
  ipcMain.handle(
    'note:reorder',
    async (_event, noteOrders: Array<{ id: string; order: number; groupId?: string | null }>): Promise<void> => {
      await vaultStore.reorderNotes(noteOrders)
      // Update cache
      if (notesCache.isCacheInitialized()) {
        // Reload notes to update cache
        const notes = await vaultStore.loadNotes()
        for (const note of notes) {
          notesCache.updateNoteInCache(note)
        }
      }
    }
  )

  /**
   * Move note to group
   */
  ipcMain.handle(
    'note:moveToGroup',
    async (_event, noteId: string, groupId: string | null): Promise<Note | null> => {
      const note = await vaultStore.moveNoteToGroup(noteId, groupId)
      if (note && notesCache.isCacheInitialized()) {
        notesCache.updateNoteInCache(note)
      }
      return note
    }
  )

  /**
   * Get notes by group
   */
  ipcMain.handle(
    'note:listByGroup',
    async (_event, groupId: string | null): Promise<Note[]> => {
      return vaultStore.getNotesByGroup(groupId)
    }
  )

  // ============ Note Groups Handlers ============

  /**
   * Get all note groups
   */
  ipcMain.handle('noteGroup:list', async (): Promise<NoteGroup[]> => {
    return noteGroupsStore.getAllNoteGroups()
  })

  /**
   * Get a note group by ID
   */
  ipcMain.handle('noteGroup:get', async (_event, id: string): Promise<NoteGroup | null> => {
    return noteGroupsStore.getNoteGroup(id)
  })

  /**
   * Create a new note group
   */
  ipcMain.handle(
    'noteGroup:create',
    async (_event, data: CreateNoteGroupData): Promise<NoteGroup> => {
      return noteGroupsStore.createNoteGroupRecord(data)
    }
  )

  /**
   * Update a note group
   */
  ipcMain.handle(
    'noteGroup:update',
    async (_event, id: string, updates: Partial<NoteGroup>): Promise<NoteGroup | null> => {
      return noteGroupsStore.updateNoteGroup(id, updates)
    }
  )

  /**
   * Delete a note group
   * Also updates all notes in the group to set groupId to null
   */
  ipcMain.handle('noteGroup:delete', async (_event, id: string): Promise<boolean> => {
    // First, get all notes in this group
    const notesInGroup = await vaultStore.getNotesByGroup(id)

    // Delete the group
    const success = await noteGroupsStore.deleteNoteGroup(id)

    if (success) {
      // Update all notes in the group to set groupId to null
      for (const note of notesInGroup) {
        await vaultStore.updateNote(note.id, { groupId: null })
        // Update cache
        if (notesCache.isCacheInitialized()) {
          const updatedNote = await vaultStore.getNote(note.id)
          if (updatedNote) {
            notesCache.updateNoteInCache(updatedNote)
          }
        }
      }
    }

    return success
  })

  /**
   * Reorder note groups
   */
  ipcMain.handle(
    'noteGroup:reorder',
    async (_event, groupOrders: Array<{ id: string; order: number }>): Promise<void> => {
      return noteGroupsStore.reorderNoteGroups(groupOrders)
    }
  )

  /**
   * Toggle note group collapsed state
   */
  ipcMain.handle('noteGroup:toggleCollapsed', async (_event, id: string): Promise<NoteGroup | null> => {
    return noteGroupsStore.toggleNoteGroupCollapsed(id)
  })
}
