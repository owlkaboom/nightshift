/**
 * Zustand store for usage limit state
 *
 * Tracks when the queue is paused due to API usage limits
 * and handles automatic resume when the limit resets.
 * Also tracks usage percentage to proactively warn users
 * and stop auto-play before hitting hard limits.
 */

import { create } from 'zustand'
import type { UsageLimitState, UsagePercentageState } from '@shared/ipc-types'

// Track if we've set up the IPC listener
let ipcListenerSetup = false

/** Threshold at which to warn the user about approaching limits */
export const USAGE_WARNING_THRESHOLD = 80

/** Threshold at which to stop auto-play to preserve remaining capacity */
export const USAGE_AUTO_STOP_THRESHOLD = 92

interface UsageLimitStore {
  /** Current usage limit state */
  state: UsageLimitState

  /** Current usage percentage state */
  usagePercentage: UsagePercentageState

  /** Whether we're currently checking if limits have reset */
  checking: boolean

  /** Whether we're currently fetching usage percentage */
  fetchingPercentage: boolean

  /** Timer ID for auto-resume check */
  resumeTimerId: ReturnType<typeof setTimeout> | null

  /** Timer ID for periodic usage percentage polling */
  usagePollingTimerId: ReturnType<typeof setInterval> | null

  // Computed helpers
  /** Returns true if usage is at or above the auto-stop threshold (92%) */
  isNearLimit: () => boolean
  /** Returns true if usage is at or above the warning threshold (80%) */
  shouldShowWarning: () => boolean
  /** Returns the highest usage percentage across all windows */
  getHighestUsage: () => number | null

  // Actions
  fetchState: () => Promise<void>
  fetchUsagePercentage: (retryCount?: number) => Promise<UsagePercentageState>
  clearLimit: () => Promise<void>
  scheduleAutoResume: () => void
  cancelAutoResume: () => void
  startUsagePolling: (intervalMs?: number) => void
  stopUsagePolling: () => void

  // Internal: update from IPC event
  _updateFromEvent: (state: UsageLimitState) => void
}

export const useUsageLimitStore = create<UsageLimitStore>((set, get) => ({
  state: {
    isPaused: false,
    pausedAt: null,
    resumeAt: null,
    triggeredByTaskId: null
  },
  usagePercentage: {
    fiveHour: null,
    sevenDay: null,
    lastCheckedAt: null,
    error: null
  },
  checking: false,
  fetchingPercentage: false,
  resumeTimerId: null,
  usagePollingTimerId: null,

  // Computed helpers
  isNearLimit: () => {
    const highest = get().getHighestUsage()
    return highest !== null && highest >= USAGE_AUTO_STOP_THRESHOLD
  },

  shouldShowWarning: () => {
    const highest = get().getHighestUsage()
    return highest !== null && highest >= USAGE_WARNING_THRESHOLD
  },

  getHighestUsage: () => {
    const { usagePercentage } = get()
    const values: number[] = []
    if (usagePercentage.fiveHour?.utilization !== undefined) {
      values.push(usagePercentage.fiveHour.utilization)
    }
    if (usagePercentage.sevenDay?.utilization !== undefined) {
      values.push(usagePercentage.sevenDay.utilization)
    }
    return values.length > 0 ? Math.max(...values) : null
  },

  fetchState: async () => {
    try {
      const state = await window.api.getUsageLimitState()
      set({ state })

      // If paused with a resume time, schedule auto-resume
      if (state.isPaused && state.resumeAt) {
        get().scheduleAutoResume()
      }
    } catch (error) {
      console.error('Failed to fetch usage limit state:', error)
    }
  },

  fetchUsagePercentage: async (retryCount = 0) => {
    const MAX_RETRIES = 3
    const RETRY_DELAY_MS = 2000 // Start with 2 seconds

    set({ fetchingPercentage: true })
    try {
      const usagePercentage = await window.api.getUsagePercentage()
      set({ usagePercentage, fetchingPercentage: false })
      return usagePercentage
    } catch (error) {
      console.error('Failed to fetch usage percentage:', error)

      // If we haven't exceeded max retries and it looks like an auth issue, retry with backoff
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, retryCount) // Exponential backoff
        console.log(
          `[UsageLimit] Retrying fetch in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`
        )

        // Wait and retry
        await new Promise((resolve) => setTimeout(resolve, delay))
        return get().fetchUsagePercentage(retryCount + 1)
      }

      // All retries exhausted, set error state
      const errorState: UsagePercentageState = {
        fiveHour: null,
        sevenDay: null,
        lastCheckedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      set({ usagePercentage: errorState, fetchingPercentage: false })
      return errorState
    }
  },

  clearLimit: async () => {
    try {
      await window.api.clearUsageLimit()
      get().cancelAutoResume()
      set({
        state: {
          isPaused: false,
          pausedAt: null,
          resumeAt: null,
          triggeredByTaskId: null
        }
      })
    } catch (error) {
      console.error('Failed to clear usage limit:', error)
    }
  },

  scheduleAutoResume: () => {
    const { state, resumeTimerId } = get()

    // Cancel any existing timer
    if (resumeTimerId) {
      clearTimeout(resumeTimerId)
    }

    if (!state.resumeAt) {
      return
    }

    const resumeTime = new Date(state.resumeAt).getTime()
    const now = Date.now()
    const delay = resumeTime - now

    // If the resume time has already passed, clear immediately
    if (delay <= 0) {
      get().clearLimit()
      return
    }

    // Schedule auto-resume (with a small buffer to ensure the limit has reset)
    const timerId = setTimeout(
      () => {
        set({ checking: true })
        get()
          .clearLimit()
          .finally(() => {
            set({ checking: false })
          })
      },
      delay + 5000 // Add 5 second buffer
    )

    set({ resumeTimerId: timerId })
  },

  cancelAutoResume: () => {
    const { resumeTimerId } = get()
    if (resumeTimerId) {
      clearTimeout(resumeTimerId)
      set({ resumeTimerId: null })
    }
  },

  startUsagePolling: (intervalMs = 60000) => {
    // Stop any existing polling
    get().stopUsagePolling()

    // Fetch immediately
    get().fetchUsagePercentage()

    // Set up interval for periodic polling
    const timerId = setInterval(() => {
      get().fetchUsagePercentage()
    }, intervalMs)

    set({ usagePollingTimerId: timerId })
  },

  stopUsagePolling: () => {
    const { usagePollingTimerId } = get()
    if (usagePollingTimerId) {
      clearInterval(usagePollingTimerId)
      set({ usagePollingTimerId: null })
    }
  },

  _updateFromEvent: (state: UsageLimitState) => {
    set({ state })

    // If paused with a resume time, schedule auto-resume
    if (state.isPaused && state.resumeAt) {
      get().scheduleAutoResume()
    } else if (!state.isPaused) {
      get().cancelAutoResume()
    }
  }
}))

// Set up IPC listener for usage limit state changes from main process
// This runs once when the module is first imported
if (!ipcListenerSetup && typeof window !== 'undefined' && window.api) {
  ipcListenerSetup = true
  window.api.onUsageLimitStateChanged((state) => {
    useUsageLimitStore.getState()._updateFromEvent(state)
  })
}
