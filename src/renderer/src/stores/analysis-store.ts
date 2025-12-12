/**
 * Zustand store for project analysis state
 *
 * Manages technology detection, pattern analysis, and skill recommendations.
 */

import { create } from 'zustand'
import type {
  ProjectAnalysis,
  DetectedTechnology,
  DetectedPattern,
  SkillRecommendation,
  AnalysisProgress,
  ClaudeSkill
} from '@shared/types'

/**
 * Analysis state for a single project
 */
interface ProjectAnalysisState {
  analysis: ProjectAnalysis | null
  progress: AnalysisProgress | null
  loading: boolean
  error: string | null
}

/**
 * Analysis store state
 */
interface AnalysisState {
  /** Analysis state per project */
  analyses: Map<string, ProjectAnalysisState>

  /** Currently analyzing project ID */
  analyzingProjectId: string | null

  /** Whether IPC listeners are set up */
  listenersSetup: boolean

  /** Get analysis for a project */
  getAnalysis: (projectId: string) => ProjectAnalysisState | undefined

  /** Analyze a project */
  analyzeProject: (projectId: string, projectPath: string) => Promise<ProjectAnalysis>

  /** Get cached analysis (without triggering new analysis) */
  getCachedAnalysis: (projectId: string) => Promise<ProjectAnalysis | null>

  /** Detect technologies for a project */
  detectTechnologies: (projectPath: string) => Promise<DetectedTechnology[]>

  /** Detect patterns for a project */
  detectPatterns: (projectPath: string) => Promise<DetectedPattern[]>

  /** Get skill recommendations */
  getRecommendations: (projectId: string) => Promise<SkillRecommendation[]>

  /** Create skills from selected recommendations */
  createSkillsFromRecommendations: (
    projectId: string,
    projectPath: string,
    recommendationIds: string[]
  ) => Promise<ClaudeSkill[]>

  /** Update recommendation selection locally */
  updateRecommendationSelection: (
    projectId: string,
    recommendationId: string,
    selected: boolean
  ) => void

  /** Select/deselect all recommendations */
  selectAllRecommendations: (projectId: string, selected: boolean) => void

  /** Get selected recommendation IDs */
  getSelectedRecommendationIds: (projectId: string) => string[]

  /** Clear cache for a project */
  clearCache: (projectId: string) => Promise<void>

  /** Clear all caches */
  clearAllCaches: () => void

  /** Setup IPC listeners */
  setupListeners: () => void

  /** Update progress from IPC event */
  _updateProgress: (projectId: string, progress: AnalysisProgress) => void

  /** Clear error */
  clearError: (projectId: string) => void
}

/**
 * Create initial state for a project
 */
function createInitialProjectState(): ProjectAnalysisState {
  return {
    analysis: null,
    progress: null,
    loading: false,
    error: null
  }
}

/**
 * Analysis store
 */
export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  analyses: new Map(),
  analyzingProjectId: null,
  listenersSetup: false,

  getAnalysis: (projectId: string) => {
    return get().analyses.get(projectId)
  },

  analyzeProject: async (projectId: string, projectPath: string) => {
    // Get or create project state
    const currentState = get().analyses.get(projectId) || createInitialProjectState()

    // Update state to loading
    const newAnalyses = new Map(get().analyses)
    newAnalyses.set(projectId, {
      ...currentState,
      loading: true,
      error: null,
      progress: { status: 'detecting-technologies', message: 'Starting analysis...', progress: 0 }
    })
    set({ analyses: newAnalyses, analyzingProjectId: projectId })

    try {
      const analysis = await window.api.analyzeProject(projectId, projectPath)

      // Update with results
      const updatedAnalyses = new Map(get().analyses)
      updatedAnalyses.set(projectId, {
        analysis,
        progress: { status: 'complete', message: 'Analysis complete', progress: 100 },
        loading: false,
        error: null
      })
      set({ analyses: updatedAnalyses, analyzingProjectId: null })

      return analysis
    } catch (error) {
      const errorAnalyses = new Map(get().analyses)
      errorAnalyses.set(projectId, {
        ...currentState,
        loading: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
        progress: { status: 'error', message: 'Analysis failed', progress: 0 }
      })
      set({ analyses: errorAnalyses, analyzingProjectId: null })
      throw error
    }
  },

  getCachedAnalysis: async (projectId: string) => {
    // First check local store
    const localState = get().analyses.get(projectId)
    if (localState?.analysis) {
      return localState.analysis
    }

    // Check main process cache
    return window.api.getCachedAnalysis(projectId)
  },

  detectTechnologies: async (projectPath: string) => {
    return window.api.detectTechnologies(projectPath)
  },

  detectPatterns: async (projectPath: string) => {
    return window.api.detectPatterns(projectPath)
  },

  getRecommendations: async (projectId: string) => {
    return window.api.getSkillRecommendations(projectId)
  },

  createSkillsFromRecommendations: async (projectId: string, projectPath: string, recommendationIds: string[]) => {
    return window.api.createSkillsFromRecommendations(projectId, projectPath, recommendationIds)
  },

  updateRecommendationSelection: (projectId: string, recommendationId: string, selected: boolean) => {
    const state = get().analyses.get(projectId)
    if (!state?.analysis) return

    // Update the recommendation selection
    const updatedRecommendations = state.analysis.recommendations.map((rec) =>
      rec.id === recommendationId ? { ...rec, selected } : rec
    )

    const updatedAnalyses = new Map(get().analyses)
    updatedAnalyses.set(projectId, {
      ...state,
      analysis: {
        ...state.analysis,
        recommendations: updatedRecommendations
      }
    })
    set({ analyses: updatedAnalyses })
  },

  selectAllRecommendations: (projectId: string, selected: boolean) => {
    const state = get().analyses.get(projectId)
    if (!state?.analysis) return

    const updatedRecommendations = state.analysis.recommendations.map((rec) => ({
      ...rec,
      selected
    }))

    const updatedAnalyses = new Map(get().analyses)
    updatedAnalyses.set(projectId, {
      ...state,
      analysis: {
        ...state.analysis,
        recommendations: updatedRecommendations
      }
    })
    set({ analyses: updatedAnalyses })
  },

  getSelectedRecommendationIds: (projectId: string) => {
    const state = get().analyses.get(projectId)
    if (!state?.analysis) return []

    return state.analysis.recommendations.filter((rec) => rec.selected).map((rec) => rec.id)
  },

  clearCache: async (projectId: string) => {
    // Clear from main process
    await window.api.clearAnalysisCache(projectId)

    // Clear from local store
    const newAnalyses = new Map(get().analyses)
    newAnalyses.delete(projectId)
    set({ analyses: newAnalyses })
  },

  clearAllCaches: () => {
    set({ analyses: new Map() })
  },

  setupListeners: () => {
    if (get().listenersSetup) return

    // Listen for progress updates
    window.api.onAnalysisProgress(({ projectId, progress }) => {
      get()._updateProgress(projectId, progress)
    })

    set({ listenersSetup: true })
  },

  _updateProgress: (projectId: string, progress: AnalysisProgress) => {
    const state = get().analyses.get(projectId) || createInitialProjectState()

    const updatedAnalyses = new Map(get().analyses)
    updatedAnalyses.set(projectId, {
      ...state,
      progress
    })
    set({ analyses: updatedAnalyses })
  },

  clearError: (projectId: string) => {
    const state = get().analyses.get(projectId)
    if (!state) return

    const updatedAnalyses = new Map(get().analyses)
    updatedAnalyses.set(projectId, {
      ...state,
      error: null
    })
    set({ analyses: updatedAnalyses })
  }
}))
