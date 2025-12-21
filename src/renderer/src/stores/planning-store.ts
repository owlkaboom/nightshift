/**
 * Zustand store for planning session state
 */

import { create } from 'zustand'
import type {
  PlanningSession,
  ExtractedPlanItem,
  TaskManifest,
  CreatePlanningSessionData,
  ContextAttachment,
  StreamingActivity
} from '@shared/types'

// Track if we've set up the IPC listeners
let ipcListenersSetup = false

interface PlanningState {
  /** All loaded planning sessions */
  sessions: PlanningSession[]

  /** Currently active session ID */
  currentSessionId: string | null

  /** Currently active session (derived from sessions) */
  currentSession: PlanningSession | null

  /** Loading state */
  loading: boolean

  /** Error message */
  error: string | null

  /** Map of session IDs to their awaiting response state */
  awaitingResponseSessions: Set<string>

  /** Map of session IDs to their streaming state */
  streamingSessions: Set<string>

  /** Map of session IDs to their streaming content */
  streamingContentBySession: Map<string, string>

  /** Map of session IDs to their current streaming activity */
  currentActivityBySession: Map<string, StreamingActivity | null>

  /** Filter by project ID */
  projectFilter: string | null

  // Actions
  fetchSessions: (projectId?: string) => Promise<void>
  fetchAllSessions: () => Promise<void>
  createSession: (data: CreatePlanningSessionData) => Promise<PlanningSession>
  loadSession: (sessionId: string) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  sendMessage: (content: string, contextAttachments?: ContextAttachment[]) => Promise<void>
  interruptAndSend: (content: string, contextAttachments?: ContextAttachment[]) => Promise<void>
  cancelResponse: () => Promise<void>
  updatePlanItems: (items: ExtractedPlanItem[]) => Promise<void>
  convertToTasks: (itemIds: string[]) => Promise<TaskManifest[]>
  setCurrentSession: (sessionId: string | null) => void
  setProjectFilter: (projectId: string | null) => void
  clearError: () => void

  // Helpers to get per-session state
  isSessionAwaitingResponse: (sessionId: string) => boolean
  isSessionStreaming: (sessionId: string) => boolean
  getSessionStreamingContent: (sessionId: string) => string
  getSessionActivity: (sessionId: string) => StreamingActivity | null

  // Internal: IPC event handlers
  _handleStreamStart: (sessionId: string) => void
  _handleChunk: (sessionId: string, content: string, fullContent: string) => void
  _handleActivity: (sessionId: string, tool: string, target: string) => void
  _handleComplete: (sessionId: string, session: PlanningSession) => void
  _handleError: (sessionId: string, error: string) => void
  _handleCancelled: (sessionId: string) => void
  _handleSessionUpdate: (session: PlanningSession) => void
}

export const usePlanningStore = create<PlanningState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  currentSession: null,
  loading: false,
  error: null,
  awaitingResponseSessions: new Set(),
  streamingSessions: new Set(),
  streamingContentBySession: new Map(),
  currentActivityBySession: new Map(),
  projectFilter: null,

  fetchSessions: async (projectId?: string) => {
    set({ loading: true, error: null })
    try {
      const sessions = projectId
        ? await window.api.listPlanningSessions(projectId)
        : await window.api.listAllPlanningSessions()
      set({ sessions, loading: false, projectFilter: projectId ?? null })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch sessions',
        loading: false
      })
    }
  },

  fetchAllSessions: async () => {
    set({ loading: true, error: null })
    try {
      const sessions = await window.api.listAllPlanningSessions()
      set({ sessions, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch sessions',
        loading: false
      })
    }
  },

  createSession: async (data: CreatePlanningSessionData) => {
    // Optimistically add user message immediately if there's an initial message
    if (data.initialMessage) {
      const tempUserMessage = {
        id: `temp_${Date.now()}`,
        role: 'user' as const,
        content: data.initialMessage,
        timestamp: new Date().toISOString()
      }
      // Create a temporary session with the user message to show immediately
      const tempSession = {
        id: `temp_session_${Date.now()}`,
        projectId: data.projectId,
        title: data.initialMessage.slice(0, 50) + (data.initialMessage.length > 50 ? '...' : ''),
        sessionType: data.sessionType || 'general',
        status: 'active' as const,
        messages: [tempUserMessage],
        finalPlan: [],
        createdTaskIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        agentId: ''
      }
      set((state) => {
        const newAwaitingSet = new Set(state.awaitingResponseSessions)
        newAwaitingSet.add(tempSession.id)
        return {
          currentSession: tempSession,
          awaitingResponseSessions: newAwaitingSet
        }
      })
    }

    set({ loading: true, error: null })
    try {
      const session = await window.api.createPlanningSession(data)
      set((state) => {
        const newAwaitingSet = new Set(state.awaitingResponseSessions)
        if (data.initialMessage) {
          newAwaitingSet.add(session.id)
        }
        return {
          sessions: [session, ...state.sessions],
          currentSessionId: session.id,
          currentSession: session,
          loading: false,
          awaitingResponseSessions: newAwaitingSet
        }
      })
      return session
    } catch (error) {
      set((state) => {
        const newAwaitingSet = new Set(state.awaitingResponseSessions)
        if (state.currentSession) {
          newAwaitingSet.delete(state.currentSession.id)
        }
        return {
          error: error instanceof Error ? error.message : 'Failed to create session',
          loading: false,
          awaitingResponseSessions: newAwaitingSet
        }
      })
      throw error
    }
  },

  loadSession: async (sessionId: string) => {
    set({ loading: true, error: null })
    try {
      const session = await window.api.getPlanningSession(sessionId)
      if (session) {
        set({
          currentSessionId: sessionId,
          currentSession: session,
          loading: false
        })
        // Update in sessions list if present
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === sessionId ? session : s))
        }))
      } else {
        set({
          error: 'Session not found',
          loading: false
        })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load session',
        loading: false
      })
    }
  },

  deleteSession: async (sessionId: string) => {
    set({ loading: true, error: null })
    try {
      await window.api.deletePlanningSession(sessionId)
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
        currentSession: state.currentSessionId === sessionId ? null : state.currentSession,
        loading: false
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete session',
        loading: false
      })
    }
  },

  sendMessage: async (content: string, contextAttachments?: ContextAttachment[]) => {
    const { currentSessionId, currentSession } = get()
    if (!currentSessionId || !currentSession) {
      set({ error: 'No active session' })
      return
    }

    // Optimistically add user message and set awaiting state
    const userMessage = {
      id: `temp_${Date.now()}`,
      role: 'user' as const,
      content,
      timestamp: new Date().toISOString(),
      contextAttachments
    }

    set((state) => {
      const newAwaitingSet = new Set(state.awaitingResponseSessions)
      newAwaitingSet.add(currentSessionId)
      return {
        currentSession: state.currentSession
          ? {
              ...state.currentSession,
              messages: [...state.currentSession.messages, userMessage]
            }
          : null,
        error: null,
        awaitingResponseSessions: newAwaitingSet
      }
    })

    try {
      await window.api.sendPlanningMessage({
        sessionId: currentSessionId,
        content,
        contextAttachments
      })
      // Response will come through IPC events
    } catch (error) {
      set((state) => {
        const newAwaitingSet = new Set(state.awaitingResponseSessions)
        const newStreamingSet = new Set(state.streamingSessions)
        newAwaitingSet.delete(currentSessionId)
        newStreamingSet.delete(currentSessionId)
        return {
          error: error instanceof Error ? error.message : 'Failed to send message',
          awaitingResponseSessions: newAwaitingSet,
          streamingSessions: newStreamingSet
        }
      })
    }
  },

  interruptAndSend: async (content: string, contextAttachments?: ContextAttachment[]) => {
    const { currentSessionId, currentSession } = get()
    if (!currentSessionId || !currentSession) {
      set({ error: 'No active session' })
      return
    }

    // Optimistically add user message and set awaiting state
    const userMessage = {
      id: `temp_${Date.now()}`,
      role: 'user' as const,
      content,
      timestamp: new Date().toISOString(),
      contextAttachments
    }

    set((state) => {
      const newAwaitingSet = new Set(state.awaitingResponseSessions)
      newAwaitingSet.add(currentSessionId)
      return {
        currentSession: state.currentSession
          ? {
              ...state.currentSession,
              messages: [...state.currentSession.messages, userMessage]
            }
          : null,
        error: null,
        awaitingResponseSessions: newAwaitingSet
      }
    })

    try {
      await window.api.interruptAndSendPlanningMessage({
        sessionId: currentSessionId,
        content,
        contextAttachments
      })
      // Response will come through IPC events
    } catch (error) {
      set((state) => {
        const newAwaitingSet = new Set(state.awaitingResponseSessions)
        const newStreamingSet = new Set(state.streamingSessions)
        newAwaitingSet.delete(currentSessionId)
        newStreamingSet.delete(currentSessionId)
        return {
          error: error instanceof Error ? error.message : 'Failed to send message',
          awaitingResponseSessions: newAwaitingSet,
          streamingSessions: newStreamingSet
        }
      })
    }
  },

  cancelResponse: async () => {
    const { currentSessionId } = get()
    if (!currentSessionId) return

    try {
      await window.api.cancelPlanningResponse(currentSessionId)
      set((state) => {
        const newStreamingSet = new Set(state.streamingSessions)
        newStreamingSet.delete(currentSessionId)
        return { streamingSessions: newStreamingSet }
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to cancel response'
      })
    }
  },

  updatePlanItems: async (items: ExtractedPlanItem[]) => {
    const { currentSessionId } = get()
    if (!currentSessionId) {
      set({ error: 'No active session' })
      return
    }

    try {
      const updated = await window.api.updatePlanItems(currentSessionId, items)
      if (updated) {
        set((state) => ({
          currentSession: updated,
          sessions: state.sessions.map((s) => (s.id === currentSessionId ? updated : s))
        }))
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update plan items'
      })
    }
  },

  convertToTasks: async (itemIds: string[]) => {
    const { currentSessionId } = get()
    if (!currentSessionId) {
      set({ error: 'No active session' })
      return []
    }

    set({ loading: true, error: null })
    try {
      const tasks = await window.api.convertPlanToTasks(currentSessionId, itemIds)
      // Reload session to get updated status
      await get().loadSession(currentSessionId)
      set({ loading: false })
      return tasks
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to convert to tasks',
        loading: false
      })
      return []
    }
  },

  setCurrentSession: (sessionId: string | null) => {
    if (sessionId) {
      const session = get().sessions.find((s) => s.id === sessionId) || null
      set({
        currentSessionId: sessionId,
        currentSession: session
      })
    } else {
      set({
        currentSessionId: null,
        currentSession: null
      })
    }
  },

  setProjectFilter: (projectId: string | null) => {
    set({ projectFilter: projectId })
    get().fetchSessions(projectId ?? undefined)
  },

  clearError: () => {
    set({ error: null })
  },

  // Helpers to get per-session state
  isSessionAwaitingResponse: (sessionId: string) => {
    return get().awaitingResponseSessions.has(sessionId)
  },

  isSessionStreaming: (sessionId: string) => {
    return get().streamingSessions.has(sessionId)
  },

  getSessionStreamingContent: (sessionId: string) => {
    return get().streamingContentBySession.get(sessionId) || ''
  },

  getSessionActivity: (sessionId: string) => {
    return get().currentActivityBySession.get(sessionId) || null
  },

  // Internal IPC event handlers
  _handleStreamStart: (sessionId: string) => {
    set((state) => {
      const newAwaitingSet = new Set(state.awaitingResponseSessions)
      const newStreamingSet = new Set(state.streamingSessions)
      const newStreamingContent = new Map(state.streamingContentBySession)

      newAwaitingSet.delete(sessionId)
      newStreamingSet.add(sessionId)
      newStreamingContent.set(sessionId, '')

      return {
        awaitingResponseSessions: newAwaitingSet,
        streamingSessions: newStreamingSet,
        streamingContentBySession: newStreamingContent
      }
    })
  },

  _handleChunk: (sessionId: string, _content: string, fullContent: string) => {
    const { currentSessionId, currentSession } = get()

    // Update streaming content for this session
    set((state) => {
      const newStreamingContent = new Map(state.streamingContentBySession)
      newStreamingContent.set(sessionId, fullContent)
      return { streamingContentBySession: newStreamingContent }
    })

    // Only update current session messages if this is the current session
    if (sessionId !== currentSessionId || !currentSession) return

    // Update the last message if it's an assistant message with streaming
    const messages = currentSession.messages
    const lastMessage = messages[messages.length - 1]

    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
      const updatedMessages = [...messages.slice(0, -1), { ...lastMessage, content: fullContent }]
      set({
        currentSession: { ...currentSession, messages: updatedMessages }
      })
    } else if (!lastMessage || lastMessage.role !== 'assistant') {
      // Add new assistant message
      const newMessage = {
        id: `streaming_${Date.now()}`,
        role: 'assistant' as const,
        content: fullContent,
        timestamp: new Date().toISOString(),
        isStreaming: true
      }
      set({
        currentSession: { ...currentSession, messages: [...messages, newMessage] }
      })
    }
  },

  _handleActivity: (sessionId: string, tool: string, target: string) => {
    set((state) => {
      const newActivityMap = new Map(state.currentActivityBySession)
      newActivityMap.set(sessionId, {
        tool,
        target,
        timestamp: new Date().toISOString()
      })
      return { currentActivityBySession: newActivityMap }
    })
  },

  _handleComplete: (sessionId: string, session: PlanningSession) => {
    const { currentSessionId } = get()

    set((state) => {
      const newAwaitingSet = new Set(state.awaitingResponseSessions)
      const newStreamingSet = new Set(state.streamingSessions)
      const newStreamingContent = new Map(state.streamingContentBySession)
      const newActivityMap = new Map(state.currentActivityBySession)

      newAwaitingSet.delete(sessionId)
      newStreamingSet.delete(sessionId)
      newStreamingContent.delete(sessionId)
      newActivityMap.delete(sessionId)

      return {
        currentSession: sessionId === currentSessionId ? session : state.currentSession,
        awaitingResponseSessions: newAwaitingSet,
        streamingSessions: newStreamingSet,
        streamingContentBySession: newStreamingContent,
        currentActivityBySession: newActivityMap,
        sessions: state.sessions.map((s) => (s.id === sessionId ? session : s))
      }
    })
  },

  _handleError: (sessionId: string, error: string) => {
    const { currentSessionId } = get()

    set((state) => {
      const newAwaitingSet = new Set(state.awaitingResponseSessions)
      const newStreamingSet = new Set(state.streamingSessions)
      const newStreamingContent = new Map(state.streamingContentBySession)
      const newActivityMap = new Map(state.currentActivityBySession)

      newAwaitingSet.delete(sessionId)
      newStreamingSet.delete(sessionId)
      newStreamingContent.delete(sessionId)
      newActivityMap.delete(sessionId)

      return {
        error: sessionId === currentSessionId ? error : state.error,
        awaitingResponseSessions: newAwaitingSet,
        streamingSessions: newStreamingSet,
        streamingContentBySession: newStreamingContent,
        currentActivityBySession: newActivityMap
      }
    })
  },

  _handleCancelled: (sessionId: string) => {
    set((state) => {
      const newAwaitingSet = new Set(state.awaitingResponseSessions)
      const newStreamingSet = new Set(state.streamingSessions)
      const newStreamingContent = new Map(state.streamingContentBySession)
      const newActivityMap = new Map(state.currentActivityBySession)

      newAwaitingSet.delete(sessionId)
      newStreamingSet.delete(sessionId)
      newStreamingContent.delete(sessionId)
      newActivityMap.delete(sessionId)

      return {
        awaitingResponseSessions: newAwaitingSet,
        streamingSessions: newStreamingSet,
        streamingContentBySession: newStreamingContent,
        currentActivityBySession: newActivityMap
      }
    })
  },

  _handleSessionUpdate: (session: PlanningSession) => {
    const { currentSessionId } = get()
    if (session.id === currentSessionId) {
      set({ currentSession: session })
    }
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === session.id ? session : s))
    }))
  }
}))

// Set up IPC listeners for planning events from main process
if (!ipcListenersSetup && typeof window !== 'undefined' && window.api) {
  ipcListenersSetup = true

  window.api.onPlanningStreamStart((data) => {
    usePlanningStore.getState()._handleStreamStart(data.sessionId)
  })

  window.api.onPlanningChunk((data) => {
    usePlanningStore.getState()._handleChunk(data.sessionId, data.content, data.fullContent)
  })

  window.api.onPlanningActivity((data) => {
    usePlanningStore.getState()._handleActivity(data.sessionId, data.tool, data.target)
  })

  window.api.onPlanningComplete((data) => {
    usePlanningStore.getState()._handleComplete(data.sessionId, data.session)
  })

  window.api.onPlanningError((data) => {
    usePlanningStore.getState()._handleError(data.sessionId, data.error)
  })

  window.api.onPlanningCancelled((data) => {
    usePlanningStore.getState()._handleCancelled(data.sessionId)
  })

  window.api.onPlanningSessionUpdate((data) => {
    usePlanningStore.getState()._handleSessionUpdate(data.session)
  })
}
