/**
 * Zustand store for integration state (Connection + Source model)
 */

import { create } from 'zustand'
import type {
  Integration,
  CreateIntegrationData,
  IntegrationConnection,
  IntegrationSource,
  CreateConnectionData,
  CreateSourceData,
  ExternalIssue,
  FetchIssuesOptions,
  IntegrationTestResult,
  JiraBoard,
  JiraSprint,
  JiraFilter,
  JiraProject
} from '@shared/types'

/**
 * Discovery cache for Jira connections
 */
interface JiraDiscoveryCache {
  boards: Map<string, JiraBoard[]> // connectionId -> boards
  sprints: Map<string, Map<number, JiraSprint[]>> // connectionId -> boardId -> sprints
  filters: Map<string, JiraFilter[]> // connectionId -> filters
  projects: Map<string, JiraProject[]> // connectionId -> projects
}

interface IntegrationState {
  // New connection/source model
  connections: IntegrationConnection[]
  sources: IntegrationSource[]
  discoveryCache: JiraDiscoveryCache

  // Legacy support
  integrations: Integration[]

  // Issues by source
  issues: Map<string, ExternalIssue[]> // Map of sourceId -> issues

  loading: boolean
  error: string | null
  testingConnection: string | null // ID of connection being tested
  fetchingIssues: string | null // ID of source fetching issues from
  discoveringBoards: string | null // ID of connection discovering boards
  discoveringFilters: string | null // ID of connection discovering filters

  // Connection actions
  fetchConnections: () => Promise<void>
  getConnection: (id: string) => Promise<IntegrationConnection | null>
  createConnection: (data: CreateConnectionData, token: string) => Promise<IntegrationConnection>
  updateConnection: (
    id: string,
    updates: Partial<Omit<IntegrationConnection, 'id' | 'createdAt'>>
  ) => Promise<IntegrationConnection | null>
  deleteConnection: (id: string) => Promise<void>
  testConnection: (id: string) => Promise<IntegrationTestResult>
  updateConnectionToken: (id: string, token: string) => Promise<void>

  // Source actions
  fetchSources: () => Promise<void>
  getSource: (id: string) => Promise<IntegrationSource | null>
  getSourcesForConnection: (connectionId: string) => IntegrationSource[]
  createSource: (data: CreateSourceData) => Promise<IntegrationSource>
  updateSource: (
    id: string,
    updates: Partial<Omit<IntegrationSource, 'id' | 'createdAt' | 'connectionId'>>
  ) => Promise<IntegrationSource | null>
  deleteSource: (id: string) => Promise<void>
  fetchSourceIssues: (sourceId: string, options?: FetchIssuesOptions) => Promise<ExternalIssue[]>
  getIssuesForSource: (sourceId: string) => ExternalIssue[]

  // Jira discovery actions
  discoverBoards: (connectionId: string) => Promise<JiraBoard[]>
  discoverSprints: (connectionId: string, boardId: number) => Promise<JiraSprint[]>
  discoverFilters: (connectionId: string) => Promise<JiraFilter[]>
  discoverProjects: (connectionId: string) => Promise<JiraProject[]>
  getCachedBoards: (connectionId: string) => JiraBoard[] | undefined
  getCachedFilters: (connectionId: string) => JiraFilter[] | undefined
  getCachedProjects: (connectionId: string) => JiraProject[] | undefined

  // Legacy integration actions (backward compatibility)
  fetchIntegrations: () => Promise<void>
  fetchIntegrationsForProject: (projectId: string) => Promise<Integration[]>
  createIntegration: (data: CreateIntegrationData) => Promise<Integration>
  updateIntegration: (
    id: string,
    updates: Partial<Omit<Integration, 'id' | 'createdAt'>>
  ) => Promise<Integration | null>
  deleteIntegration: (id: string) => Promise<void>
  testIntegration: (id: string) => Promise<IntegrationTestResult>
  fetchIssues: (integrationId: string, options?: FetchIssuesOptions) => Promise<ExternalIssue[]>
  getIssuesForIntegration: (integrationId: string) => ExternalIssue[]

  clearError: () => void
}

export const useIntegrationStore = create<IntegrationState>((set, get) => ({
  // State
  connections: [],
  sources: [],
  discoveryCache: {
    boards: new Map(),
    sprints: new Map(),
    filters: new Map(),
    projects: new Map()
  },
  integrations: [],
  issues: new Map(),
  loading: false,
  error: null,
  testingConnection: null,
  fetchingIssues: null,
  discoveringBoards: null,
  discoveringFilters: null,

  // Connection actions
  fetchConnections: async () => {
    set({ loading: true, error: null })
    try {
      const connections = await window.api.listConnections()
      set({ connections, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch connections',
        loading: false
      })
    }
  },

  getConnection: async (id: string) => {
    try {
      return await window.api.getConnection(id)
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to get connection'
      })
      return null
    }
  },

  createConnection: async (data: CreateConnectionData, token: string) => {
    set({ loading: true, error: null })
    try {
      const connection = await window.api.createConnection(data, token)
      set((state) => ({
        connections: [...state.connections, connection],
        loading: false
      }))
      return connection
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create connection',
        loading: false
      })
      throw error
    }
  },

  updateConnection: async (
    id: string,
    updates: Partial<Omit<IntegrationConnection, 'id' | 'createdAt'>>
  ) => {
    set({ loading: true, error: null })
    try {
      const updated = await window.api.updateConnection(id, updates)
      if (updated) {
        set((state) => ({
          connections: state.connections.map((c) => (c.id === id ? updated : c)),
          loading: false
        }))
      }
      return updated
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update connection',
        loading: false
      })
      return null
    }
  },

  deleteConnection: async (id: string) => {
    set({ loading: true, error: null })
    try {
      await window.api.deleteConnection(id)
      set((state) => {
        // Remove connection and all its sources
        const sources = state.sources.filter((s) => s.connectionId !== id)
        // Clear issues for deleted sources
        const newIssues = new Map(state.issues)
        state.sources.forEach((s) => {
          if (s.connectionId === id) {
            newIssues.delete(s.id)
          }
        })
        return {
          connections: state.connections.filter((c) => c.id !== id),
          sources,
          issues: newIssues,
          loading: false
        }
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete connection',
        loading: false
      })
      throw error
    }
  },

  testConnection: async (id: string) => {
    set({ testingConnection: id, error: null })
    try {
      const result = await window.api.testConnection(id)
      set({ testingConnection: null })
      return result
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to test connection',
        testingConnection: null
      })
      throw error
    }
  },

  updateConnectionToken: async (id: string, token: string) => {
    try {
      await window.api.updateConnectionToken(id, token)
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update token'
      })
      throw error
    }
  },

  // Source actions
  fetchSources: async () => {
    set({ loading: true, error: null })
    try {
      const sources = await window.api.listSources()
      set({ sources, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch sources',
        loading: false
      })
    }
  },

  getSource: async (id: string) => {
    try {
      return await window.api.getSource(id)
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to get source'
      })
      return null
    }
  },

  getSourcesForConnection: (connectionId: string) => {
    return get().sources.filter((s) => s.connectionId === connectionId)
  },

  createSource: async (data: CreateSourceData) => {
    set({ loading: true, error: null })
    try {
      const source = await window.api.createSource(data)
      set((state) => ({
        sources: [...state.sources, source],
        loading: false
      }))
      return source
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create source',
        loading: false
      })
      throw error
    }
  },

  updateSource: async (
    id: string,
    updates: Partial<Omit<IntegrationSource, 'id' | 'createdAt' | 'connectionId'>>
  ) => {
    set({ loading: true, error: null })
    try {
      const updated = await window.api.updateSource(id, updates)
      if (updated) {
        set((state) => ({
          sources: state.sources.map((s) => (s.id === id ? updated : s)),
          loading: false
        }))
      }
      return updated
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update source',
        loading: false
      })
      return null
    }
  },

  deleteSource: async (id: string) => {
    set({ loading: true, error: null })
    try {
      await window.api.deleteSource(id)
      set((state) => {
        const newIssues = new Map(state.issues)
        newIssues.delete(id)
        return {
          sources: state.sources.filter((s) => s.id !== id),
          issues: newIssues,
          loading: false
        }
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete source',
        loading: false
      })
      throw error
    }
  },

  fetchSourceIssues: async (sourceId: string, options?: FetchIssuesOptions) => {
    set({ fetchingIssues: sourceId, error: null })
    try {
      const issues = await window.api.fetchSourceIssues(sourceId, options)
      set((state) => {
        const newIssues = new Map(state.issues)
        newIssues.set(sourceId, issues)
        return {
          issues: newIssues,
          fetchingIssues: null
        }
      })
      return issues
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch issues',
        fetchingIssues: null
      })
      throw error
    }
  },

  getIssuesForSource: (sourceId: string) => {
    return get().issues.get(sourceId) || []
  },

  // Jira discovery actions
  discoverBoards: async (connectionId: string) => {
    set({ discoveringBoards: connectionId, error: null })
    try {
      const boards = await window.api.listJiraBoards(connectionId)
      set((state) => {
        const newCache = { ...state.discoveryCache }
        newCache.boards.set(connectionId, boards)
        return {
          discoveryCache: newCache,
          discoveringBoards: null
        }
      })
      return boards
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to discover boards',
        discoveringBoards: null
      })
      throw error
    }
  },

  discoverSprints: async (connectionId: string, boardId: number) => {
    try {
      const sprints = await window.api.listJiraSprints(connectionId, boardId)
      set((state) => {
        const newCache = { ...state.discoveryCache }
        if (!newCache.sprints.has(connectionId)) {
          newCache.sprints.set(connectionId, new Map())
        }
        newCache.sprints.get(connectionId)!.set(boardId, sprints)
        return { discoveryCache: newCache }
      })
      return sprints
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to discover sprints'
      })
      throw error
    }
  },

  discoverFilters: async (connectionId: string) => {
    set({ discoveringFilters: connectionId, error: null })
    try {
      const filters = await window.api.listJiraFilters(connectionId)
      set((state) => {
        const newCache = { ...state.discoveryCache }
        newCache.filters.set(connectionId, filters)
        return {
          discoveryCache: newCache,
          discoveringFilters: null
        }
      })
      return filters
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to discover filters',
        discoveringFilters: null
      })
      throw error
    }
  },

  discoverProjects: async (connectionId: string) => {
    try {
      const projects = await window.api.listJiraProjects(connectionId)
      set((state) => {
        const newCache = { ...state.discoveryCache }
        newCache.projects.set(connectionId, projects)
        return { discoveryCache: newCache }
      })
      return projects
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to discover projects'
      })
      throw error
    }
  },

  getCachedBoards: (connectionId: string) => {
    return get().discoveryCache.boards.get(connectionId)
  },

  getCachedFilters: (connectionId: string) => {
    return get().discoveryCache.filters.get(connectionId)
  },

  getCachedProjects: (connectionId: string) => {
    return get().discoveryCache.projects.get(connectionId)
  },

  // Legacy integration actions (backward compatibility)
  fetchIntegrations: async () => {
    set({ loading: true, error: null })
    try {
      const integrations = await window.api.listIntegrations()
      set({ integrations, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch integrations',
        loading: false
      })
    }
  },

  fetchIntegrationsForProject: async (projectId: string) => {
    set({ error: null })
    try {
      const integrations = await window.api.listIntegrationsForProject(projectId)
      return integrations
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch project integrations'
      })
      return []
    }
  },

  createIntegration: async (data: CreateIntegrationData) => {
    set({ loading: true, error: null })
    try {
      const integration = await window.api.createIntegration(data)
      set((state) => ({
        integrations: [...state.integrations, integration],
        loading: false
      }))
      return integration
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create integration',
        loading: false
      })
      throw error
    }
  },

  updateIntegration: async (
    id: string,
    updates: Partial<Omit<Integration, 'id' | 'createdAt'>>
  ) => {
    set({ loading: true, error: null })
    try {
      const updated = await window.api.updateIntegration(id, updates)
      if (updated) {
        set((state) => ({
          integrations: state.integrations.map((i) => (i.id === id ? updated : i)),
          loading: false
        }))
      }
      return updated
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update integration',
        loading: false
      })
      return null
    }
  },

  deleteIntegration: async (id: string) => {
    set({ loading: true, error: null })
    try {
      await window.api.deleteIntegration(id)
      set((state) => {
        const newIssues = new Map(state.issues)
        newIssues.delete(id)
        return {
          integrations: state.integrations.filter((i) => i.id !== id),
          issues: newIssues,
          loading: false
        }
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete integration',
        loading: false
      })
      throw error
    }
  },

  testIntegration: async (id: string) => {
    set({ testingConnection: id, error: null })
    try {
      const result = await window.api.testIntegration(id)
      set({ testingConnection: null })
      return result
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to test integration',
        testingConnection: null
      })
      throw error
    }
  },

  fetchIssues: async (integrationId: string, options?: FetchIssuesOptions) => {
    set({ fetchingIssues: integrationId, error: null })
    try {
      const issues = await window.api.fetchIntegrationIssues(integrationId, options)
      set((state) => {
        const newIssues = new Map(state.issues)
        newIssues.set(integrationId, issues)
        return {
          issues: newIssues,
          fetchingIssues: null
        }
      })
      return issues
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch issues',
        fetchingIssues: null
      })
      throw error
    }
  },

  getIssuesForIntegration: (integrationId: string) => {
    return get().issues.get(integrationId) || []
  },

  clearError: () => {
    set({ error: null })
  }
}))
