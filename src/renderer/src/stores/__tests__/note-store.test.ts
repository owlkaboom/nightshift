/**
 * Test: Note Store - Optimistic Updates
 *
 * Tests the optimistic update functionality for note operations:
 * - Immediate UI updates before API calls complete
 * - Rollback on error
 * - Final state sync with server response
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useNoteStore } from '../note-store'
import type { Note } from '@shared/types'

// Mock the window.api
const mockApi = {
  updateNote: vi.fn(),
  listNotes: vi.fn(),
  listPinnedNotes: vi.fn(),
  listRecentNotes: vi.fn()
}

// @ts-expect-error - mocking window.api
global.window = {
  api: mockApi
}

describe('Note Store - Optimistic Updates', () => {
  const mockNote: Note = {
    id: 'note-1',
    title: 'Test Note',
    content: 'Test content',
    htmlContent: '<p>Test content</p>',
    excerpt: 'Test content',
    status: 'active',
    projectRefs: [],
    groupRefs: [],
    tagRefs: [],
    tags: [],
    primaryProjectId: null,
    linkedTaskIds: [],
    linkedPlanningIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPinned: false,
    wordCount: 2,
    groupId: null,
    order: 0
  }

  beforeEach(() => {
    // Reset store state
    useNoteStore.setState({
      notes: [mockNote],
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
      allTags: []
    })

    // Clear all mocks
    vi.clearAllMocks()
  })

  describe('updateNote - Optimistic Updates', () => {
    it('should update note optimistically before API call completes', async () => {
      // Setup: Make the API call hang indefinitely
      let resolveApiCall: ((value: Note) => void) | null = null
      const apiPromise = new Promise<Note>((resolve) => {
        resolveApiCall = resolve
      })
      mockApi.updateNote.mockReturnValue(apiPromise)

      const store = useNoteStore.getState()

      // Start the update (don't await yet)
      const updatePromise = store.updateNote('note-1', { order: 1, groupId: 'group-1' })

      // Give React time to process the optimistic update
      await new Promise(resolve => setTimeout(resolve, 0))

      // Check that the note was updated optimistically
      const optimisticState = useNoteStore.getState()
      expect(optimisticState.notes[0].order).toBe(1)
      expect(optimisticState.notes[0].groupId).toBe('group-1')

      // Verify API was called
      expect(mockApi.updateNote).toHaveBeenCalledWith('note-1', { order: 1, groupId: 'group-1' })

      // Now resolve the API call with the server response
      const serverNote = { ...mockNote, order: 1, groupId: 'group-1' }
      resolveApiCall!(serverNote)
      await updatePromise

      // Verify final state matches server response
      const finalState = useNoteStore.getState()
      expect(finalState.notes[0].order).toBe(1)
      expect(finalState.notes[0].groupId).toBe('group-1')
    })

    it('should rollback optimistic update on error', async () => {
      // Setup: Make the API call fail
      mockApi.updateNote.mockRejectedValue(new Error('Network error'))

      const store = useNoteStore.getState()
      const initialState = { ...store.notes[0] }

      // Attempt to update (this will fail)
      await store.updateNote('note-1', { order: 1, groupId: 'group-1' })

      // Check that state was rolled back to original
      const finalState = useNoteStore.getState()
      expect(finalState.notes[0].order).toBe(initialState.order)
      expect(finalState.notes[0].groupId).toBe(initialState.groupId)
    })

    it('should update currentNote optimistically if it is the note being updated', async () => {
      // Setup: Set current note
      useNoteStore.setState({ currentNote: mockNote })

      let resolveApiCall: ((value: Note) => void) | null = null
      const apiPromise = new Promise<Note>((resolve) => {
        resolveApiCall = resolve
      })
      mockApi.updateNote.mockReturnValue(apiPromise)

      const store = useNoteStore.getState()

      // Start the update
      const updatePromise = store.updateNote('note-1', { title: 'Updated Title' })

      // Give React time to process the optimistic update
      await new Promise(resolve => setTimeout(resolve, 0))

      // Check that currentNote was updated optimistically
      const optimisticState = useNoteStore.getState()
      expect(optimisticState.currentNote?.title).toBe('Updated Title')

      // Resolve API call
      const serverNote = { ...mockNote, title: 'Updated Title' }
      resolveApiCall!(serverNote)
      await updatePromise

      // Verify final state
      const finalState = useNoteStore.getState()
      expect(finalState.currentNote?.title).toBe('Updated Title')
    })

    it('should handle pin status optimistically', async () => {
      const unpinnedNote = { ...mockNote, isPinned: false }
      useNoteStore.setState({ notes: [unpinnedNote], pinnedNotes: [] })

      let resolveApiCall: ((value: Note) => void) | null = null
      const apiPromise = new Promise<Note>((resolve) => {
        resolveApiCall = resolve
      })
      mockApi.updateNote.mockReturnValue(apiPromise)

      const store = useNoteStore.getState()

      // Start the update to pin the note
      const updatePromise = store.updateNote('note-1', { isPinned: true })

      // Give React time to process the optimistic update
      await new Promise(resolve => setTimeout(resolve, 0))

      // Check that pinnedNotes was updated optimistically
      const optimisticState = useNoteStore.getState()
      expect(optimisticState.pinnedNotes).toHaveLength(1)
      expect(optimisticState.pinnedNotes[0].id).toBe('note-1')

      // Resolve API call
      const serverNote = { ...unpinnedNote, isPinned: true }
      resolveApiCall!(serverNote)
      await updatePromise

      // Verify final state
      const finalState = useNoteStore.getState()
      expect(finalState.pinnedNotes).toHaveLength(1)
    })

    it('should not update state if note is not found', async () => {
      mockApi.updateNote.mockResolvedValue(null)

      const store = useNoteStore.getState()
      const initialNotes = [...store.notes]

      // Try to update a non-existent note
      await store.updateNote('non-existent-id', { order: 1 })

      // State should remain unchanged (no optimistic update should have occurred)
      const finalState = useNoteStore.getState()
      expect(finalState.notes).toEqual(initialNotes)
    })
  })

  describe('Multiple concurrent updates', () => {
    it('should handle multiple simultaneous updates correctly', async () => {
      const note1 = { ...mockNote, id: 'note-1' }
      const note2 = { ...mockNote, id: 'note-2' }
      useNoteStore.setState({ notes: [note1, note2] })

      // Setup API to resolve after a delay
      mockApi.updateNote.mockImplementation((id: string, updates: Partial<Note>) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ ...mockNote, id, ...updates })
          }, 10)
        })
      })

      const store = useNoteStore.getState()

      // Start both updates simultaneously
      const update1 = store.updateNote('note-1', { order: 1 })
      const update2 = store.updateNote('note-2', { order: 2 })

      // Give React time to process optimistic updates
      await new Promise(resolve => setTimeout(resolve, 0))

      // Both should be updated optimistically
      const optimisticState = useNoteStore.getState()
      expect(optimisticState.notes.find(n => n.id === 'note-1')?.order).toBe(1)
      expect(optimisticState.notes.find(n => n.id === 'note-2')?.order).toBe(2)

      // Wait for both to complete
      await Promise.all([update1, update2])

      // Both should have final values
      const finalState = useNoteStore.getState()
      expect(finalState.notes.find(n => n.id === 'note-1')?.order).toBe(1)
      expect(finalState.notes.find(n => n.id === 'note-2')?.order).toBe(2)
    })
  })
})
