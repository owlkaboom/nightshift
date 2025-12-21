/**
 * Walkthrough Store
 *
 * Manages the state for the user walkthrough system and feature highlights.
 * Persists state to localStorage for cross-session tracking.
 */

import { create } from 'zustand'
import type { WalkthroughState } from '@shared/types/walkthrough'

const STORAGE_KEY = 'nightshift:walkthrough-state'

/**
 * Load persisted walkthrough state from localStorage
 */
const loadPersistedState = (): WalkthroughState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Migration: remove old lastSeenVersion field if it exists
      const { lastSeenVersion: _ignored, ...rest } = parsed as WalkthroughState & { lastSeenVersion?: string }
      void _ignored // Explicitly ignore
      // Set default for spotlightsEnabled if not present
      return {
        ...rest,
        spotlightsEnabled: rest.spotlightsEnabled ?? true
      }
    }
  } catch (error) {
    console.error('[WalkthroughStore] Failed to load persisted state:', error)
  }

  // Return default state
  return {
    walkthroughCompleted: false,
    walkthroughSkipped: false,
    seenFeatures: [],
    spotlightsEnabled: true
  }
}

/**
 * Persist walkthrough state to localStorage
 */
const persistState = (state: WalkthroughState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.error('[WalkthroughStore] Failed to persist state:', error)
  }
}

interface WalkthroughStoreState extends WalkthroughState {
  // Actions
  /**
   * Mark the walkthrough as completed
   */
  completeWalkthrough: () => void

  /**
   * Mark the walkthrough as skipped
   */
  skipWalkthrough: () => void

  /**
   * Reset walkthrough state (for "Restart Tour" feature)
   */
  resetWalkthrough: () => void

  /**
   * Mark a feature as seen by the user
   */
  markFeatureSeen: (featureId: string) => void

  /**
   * Check if a feature has been seen
   */
  hasSeenFeature: (featureId: string) => boolean

  /**
   * Mark a feature as unseen (remove from seen list)
   */
  markFeatureUnseen: (featureId: string) => void

  /**
   * Mark all features as unseen (clear seen list)
   */
  markAllFeaturesUnseen: () => void

  /**
   * Toggle feature spotlights on/off
   */
  setSpotlightsEnabled: (enabled: boolean) => void

  /**
   * Get all unseen features
   */
  getUnseenFeatures: () => string[]

  /**
   * Check if the walkthrough should be shown
   * (not completed and not skipped)
   */
  shouldShowWalkthrough: () => boolean
}

/**
 * Zustand store for walkthrough state management
 */
export const useWalkthroughStore = create<WalkthroughStoreState>((set, get) => {
  const initialState = loadPersistedState()

  return {
    // Initial state from localStorage
    ...initialState,

    // Actions
    completeWalkthrough: () => {
      set((state) => {
        const newState: WalkthroughState = {
          ...state,
          walkthroughCompleted: true,
          walkthroughSkipped: false
        }
        persistState(newState)
        return newState
      })
    },

    skipWalkthrough: () => {
      set((state) => {
        const newState: WalkthroughState = {
          ...state,
          walkthroughSkipped: true,
          walkthroughCompleted: false
        }
        persistState(newState)
        return newState
      })
    },

    resetWalkthrough: () => {
      set((state) => {
        const newState: WalkthroughState = {
          ...state,
          walkthroughCompleted: false,
          walkthroughSkipped: false
        }
        persistState(newState)
        return newState
      })
    },

    markFeatureSeen: (featureId: string) => {
      set((state) => {
        if (state.seenFeatures.includes(featureId)) {
          return state
        }

        const newState: WalkthroughState = {
          ...state,
          seenFeatures: [...state.seenFeatures, featureId]
        }
        persistState(newState)
        return newState
      })
    },

    hasSeenFeature: (featureId: string) => {
      return get().seenFeatures.includes(featureId)
    },

    markFeatureUnseen: (featureId: string) => {
      set((state) => {
        const newState: WalkthroughState = {
          ...state,
          seenFeatures: state.seenFeatures.filter((id) => id !== featureId)
        }
        persistState(newState)
        return newState
      })
    },

    markAllFeaturesUnseen: () => {
      set((state) => {
        const newState: WalkthroughState = {
          ...state,
          seenFeatures: []
        }
        persistState(newState)
        return newState
      })
    },

    setSpotlightsEnabled: (enabled: boolean) => {
      set((state) => {
        const newState: WalkthroughState = {
          ...state,
          spotlightsEnabled: enabled
        }
        persistState(newState)
        return newState
      })
    },

    getUnseenFeatures: () => {
      return get().seenFeatures
    },

    shouldShowWalkthrough: () => {
      const state = get()
      return !state.walkthroughCompleted && !state.walkthroughSkipped
    }
  }
})

/**
 * Hook to check if walkthrough prompt should be shown
 * Shows prompt if user hasn't completed or skipped the walkthrough
 */
export const useShouldShowWalkthroughPrompt = (): boolean => {
  return useWalkthroughStore((state) => state.shouldShowWalkthrough())
}

/**
 * Hook to check if a feature has been seen
 */
export const useHasSeenFeature = (featureId: string): boolean => {
  return useWalkthroughStore((state) => state.hasSeenFeature(featureId))
}
