/**
 * Zustand store for project state
 */

import { create } from 'zustand'
import type { Project } from '@shared/types'
import type { AddProjectData } from '@shared/ipc-types'

interface ProjectState {
  projects: Project[]
  loading: boolean
  error: string | null
  selectedProjectId: string | null

  // Actions
  fetchProjects: () => Promise<void>
  loadSelectedProject: () => Promise<void>
  addProject: (data: AddProjectData) => Promise<Project>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  removeProject: (id: string) => Promise<void>
  selectProject: (id: string | null) => Promise<void>
  getProject: (id: string) => Project | undefined
  clearError: () => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  loading: false,
  error: null,
  selectedProjectId: null,

  fetchProjects: async () => {
    set({ loading: true, error: null })
    try {
      const projects = await window.api.listProjects()
      set({ projects, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch projects',
        loading: false
      })
    }
  },

  loadSelectedProject: async () => {
    try {
      const selectedProjectId = await window.api.getSelectedProjectId()
      console.log('[ProjectStore] Loading selected project:', selectedProjectId)
      // Only set if the project exists in the list
      if (selectedProjectId) {
        const projects = get().projects
        console.log('[ProjectStore] Current projects count:', projects.length)
        // Only validate if projects have been loaded (avoid clearing during initial load)
        if (projects.length > 0) {
          const project = projects.find((p) => p.id === selectedProjectId)
          if (project) {
            console.log('[ProjectStore] Found project, setting selection:', project.name)
            set({ selectedProjectId })
          } else {
            // Project no longer exists, clear the selection
            console.log('[ProjectStore] Project not found in list, clearing selection')
            set({ selectedProjectId: null })
            await window.api.setSelectedProjectId(null)
          }
        } else {
          // Projects not loaded yet, just set the ID optimistically
          console.log('[ProjectStore] Projects not loaded yet, setting optimistically')
          set({ selectedProjectId })
        }
      } else {
        console.log('[ProjectStore] No selected project ID in config')
      }
    } catch (error) {
      console.error('[ProjectStore] Failed to load selected project:', error)
    }
  },

  addProject: async (data: AddProjectData) => {
    set({ loading: true, error: null })
    try {
      const project = await window.api.addProject(data)
      set((state) => ({
        projects: [...state.projects, project],
        loading: false
      }))
      return project
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to add project',
        loading: false
      })
      throw error
    }
  },

  updateProject: async (id: string, updates: Partial<Project>) => {
    set({ loading: true, error: null })
    try {
      const updated = await window.api.updateProject(id, updates)
      if (updated) {
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? updated : p)),
          loading: false
        }))
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update project',
        loading: false
      })
      throw error
    }
  },

  removeProject: async (id: string) => {
    set({ loading: true, error: null })
    try {
      await window.api.removeProject(id)
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        selectedProjectId: state.selectedProjectId === id ? null : state.selectedProjectId,
        loading: false
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to remove project',
        loading: false
      })
      throw error
    }
  },

  selectProject: async (id: string | null) => {
    set({ selectedProjectId: id })
    // Persist the selection to config
    await window.api.setSelectedProjectId(id)
  },

  getProject: (id: string) => {
    return get().projects.find((p) => p.id === id)
  },

  clearError: () => {
    set({ error: null })
  }
}))
