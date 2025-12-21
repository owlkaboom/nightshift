/**
 * Test: Note Group Store - Optimistic Updates
 *
 * Tests the optimistic update functionality for note group operations:
 * - Immediate UI updates for group reordering
 * - Immediate UI updates for toggle collapsed
 * - Rollback on error
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useNoteGroupStore } from '../note-group-store'
import type { NoteGroup } from '@shared/types'

// Mock the window.api
const mockApi = {
  reorderNoteGroups: vi.fn(),
  toggleNoteGroupCollapsed: vi.fn(),
  updateNoteGroup: vi.fn()
}

// @ts-expect-error - mocking window.api
global.window = {
  api: mockApi
}

// Mock console.error to suppress error logs in tests
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

describe('Note Group Store - Optimistic Updates', () => {
  const mockGroups: NoteGroup[] = [
    {
      id: 'group-1',
      name: 'Work',
      icon: 'Folder',
      color: '#8b5cf6',
      order: 0,
      isCollapsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'group-2',
      name: 'Personal',
      icon: 'Folder',
      color: '#ec4899',
      order: 1,
      isCollapsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'group-3',
      name: 'Archive',
      icon: 'Archive',
      color: '#6366f1',
      order: 2,
      isCollapsed: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]

  beforeEach(() => {
    // Reset store state
    useNoteGroupStore.setState({
      groups: [...mockGroups],
      loading: false,
      error: null
    })

    // Clear all mocks
    vi.clearAllMocks()
    consoleErrorSpy.mockClear()
  })

  describe('reorderGroups - Optimistic Updates', () => {
    it('should reorder groups optimistically before API call completes', async () => {
      // Setup: Make the API call hang indefinitely
      let resolveApiCall: (() => void) | null = null
      const apiPromise = new Promise<void>((resolve) => {
        resolveApiCall = resolve
      })
      mockApi.reorderNoteGroups.mockReturnValue(apiPromise)

      const store = useNoteGroupStore.getState()

      // New order: swap group-1 and group-2
      const newOrder = [
        { id: 'group-2', order: 0 },
        { id: 'group-1', order: 1 },
        { id: 'group-3', order: 2 }
      ]

      // Start the reorder (don't await yet)
      const reorderPromise = store.reorderGroups(newOrder)

      // Give React time to process the optimistic update
      await new Promise(resolve => setTimeout(resolve, 0))

      // Check that groups were reordered optimistically
      const optimisticState = useNoteGroupStore.getState()
      expect(optimisticState.groups[0].id).toBe('group-2')
      expect(optimisticState.groups[0].order).toBe(0)
      expect(optimisticState.groups[1].id).toBe('group-1')
      expect(optimisticState.groups[1].order).toBe(1)

      // Verify API was called
      expect(mockApi.reorderNoteGroups).toHaveBeenCalledWith(newOrder)

      // Resolve the API call
      resolveApiCall!()
      await reorderPromise

      // Verify final state still has the new order
      const finalState = useNoteGroupStore.getState()
      expect(finalState.groups[0].id).toBe('group-2')
      expect(finalState.groups[1].id).toBe('group-1')
    })

    it('should rollback group order on error', async () => {
      // Setup: Make the API call fail
      mockApi.reorderNoteGroups.mockRejectedValue(new Error('Network error'))

      const store = useNoteGroupStore.getState()
      const initialGroups = [...store.groups]

      // Attempt to reorder (this will fail)
      const newOrder = [
        { id: 'group-2', order: 0 },
        { id: 'group-1', order: 1 },
        { id: 'group-3', order: 2 }
      ]

      await store.reorderGroups(newOrder)

      // Check that state was rolled back to original
      const finalState = useNoteGroupStore.getState()
      expect(finalState.groups[0].id).toBe(initialGroups[0].id)
      expect(finalState.groups[1].id).toBe(initialGroups[1].id)
      expect(finalState.groups[2].id).toBe(initialGroups[2].id)
    })
  })

  describe('toggleCollapsed - Optimistic Updates', () => {
    it('should toggle collapsed state optimistically before API call completes', async () => {
      // Setup: Make the API call hang indefinitely
      let resolveApiCall: ((value: NoteGroup) => void) | null = null
      const apiPromise = new Promise<NoteGroup>((resolve) => {
        resolveApiCall = resolve
      })
      mockApi.toggleNoteGroupCollapsed.mockReturnValue(apiPromise)

      const store = useNoteGroupStore.getState()
      const targetGroup = store.groups.find(g => g.id === 'group-1')!
      const initialCollapsed = targetGroup.isCollapsed

      // Start the toggle (don't await yet)
      const togglePromise = store.toggleCollapsed('group-1')

      // Give React time to process the optimistic update
      await new Promise(resolve => setTimeout(resolve, 0))

      // Check that collapsed state was toggled optimistically
      const optimisticState = useNoteGroupStore.getState()
      const optimisticGroup = optimisticState.groups.find(g => g.id === 'group-1')!
      expect(optimisticGroup.isCollapsed).toBe(!initialCollapsed)

      // Verify API was called
      expect(mockApi.toggleNoteGroupCollapsed).toHaveBeenCalledWith('group-1')

      // Resolve the API call with server response
      const serverGroup = { ...targetGroup, isCollapsed: !initialCollapsed }
      resolveApiCall!(serverGroup)
      await togglePromise

      // Verify final state matches server response
      const finalState = useNoteGroupStore.getState()
      const finalGroup = finalState.groups.find(g => g.id === 'group-1')!
      expect(finalGroup.isCollapsed).toBe(!initialCollapsed)
    })

    it('should rollback toggle on error', async () => {
      // Setup: Make the API call fail
      mockApi.toggleNoteGroupCollapsed.mockRejectedValue(new Error('Network error'))

      const store = useNoteGroupStore.getState()
      const targetGroup = store.groups.find(g => g.id === 'group-1')!
      const initialCollapsed = targetGroup.isCollapsed

      // Attempt to toggle (this will fail)
      await store.toggleCollapsed('group-1')

      // Check that state was rolled back to original
      const finalState = useNoteGroupStore.getState()
      const finalGroup = finalState.groups.find(g => g.id === 'group-1')!
      expect(finalGroup.isCollapsed).toBe(initialCollapsed)
    })
  })

  describe('updateGroup - Optimistic Updates', () => {
    it('should update group optimistically before API call completes', async () => {
      // Setup: Make the API call hang indefinitely
      let resolveApiCall: ((value: NoteGroup) => void) | null = null
      const apiPromise = new Promise<NoteGroup>((resolve) => {
        resolveApiCall = resolve
      })
      mockApi.updateNoteGroup.mockReturnValue(apiPromise)

      const store = useNoteGroupStore.getState()

      // Start the update (don't await yet)
      const updatePromise = store.updateGroup('group-1', { name: 'Updated Work' })

      // Give React time to process the optimistic update
      await new Promise(resolve => setTimeout(resolve, 0))

      // Check that the group was updated optimistically
      const optimisticState = useNoteGroupStore.getState()
      const optimisticGroup = optimisticState.groups.find(g => g.id === 'group-1')!
      expect(optimisticGroup.name).toBe('Updated Work')

      // Verify API was called
      expect(mockApi.updateNoteGroup).toHaveBeenCalledWith('group-1', { name: 'Updated Work' })

      // Resolve the API call
      const serverGroup = { ...mockGroups[0], name: 'Updated Work' }
      resolveApiCall!(serverGroup)
      await updatePromise

      // Verify final state
      const finalState = useNoteGroupStore.getState()
      const finalGroup = finalState.groups.find(g => g.id === 'group-1')!
      expect(finalGroup.name).toBe('Updated Work')
    })

    it('should rollback update on error', async () => {
      // Setup: Make the API call fail
      mockApi.updateNoteGroup.mockRejectedValue(new Error('Network error'))

      const store = useNoteGroupStore.getState()
      const initialName = store.groups.find(g => g.id === 'group-1')!.name

      // Attempt to update (this will fail)
      await store.updateGroup('group-1', { name: 'Updated Work' })

      // Check that state was rolled back to original
      const finalState = useNoteGroupStore.getState()
      const finalGroup = finalState.groups.find(g => g.id === 'group-1')!
      expect(finalGroup.name).toBe(initialName)
    })
  })
})
