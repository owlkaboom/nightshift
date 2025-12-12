/**
 * Zustand store for caching agent configurations and models
 *
 * This store provides fast, cached access to agent configs and models to prevent
 * laggy loading on the task board. The cache is loaded once and only refreshed
 * when explicitly needed (e.g., after config changes).
 */

import { create } from 'zustand'
import type { AgentConfigInfo } from '@shared/ipc-types'
import type { AgentModelInfo } from '@shared/types'

interface AgentCacheState {
  // Cached agent configurations
  agents: AgentConfigInfo[]

  // Cached models per agent ID
  modelsByAgent: Record<string, AgentModelInfo[]>

  // Selected agent and model (from config)
  selectedAgentId: string | null

  // Loading states
  isLoading: boolean
  lastFetched: Date | null

  // Actions
  fetchAll: () => Promise<void>
  getModelsForAgent: (agentId: string) => AgentModelInfo[]
  refresh: () => Promise<void>
  clearCache: () => void
}

export const useAgentCacheStore = create<AgentCacheState>((set, get) => ({
  // Initial state
  agents: [],
  modelsByAgent: {},
  selectedAgentId: null,
  isLoading: false,
  lastFetched: null,

  // Fetch all agent data (configs, selected agent, and models)
  fetchAll: async () => {
    const { isLoading, lastFetched } = get()

    // Prevent duplicate fetches if already loading
    if (isLoading) {
      return
    }

    // If we fetched less than 5 seconds ago, skip (cache is fresh)
    if (lastFetched && Date.now() - lastFetched.getTime() < 5000) {
      return
    }

    set({ isLoading: true })

    try {
      // Fetch agents and selected agent in parallel
      const [agentConfigs, selectedAgentId] = await Promise.all([
        window.api.listAgentConfigs(),
        window.api.getSelectedAgent()
      ])

      // Filter to enabled and available agents
      const availableAgents = agentConfigs.filter((a) => a.enabled && a.available)

      // Determine which agent to fetch models for (selected or first available)
      const agentToFetch = selectedAgentId || availableAgents[0]?.id

      // Build a map of models for all enabled agents
      const modelsByAgent: Record<string, AgentModelInfo[]> = {}

      // Fetch models for all enabled agents in parallel
      const modelPromises = availableAgents.map(async (agent) => {
        try {
          const models = await window.api.getAgentModels(agent.id)
          return { agentId: agent.id, models }
        } catch (error) {
          console.error(`Failed to fetch models for ${agent.id}:`, error)
          return { agentId: agent.id, models: [] }
        }
      })

      const modelResults = await Promise.all(modelPromises)

      for (const { agentId, models } of modelResults) {
        modelsByAgent[agentId] = models
      }

      set({
        agents: availableAgents,
        modelsByAgent,
        selectedAgentId: agentToFetch || null,
        isLoading: false,
        lastFetched: new Date()
      })
    } catch (error) {
      console.error('Failed to fetch agent cache:', error)
      set({ isLoading: false })
    }
  },

  // Get models for a specific agent (from cache)
  getModelsForAgent: (agentId: string) => {
    const { modelsByAgent } = get()
    return modelsByAgent[agentId] || []
  },

  // Refresh the cache (useful after config changes)
  refresh: async () => {
    set({ lastFetched: null }) // Force refresh
    await get().fetchAll()
  },

  // Clear the cache
  clearCache: () => {
    set({
      agents: [],
      modelsByAgent: {},
      selectedAgentId: null,
      lastFetched: null
    })
  }
}))
