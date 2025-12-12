/**
 * Zustand store for note state management
 */

import { create } from 'zustand'
import type { Note, NoteStatus, CreateNoteData } from '@shared/types'

interface NoteState {
  /** All loaded notes */
  notes: Note[]

  /** Pinned notes (subset of notes) */
  pinnedNotes: Note[]

  /** Recent notes (subset of notes) */
  recentNotes: Note[]

  /** Currently selected/editing note */
  currentNote: Note | null

  /** Loading state */
  loading: boolean

  /** Error message */
  error: string | null

  /** Search query */
  searchQuery: string

  /** Search results */
  searchResults: Note[]

  /** Filter by project ID */
  projectFilter: string | null

  /** Filter by status */
  statusFilter: NoteStatus | 'all'

  /** Filter by tag */
  tagFilter: string | null

  /** All available tags */
  allTags: string[]

  // Actions
  fetchNotes: () => Promise<void>
  fetchPinnedNotes: () => Promise<void>
  fetchRecentNotes: (limit?: number) => Promise<void>
  fetchNotesByProject: (projectId: string) => Promise<void>
  fetchNotesByStatus: (status: NoteStatus) => Promise<void>
  fetchNotesByTag: (tag: string) => Promise<void>
  fetchAllTags: () => Promise<void>
  searchNotes: (query: string) => Promise<void>
  createNote: (data: CreateNoteData) => Promise<Note>
  updateNote: (noteId: string, updates: Partial<Note>) => Promise<Note | null>
  deleteNote: (noteId: string) => Promise<boolean>
  togglePin: (noteId: string) => Promise<void>
  archiveNote: (noteId: string) => Promise<void>
  unarchiveNote: (noteId: string) => Promise<void>
  linkToTask: (noteId: string, taskId: string) => Promise<void>
  unlinkFromTask: (noteId: string, taskId: string) => Promise<void>
  linkToPlanning: (noteId: string, planningId: string) => Promise<void>
  unlinkFromPlanning: (noteId: string, planningId: string) => Promise<void>
  setCurrentNote: (note: Note | null) => void
  setProjectFilter: (projectId: string | null) => void
  setStatusFilter: (status: NoteStatus | 'all') => void
  setTagFilter: (tag: string | null) => void
  clearFilters: () => void
  clearError: () => void
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  pinnedNotes: [],
  recentNotes: [],
  currentNote: null,
  loading: false,
  error: null,
  searchQuery: '',
  searchResults: [],
  projectFilter: null,
  statusFilter: 'all',
  tagFilter: null,
  allTags: [],

  fetchNotes: async () => {
    set({ loading: true, error: null })
    try {
      const notes = await window.api.listNotes()
      set({
        notes,
        loading: false,
        pinnedNotes: notes.filter((n) => n.isPinned),
        recentNotes: notes.slice(0, 10)
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch notes',
        loading: false
      })
    }
  },

  fetchPinnedNotes: async () => {
    try {
      const pinnedNotes = await window.api.listPinnedNotes()
      set({ pinnedNotes })
    } catch (error) {
      console.error('Failed to fetch pinned notes:', error)
    }
  },

  fetchRecentNotes: async (limit = 10) => {
    try {
      const recentNotes = await window.api.listRecentNotes(limit)
      set({ recentNotes })
    } catch (error) {
      console.error('Failed to fetch recent notes:', error)
    }
  },

  fetchNotesByProject: async (projectId: string) => {
    set({ loading: true, error: null, projectFilter: projectId })
    try {
      const notes = await window.api.listNotesByProject(projectId)
      set({ notes, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch notes',
        loading: false
      })
    }
  },

  fetchNotesByStatus: async (status: NoteStatus) => {
    set({ loading: true, error: null, statusFilter: status })
    try {
      const notes = await window.api.listNotesByStatus(status)
      set({ notes, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch notes',
        loading: false
      })
    }
  },

  fetchNotesByTag: async (tag: string) => {
    set({ loading: true, error: null, tagFilter: tag })
    try {
      const notes = await window.api.listNotesByTag(tag)
      set({ notes, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch notes',
        loading: false
      })
    }
  },

  fetchAllTags: async () => {
    try {
      const allTags = await window.api.getAllNoteTags()
      set({ allTags })
    } catch (error) {
      console.error('Failed to fetch tags:', error)
    }
  },

  searchNotes: async (query: string) => {
    set({ searchQuery: query })
    if (!query.trim()) {
      set({ searchResults: [] })
      return
    }

    try {
      const searchResults = await window.api.searchNotes(query)
      set({ searchResults })
    } catch (error) {
      console.error('Search failed:', error)
      set({ searchResults: [] })
    }
  },

  createNote: async (data: CreateNoteData) => {
    set({ loading: true, error: null })
    try {
      const note = await window.api.createNote(data)
      set((state) => ({
        notes: [note, ...state.notes],
        recentNotes: [note, ...state.recentNotes.slice(0, 9)],
        loading: false
      }))
      return note
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create note',
        loading: false
      })
      throw error
    }
  },

  updateNote: async (noteId: string, updates: Partial<Note>) => {
    try {
      const updated = await window.api.updateNote(noteId, updates)
      if (updated) {
        set((state) => ({
          notes: state.notes.map((n) => (n.id === noteId ? updated : n)),
          currentNote: state.currentNote?.id === noteId ? updated : state.currentNote,
          pinnedNotes: updated.isPinned
            ? [...state.pinnedNotes.filter((n) => n.id !== noteId), updated]
            : state.pinnedNotes.filter((n) => n.id !== noteId),
          recentNotes: state.recentNotes.map((n) => (n.id === noteId ? updated : n))
        }))
      }
      return updated
    } catch (error) {
      console.error('Failed to update note:', error)
      return null
    }
  },

  deleteNote: async (noteId: string) => {
    try {
      const success = await window.api.deleteNote(noteId)
      if (success) {
        set((state) => ({
          notes: state.notes.filter((n) => n.id !== noteId),
          pinnedNotes: state.pinnedNotes.filter((n) => n.id !== noteId),
          recentNotes: state.recentNotes.filter((n) => n.id !== noteId),
          currentNote: state.currentNote?.id === noteId ? null : state.currentNote
        }))
      }
      return success
    } catch (error) {
      console.error('Failed to delete note:', error)
      return false
    }
  },

  togglePin: async (noteId: string) => {
    try {
      const updated = await window.api.toggleNotePin(noteId)
      if (updated) {
        set((state) => ({
          notes: state.notes.map((n) => (n.id === noteId ? updated : n)),
          pinnedNotes: updated.isPinned
            ? [...state.pinnedNotes.filter((n) => n.id !== noteId), updated]
            : state.pinnedNotes.filter((n) => n.id !== noteId),
          currentNote: state.currentNote?.id === noteId ? updated : state.currentNote
        }))
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error)
    }
  },

  archiveNote: async (noteId: string) => {
    try {
      const updated = await window.api.archiveNote(noteId)
      if (updated) {
        set((state) => ({
          notes: state.notes.map((n) => (n.id === noteId ? updated : n)),
          currentNote: state.currentNote?.id === noteId ? updated : state.currentNote
        }))
      }
    } catch (error) {
      console.error('Failed to archive note:', error)
    }
  },

  unarchiveNote: async (noteId: string) => {
    try {
      const updated = await window.api.unarchiveNote(noteId)
      if (updated) {
        set((state) => ({
          notes: state.notes.map((n) => (n.id === noteId ? updated : n)),
          currentNote: state.currentNote?.id === noteId ? updated : state.currentNote
        }))
      }
    } catch (error) {
      console.error('Failed to unarchive note:', error)
    }
  },

  linkToTask: async (noteId: string, taskId: string) => {
    try {
      const updated = await window.api.linkNoteToTask(noteId, taskId)
      if (updated) {
        set((state) => ({
          notes: state.notes.map((n) => (n.id === noteId ? updated : n)),
          currentNote: state.currentNote?.id === noteId ? updated : state.currentNote
        }))
      }
    } catch (error) {
      console.error('Failed to link note to task:', error)
    }
  },

  unlinkFromTask: async (noteId: string, taskId: string) => {
    try {
      const updated = await window.api.unlinkNoteFromTask(noteId, taskId)
      if (updated) {
        set((state) => ({
          notes: state.notes.map((n) => (n.id === noteId ? updated : n)),
          currentNote: state.currentNote?.id === noteId ? updated : state.currentNote
        }))
      }
    } catch (error) {
      console.error('Failed to unlink note from task:', error)
    }
  },

  linkToPlanning: async (noteId: string, planningId: string) => {
    try {
      const updated = await window.api.linkNoteToPlanning(noteId, planningId)
      if (updated) {
        set((state) => ({
          notes: state.notes.map((n) => (n.id === noteId ? updated : n)),
          currentNote: state.currentNote?.id === noteId ? updated : state.currentNote
        }))
      }
    } catch (error) {
      console.error('Failed to link note to planning:', error)
    }
  },

  unlinkFromPlanning: async (noteId: string, planningId: string) => {
    try {
      const updated = await window.api.unlinkNoteFromPlanning(noteId, planningId)
      if (updated) {
        set((state) => ({
          notes: state.notes.map((n) => (n.id === noteId ? updated : n)),
          currentNote: state.currentNote?.id === noteId ? updated : state.currentNote
        }))
      }
    } catch (error) {
      console.error('Failed to unlink note from planning:', error)
    }
  },

  setCurrentNote: (note: Note | null) => {
    set({ currentNote: note })
  },

  setProjectFilter: (projectId: string | null) => {
    set({ projectFilter: projectId })
    if (projectId) {
      get().fetchNotesByProject(projectId)
    } else {
      get().fetchNotes()
    }
  },

  setStatusFilter: (status: NoteStatus | 'all') => {
    set({ statusFilter: status })
    if (status !== 'all') {
      get().fetchNotesByStatus(status)
    } else {
      get().fetchNotes()
    }
  },

  setTagFilter: (tag: string | null) => {
    set({ tagFilter: tag })
    if (tag) {
      get().fetchNotesByTag(tag)
    } else {
      get().fetchNotes()
    }
  },

  clearFilters: () => {
    set({
      projectFilter: null,
      statusFilter: 'all',
      tagFilter: null,
      searchQuery: '',
      searchResults: []
    })
    get().fetchNotes()
  },

  clearError: () => {
    set({ error: null })
  }
}))
