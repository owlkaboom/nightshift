/**
 * Zustand store for skill state
 */

import { create } from 'zustand'
import type { Skill, SkillCategory } from '@shared/types'
import type { CreateSkillData } from '@shared/ipc-types'

interface SkillState {
  skills: Skill[]
  loading: boolean
  error: string | null

  // Actions
  fetchSkills: () => Promise<void>
  createSkill: (data: CreateSkillData) => Promise<Skill>
  updateSkill: (id: string, updates: Partial<Skill>) => Promise<void>
  deleteSkill: (id: string) => Promise<void>
  toggleSkill: (id: string) => Promise<void>
  setSkillsEnabled: (ids: string[], enabled: boolean) => Promise<void>
  resetSkills: () => Promise<void>
  getSkill: (id: string) => Skill | undefined
  getSkillsByCategory: (category: SkillCategory) => Skill[]
  getEnabledSkills: () => Skill[]
  clearError: () => void
}

export const useSkillStore = create<SkillState>((set, get) => ({
  skills: [],
  loading: false,
  error: null,

  fetchSkills: async () => {
    set({ loading: true, error: null })
    try {
      const skills = await window.api.listSkills()
      set({ skills, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch skills',
        loading: false
      })
    }
  },

  createSkill: async (data: CreateSkillData) => {
    set({ loading: true, error: null })
    try {
      const skill = await window.api.createSkill(data)
      set((state) => ({
        skills: [...state.skills, skill],
        loading: false
      }))
      return skill
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create skill',
        loading: false
      })
      throw error
    }
  },

  updateSkill: async (id: string, updates: Partial<Skill>) => {
    set({ loading: true, error: null })
    try {
      const updated = await window.api.updateSkill(id, updates)
      if (updated) {
        set((state) => ({
          skills: state.skills.map((s) => (s.id === id ? updated : s)),
          loading: false
        }))
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update skill',
        loading: false
      })
      throw error
    }
  },

  deleteSkill: async (id: string) => {
    set({ loading: true, error: null })
    try {
      await window.api.deleteSkill(id)
      set((state) => ({
        skills: state.skills.filter((s) => s.id !== id),
        loading: false
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete skill',
        loading: false
      })
      throw error
    }
  },

  toggleSkill: async (id: string) => {
    set({ error: null })
    try {
      const updated = await window.api.toggleSkill(id)
      if (updated) {
        set((state) => ({
          skills: state.skills.map((s) => (s.id === id ? updated : s))
        }))
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to toggle skill'
      })
      throw error
    }
  },

  setSkillsEnabled: async (ids: string[], enabled: boolean) => {
    set({ error: null })
    try {
      await window.api.setSkillsEnabled(ids, enabled)
      set((state) => ({
        skills: state.skills.map((s) =>
          ids.includes(s.id) ? { ...s, enabled } : s
        )
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update skills'
      })
      throw error
    }
  },

  resetSkills: async () => {
    set({ loading: true, error: null })
    try {
      const skills = await window.api.resetSkills()
      set({ skills, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to reset skills',
        loading: false
      })
      throw error
    }
  },

  getSkill: (id: string) => {
    return get().skills.find((s) => s.id === id)
  },

  getSkillsByCategory: (category: SkillCategory) => {
    return get().skills.filter((s) => s.category === category)
  },

  getEnabledSkills: () => {
    return get().skills.filter((s) => s.enabled)
  },

  clearError: () => {
    set({ error: null })
  }
}))
