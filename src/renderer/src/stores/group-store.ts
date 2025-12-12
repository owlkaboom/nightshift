/**
 * Zustand store for group state
 */

import { create } from 'zustand'
import type { Group, GroupTreeNode } from '@shared/types'
import type { CreateGroupData, GroupContext } from '@shared/ipc-types'

interface GroupState {
  groups: Group[]
  groupTree: GroupTreeNode[]
  loading: boolean
  error: string | null

  // Actions
  fetchGroups: () => Promise<void>
  fetchGroupTree: () => Promise<GroupTreeNode[]>
  createGroup: (data: CreateGroupData) => Promise<Group>
  updateGroup: (id: string, updates: Partial<Group>) => Promise<void>
  deleteGroup: (id: string) => Promise<void>
  moveGroup: (id: string, newParentId: string | null) => Promise<void>
  addProjectToGroup: (groupId: string, projectId: string) => Promise<void>
  removeProjectFromGroup: (groupId: string, projectId: string) => Promise<void>
  getGroup: (id: string) => Group | undefined
  getGroupContext: (id: string) => Promise<GroupContext>
  getGroupAncestors: (id: string) => Promise<Group[]>
  clearError: () => void
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  groupTree: [],
  loading: false,
  error: null,

  fetchGroups: async () => {
    set({ loading: true, error: null })
    try {
      const groups = await window.api.listGroups()
      set({ groups, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch groups',
        loading: false
      })
    }
  },

  fetchGroupTree: async () => {
    set({ loading: true, error: null })
    try {
      const groupTree = await window.api.getGroupTree()
      set({ groupTree, loading: false })
      return groupTree
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch group tree',
        loading: false
      })
      return []
    }
  },

  createGroup: async (data: CreateGroupData) => {
    set({ loading: true, error: null })
    try {
      const group = await window.api.createGroup(data)
      set((state) => ({
        groups: [...state.groups, group],
        loading: false
      }))
      // Refresh the tree after creating
      get().fetchGroupTree()
      return group
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create group',
        loading: false
      })
      throw error
    }
  },

  updateGroup: async (id: string, updates: Partial<Group>) => {
    set({ loading: true, error: null })
    try {
      const updated = await window.api.updateGroup(id, updates)
      if (updated) {
        set((state) => ({
          groups: state.groups.map((g) => (g.id === id ? updated : g)),
          loading: false
        }))
        // Refresh the tree after updating (parentId might have changed)
        get().fetchGroupTree()
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update group',
        loading: false
      })
      throw error
    }
  },

  deleteGroup: async (id: string) => {
    set({ loading: true, error: null })
    try {
      await window.api.deleteGroup(id)
      set((state) => ({
        groups: state.groups.filter((g) => g.id !== id),
        loading: false
      }))
      // Refresh the tree after deleting
      get().fetchGroupTree()
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete group',
        loading: false
      })
      throw error
    }
  },

  moveGroup: async (id: string, newParentId: string | null) => {
    set({ loading: true, error: null })
    try {
      const updated = await window.api.moveGroup(id, newParentId)
      if (updated) {
        set((state) => ({
          groups: state.groups.map((g) => (g.id === id ? updated : g)),
          loading: false
        }))
        // Refresh the tree after moving
        get().fetchGroupTree()
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to move group',
        loading: false
      })
      throw error
    }
  },

  addProjectToGroup: async (groupId: string, projectId: string) => {
    set({ loading: true, error: null })
    try {
      const updated = await window.api.addProjectToGroup(groupId, projectId)
      if (updated) {
        set((state) => ({
          groups: state.groups.map((g) => (g.id === groupId ? updated : g)),
          loading: false
        }))
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to add project to group',
        loading: false
      })
      throw error
    }
  },

  removeProjectFromGroup: async (groupId: string, projectId: string) => {
    set({ loading: true, error: null })
    try {
      const updated = await window.api.removeProjectFromGroup(groupId, projectId)
      if (updated) {
        set((state) => ({
          groups: state.groups.map((g) => (g.id === groupId ? updated : g)),
          loading: false
        }))
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to remove project from group',
        loading: false
      })
      throw error
    }
  },

  getGroup: (id: string) => {
    return get().groups.find((g) => g.id === id)
  },

  getGroupContext: async (id: string) => {
    return window.api.getGroupContext(id)
  },

  getGroupAncestors: async (id: string) => {
    return window.api.getGroupAncestors(id)
  },

  clearError: () => {
    set({ error: null })
  }
}))
