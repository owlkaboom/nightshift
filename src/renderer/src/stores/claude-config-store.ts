/**
 * Claude Config Store
 *
 * Zustand store for managing Claude configuration state including
 * sub-agents, skills, commands, and CLAUDE.md content.
 */

import { create } from 'zustand'
import type {
  ClaudeAgent,
  ClaudeSkill,
  ClaudeCommand,
  ClaudeProjectConfig,
  CreateClaudeAgentData,
  CreateClaudeSkillData,
  CreateClaudeCommandData
} from '@shared/types'

interface ClaudeConfigState {
  // Current project ID
  currentProjectId: string | null

  // Config data
  config: ClaudeProjectConfig | null

  // Loading states
  isLoading: boolean
  isCreating: boolean
  isUpdating: boolean
  isDeleting: boolean

  // Error state
  error: string | null

  // Actions
  setCurrentProject: (projectId: string | null) => void
  scanProject: (projectId: string) => Promise<void>
  refreshConfig: () => Promise<void>

  // Agent actions
  createAgent: (projectId: string, data: CreateClaudeAgentData) => Promise<ClaudeAgent>
  updateAgent: (
    projectId: string,
    name: string,
    updates: Partial<CreateClaudeAgentData>
  ) => Promise<ClaudeAgent>
  deleteAgent: (projectId: string, name: string) => Promise<void>

  // Skill actions
  createSkill: (projectId: string, data: CreateClaudeSkillData) => Promise<ClaudeSkill>
  updateSkill: (
    projectId: string,
    name: string,
    updates: Partial<CreateClaudeSkillData>
  ) => Promise<ClaudeSkill>
  deleteSkill: (projectId: string, name: string) => Promise<void>
  toggleSkill: (projectId: string, name: string, enabled: boolean) => Promise<ClaudeSkill>

  // Command actions
  createCommand: (projectId: string, data: CreateClaudeCommandData) => Promise<ClaudeCommand>
  updateCommand: (
    projectId: string,
    name: string,
    updates: Partial<CreateClaudeCommandData>
  ) => Promise<ClaudeCommand>
  deleteCommand: (projectId: string, name: string) => Promise<void>

  // CLAUDE.md actions
  updateClaudeMd: (projectId: string, content: string) => Promise<void>
  deleteClaudeMd: (projectId: string) => Promise<void>

  // Helper actions
  clearError: () => void
  reset: () => void
}

/**
 * Create the Claude config store
 */
export const useClaudeConfigStore = create<ClaudeConfigState>((set, get) => ({
  // Initial state
  currentProjectId: null,
  config: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  error: null,

  // Set current project
  setCurrentProject: (projectId: string | null) => {
    set({ currentProjectId: projectId })

    // Auto-scan if project is set
    if (projectId) {
      get().scanProject(projectId)
    } else {
      set({ config: null })
    }
  },

  // Scan project for Claude configuration
  scanProject: async (projectId: string) => {
    set({ isLoading: true, error: null })

    try {
      const config = await window.api.scanClaudeConfig(projectId)
      set({ config, currentProjectId: projectId, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to scan project',
        isLoading: false
      })
    }
  },

  // Refresh current project config
  refreshConfig: async () => {
    const { currentProjectId } = get()
    if (!currentProjectId) return

    await get().scanProject(currentProjectId)
  },

  // ============ Agent Actions ============

  createAgent: async (projectId: string, data: CreateClaudeAgentData) => {
    set({ isCreating: true, error: null })

    try {
      const agent = await window.api.createClaudeAgent(projectId, data)

      // Update config with new agent
      const { config } = get()
      if (config) {
        set({
          config: {
            ...config,
            agents: [...config.agents, agent]
          },
          isCreating: false
        })
      } else {
        set({ isCreating: false })
      }

      return agent
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create agent'
      set({ error: errorMessage, isCreating: false })
      throw new Error(errorMessage)
    }
  },

  updateAgent: async (
    projectId: string,
    name: string,
    updates: Partial<CreateClaudeAgentData>
  ) => {
    set({ isUpdating: true, error: null })

    try {
      const agent = await window.api.updateClaudeAgent(projectId, name, updates)

      // Update config with modified agent
      const { config } = get()
      if (config) {
        set({
          config: {
            ...config,
            agents: config.agents.map((a) => (a.name === name ? agent : a))
          },
          isUpdating: false
        })
      } else {
        set({ isUpdating: false })
      }

      return agent
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update agent'
      set({ error: errorMessage, isUpdating: false })
      throw new Error(errorMessage)
    }
  },

  deleteAgent: async (projectId: string, name: string) => {
    set({ isDeleting: true, error: null })

    try {
      await window.api.deleteClaudeAgent(projectId, name)

      // Remove agent from config
      const { config } = get()
      if (config) {
        set({
          config: {
            ...config,
            agents: config.agents.filter((a) => a.name !== name)
          },
          isDeleting: false
        })
      } else {
        set({ isDeleting: false })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete agent'
      set({ error: errorMessage, isDeleting: false })
      throw new Error(errorMessage)
    }
  },

  // ============ Skill Actions ============
  // Skills feature has been removed from the codebase

  createSkill: async (_projectId: string, _data: CreateClaudeSkillData) => {
    const errorMessage = 'Skills feature has been removed from the codebase'
    set({ error: errorMessage, isCreating: false })
    throw new Error(errorMessage)
  },

  updateSkill: async (
    _projectId: string,
    _name: string,
    _updates: Partial<CreateClaudeSkillData>
  ) => {
    const errorMessage = 'Skills feature has been removed from the codebase'
    set({ error: errorMessage, isUpdating: false })
    throw new Error(errorMessage)
  },

  deleteSkill: async (_projectId: string, _name: string) => {
    const errorMessage = 'Skills feature has been removed from the codebase'
    set({ error: errorMessage, isDeleting: false })
    throw new Error(errorMessage)
  },

  toggleSkill: async (_projectId: string, _name: string, _enabled: boolean) => {
    const errorMessage = 'Skills feature has been removed from the codebase'
    set({ error: errorMessage, isUpdating: false })
    throw new Error(errorMessage)
  },

  // ============ Command Actions ============

  createCommand: async (projectId: string, data: CreateClaudeCommandData) => {
    set({ isCreating: true, error: null })

    try {
      const command = await window.api.createClaudeCommand(projectId, data)

      // Update config with new command
      const { config } = get()
      if (config) {
        set({
          config: {
            ...config,
            commands: [...config.commands, command]
          },
          isCreating: false
        })
      } else {
        set({ isCreating: false })
      }

      return command
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create command'
      set({ error: errorMessage, isCreating: false })
      throw new Error(errorMessage)
    }
  },

  updateCommand: async (
    projectId: string,
    name: string,
    updates: Partial<CreateClaudeCommandData>
  ) => {
    set({ isUpdating: true, error: null })

    try {
      const command = await window.api.updateClaudeCommand(projectId, name, updates)

      // Update config with modified command
      const { config } = get()
      if (config) {
        set({
          config: {
            ...config,
            commands: config.commands.map((c) => (c.name === name ? command : c))
          },
          isUpdating: false
        })
      } else {
        set({ isUpdating: false })
      }

      return command
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update command'
      set({ error: errorMessage, isUpdating: false })
      throw new Error(errorMessage)
    }
  },

  deleteCommand: async (projectId: string, name: string) => {
    set({ isDeleting: true, error: null })

    try {
      await window.api.deleteClaudeCommand(projectId, name)

      // Remove command from config
      const { config } = get()
      if (config) {
        set({
          config: {
            ...config,
            commands: config.commands.filter((c) => c.name !== name)
          },
          isDeleting: false
        })
      } else {
        set({ isDeleting: false })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete command'
      set({ error: errorMessage, isDeleting: false })
      throw new Error(errorMessage)
    }
  },

  // ============ CLAUDE.md Actions ============

  updateClaudeMd: async (projectId: string, content: string) => {
    set({ isUpdating: true, error: null })

    try {
      await window.api.updateClaudeMd(projectId, content)

      // Update config
      const { config } = get()
      if (config) {
        set({
          config: {
            ...config,
            hasClaudeMd: true,
            claudeMdContent: content
          },
          isUpdating: false
        })
      } else {
        set({ isUpdating: false })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update CLAUDE.md'
      set({ error: errorMessage, isUpdating: false })
      throw new Error(errorMessage)
    }
  },

  deleteClaudeMd: async (projectId: string) => {
    set({ isDeleting: true, error: null })

    try {
      await window.api.deleteClaudeMd(projectId)

      // Update config
      const { config } = get()
      if (config) {
        set({
          config: {
            ...config,
            hasClaudeMd: false,
            claudeMdPath: null,
            claudeMdContent: null
          },
          isDeleting: false
        })
      } else {
        set({ isDeleting: false })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete CLAUDE.md'
      set({ error: errorMessage, isDeleting: false })
      throw new Error(errorMessage)
    }
  },

  // ============ Helper Actions ============

  clearError: () => {
    set({ error: null })
  },

  reset: () => {
    set({
      currentProjectId: null,
      config: null,
      isLoading: false,
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
      error: null
    })
  }
}))
