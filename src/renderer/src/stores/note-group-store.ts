/**
 * Zustand store for note group state management
 */

import { create } from 'zustand'
import type { NoteGroup, CreateNoteGroupData } from '@shared/types'

interface NoteGroupState {
  /** All loaded note groups */
  groups: NoteGroup[]

  /** Loading state */
  loading: boolean

  /** Error message */
  error: string | null

  // Actions
  fetchGroups: () => Promise<void>
  createGroup: (data: CreateNoteGroupData) => Promise<NoteGroup>
  updateGroup: (id: string, updates: Partial<NoteGroup>) => Promise<NoteGroup | null>
  deleteGroup: (id: string) => Promise<boolean>
  reorderGroups: (groupOrders: Array<{ id: string; order: number }>) => Promise<void>
  toggleCollapsed: (id: string) => Promise<void>
  clearError: () => void
}

export const useNoteGroupStore = create<NoteGroupState>((set) => ({
  groups: [],
  loading: false,
  error: null,

  fetchGroups: async () => {
    set({ loading: true, error: null })
    try {
      const groups = await window.api.listNoteGroups()
      set({ groups, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch note groups',
        loading: false
      })
    }
  },

  createGroup: async (data: CreateNoteGroupData) => {
    set({ loading: true, error: null })
    try {
      const group = await window.api.createNoteGroup(data)
      set((state) => ({
        groups: [...state.groups, group],
        loading: false
      }))
      return group
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create note group',
        loading: false
      })
      throw error
    }
  },

  updateGroup: async (id: string, updates: Partial<NoteGroup>) => {
    // Optimistic update - update UI immediately
    let previousGroups: NoteGroup[] = []
    set((state) => {
      // Store previous state for rollback on error
      previousGroups = [...state.groups]

      // Find the group and create optimistic update
      const group = state.groups.find(g => g.id === id)
      if (!group) return state

      const optimisticGroup = { ...group, ...updates }

      return {
        groups: state.groups.map((g) => (g.id === id ? optimisticGroup : g))
      }
    })

    try {
      const updated = await window.api.updateNoteGroup(id, updates)
      if (updated) {
        // Update with actual server response
        set((state) => ({
          groups: state.groups.map((g) => (g.id === id ? updated : g))
        }))
      }
      return updated
    } catch (error) {
      console.error('Failed to update note group:', error)
      // Rollback to previous state on error
      set({ groups: previousGroups })
      return null
    }
  },

  deleteGroup: async (id: string) => {
    try {
      const success = await window.api.deleteNoteGroup(id)
      if (success) {
        set((state) => ({
          groups: state.groups.filter((g) => g.id !== id)
        }))
      }
      return success
    } catch (error) {
      console.error('Failed to delete note group:', error)
      return false
    }
  },

  reorderGroups: async (groupOrders: Array<{ id: string; order: number }>) => {
    // Optimistic update - update UI immediately
    let previousGroups: NoteGroup[] = []
    set((state) => {
      // Store previous state for rollback on error
      previousGroups = [...state.groups]

      const orderMap = new Map(groupOrders.map(({ id, order }) => [id, order]))
      return {
        groups: state.groups
          .map((g) => ({ ...g, order: orderMap.get(g.id) ?? g.order }))
          .sort((a, b) => a.order - b.order)
      }
    })

    try {
      await window.api.reorderNoteGroups(groupOrders)
      // Keep the optimistic update - it's already applied
    } catch (error) {
      console.error('Failed to reorder note groups:', error)
      // Rollback to previous state on error
      set({ groups: previousGroups })
    }
  },

  toggleCollapsed: async (id: string) => {
    // Optimistic update - toggle immediately
    let previousGroups: NoteGroup[] = []
    set((state) => {
      // Store previous state for rollback on error
      previousGroups = [...state.groups]

      return {
        groups: state.groups.map((g) =>
          g.id === id ? { ...g, isCollapsed: !g.isCollapsed } : g
        )
      }
    })

    try {
      const updated = await window.api.toggleNoteGroupCollapsed(id)
      if (updated) {
        // Update with actual server response
        set((state) => ({
          groups: state.groups.map((g) => (g.id === id ? updated : g))
        }))
      }
    } catch (error) {
      console.error('Failed to toggle note group:', error)
      // Rollback to previous state on error
      set({ groups: previousGroups })
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))
