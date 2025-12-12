/**
 * Zustand store for session-level preferences
 *
 * This store holds preferences that persist for the duration of the app session
 * but are not saved to disk. This is useful for "sticky" UI selections that
 * should persist across dialog opens/closes but reset when the app restarts.
 */

import { create } from 'zustand'

interface SessionState {
  // Agent/model selection - persists across task creation dialogs during session
  sessionAgentId: string | undefined
  sessionModel: string | undefined

  // Project selection - persists across task creation dialogs during session
  sessionProjectId: string | undefined

  // Actions
  setSessionAgent: (agentId: string | undefined) => void
  setSessionModel: (model: string | undefined) => void
  setSessionAgentAndModel: (agentId: string | undefined, model: string | undefined) => void
  clearSessionAgent: () => void
  setSessionProject: (projectId: string | undefined) => void
  clearSessionProject: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  // Initial state - no selection
  sessionAgentId: undefined,
  sessionModel: undefined,
  sessionProjectId: undefined,

  // Set just the agent (and clear model since it may not be valid for new agent)
  setSessionAgent: (agentId: string | undefined) => {
    set({ sessionAgentId: agentId, sessionModel: undefined })
  },

  // Set just the model
  setSessionModel: (model: string | undefined) => {
    set({ sessionModel: model })
  },

  // Set both agent and model at once
  setSessionAgentAndModel: (agentId: string | undefined, model: string | undefined) => {
    set({ sessionAgentId: agentId, sessionModel: model })
  },

  // Clear all session agent preferences
  clearSessionAgent: () => {
    set({ sessionAgentId: undefined, sessionModel: undefined })
  },

  // Set the session project
  setSessionProject: (projectId: string | undefined) => {
    set({ sessionProjectId: projectId })
  },

  // Clear session project preference
  clearSessionProject: () => {
    set({ sessionProjectId: undefined })
  }
}))
