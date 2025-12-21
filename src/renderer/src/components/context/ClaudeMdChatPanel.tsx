/**
 * ClaudeMdChatPanel - Chat interface for iterating on CLAUDE.md with AI
 *
 * Provides a conversational interface to:
 * - Get suggestions for improving CLAUDE.md
 * - Ask questions about project documentation
 * - Iterate on specific sections
 * - Review and apply AI-suggested improvements
 */

import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { usePlanningStore } from '@/stores'
import { PlanningChat, PlanningInput, PlanningSessionList } from '@/components/planning'
import { Button } from '@/components/ui/button'
import { MessageSquare, Loader2, XCircle, Plus } from 'lucide-react'
import type { ContextAttachment, PlanningSession } from '@shared/types'
import { createContextAttachment } from '@shared/types'

interface ClaudeMdChatPanelProps {
  /** Project ID for the CLAUDE.md being edited */
  projectId: string

  /** Path to the CLAUDE.md file */
  claudeMdPath: string

  /** Current CLAUDE.md content */
  claudeMdContent: string

  /** Optional initial prompt to start the conversation with */
  initialPrompt?: string

  /** Callback when user wants to apply a suggested change */
  onApplySuggestion?: (content: string) => void

  /** Callback when the initial prompt has been used */
  onPromptUsed?: () => void
}

export function ClaudeMdChatPanel({
  projectId,
  claudeMdPath,
  claudeMdContent,
  initialPrompt,
  onApplySuggestion,
  onPromptUsed
}: ClaudeMdChatPanelProps) {
  const {
    sessions,
    createSession,
    sendMessage,
    interruptAndSend,
    cancelResponse,
    deleteSession,
    setCurrentSession,
    loadSession,
    fetchAllSessions,
    isSessionAwaitingResponse,
    isSessionStreaming,
    getSessionStreamingContent,
    getSessionActivity
  } = usePlanningStore()

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [localSession, setLocalSession] = useState<PlanningSession | null>(null)
  const [initializing, setInitializing] = useState(false)
  const hasAutoStartedRef = useRef(false)

  // Load all sessions on mount
  useEffect(() => {
    fetchAllSessions()
  }, [fetchAllSessions])

  // Filter sessions to only claude-md sessions for this project
  const contextSessions = useMemo(() => {
    return sessions.filter((s) => s.projectId === projectId && s.sessionType === 'claude-md')
  }, [sessions, projectId])

  // Auto-select the most recent session if available
  useEffect(() => {
    if (!sessionId && contextSessions.length > 0) {
      const mostRecent = contextSessions[0] // Sessions are sorted by updatedAt desc
      setSessionId(mostRecent.id)
      setLocalSession(mostRecent)
    }
  }, [contextSessions, sessionId])

  // Keep local session in sync with sessions array
  useEffect(() => {
    if (sessionId) {
      const updatedSession = sessions.find((s) => s.id === sessionId)
      if (updatedSession) {
        setLocalSession(updatedSession)
      }
    }
  }, [sessions, sessionId])

  // Handle starting a new chat session
  const handleStartChat = useCallback(async () => {
    setInitializing(true)
    try {
      // Create context attachment for CLAUDE.md
      const claudeMdAttachment: ContextAttachment = createContextAttachment(
        'file',
        'CLAUDE.md',
        claudeMdPath,
        { content: claudeMdContent }
      )

      // Create a new planning session with claude-md type (without auto-sending a message)
      const session = await createSession({
        projectId,
        sessionType: 'claude-md'
      })

      // Add CLAUDE.md as context attachment
      await window.api.addPlanningContextAttachment({
        sessionId: session.id,
        attachment: claudeMdAttachment
      })

      setSessionId(session.id)
      setLocalSession(session)

      // If there's an initial prompt, send it immediately
      if (initialPrompt) {
        // Set this as the current session so sendMessage works
        setCurrentSession(session.id)
        await sendMessage(initialPrompt)

        // Notify parent that we've used the prompt
        if (onPromptUsed) {
          onPromptUsed()
        }
      }
    } catch (error) {
      console.error('[ClaudeMdChatPanel] Failed to create session:', error)
    } finally {
      setInitializing(false)
    }
  }, [projectId, claudeMdPath, claudeMdContent, initialPrompt, createSession, sendMessage, setCurrentSession, onPromptUsed])

  // Auto-start chat when initial prompt is provided
  useEffect(() => {
    if (initialPrompt && !sessionId && !initializing && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true
      handleStartChat()
    }
  }, [initialPrompt, sessionId, initializing, handleStartChat])

  // Reset auto-start flag when initial prompt changes or is cleared
  useEffect(() => {
    if (!initialPrompt) {
      hasAutoStartedRef.current = false
    }
  }, [initialPrompt])

  // Handle sending a message
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!sessionId) return
      // Temporarily set this as the current session for sendMessage to work
      setCurrentSession(sessionId)
      await sendMessage(content)
    },
    [sessionId, sendMessage, setCurrentSession]
  )

  // Handle canceling response
  const handleCancelResponse = useCallback(async () => {
    await cancelResponse()
  }, [cancelResponse])

  // Handle selecting a session
  const handleSelectSession = useCallback(async (id: string) => {
    try {
      await loadSession(id)
      setSessionId(id)
      const session = sessions.find((s) => s.id === id)
      if (session) {
        setLocalSession(session)
      }
    } catch (error) {
      console.error('[ClaudeMdChatPanel] Failed to load session:', error)
    }
  }, [loadSession, sessions])

  // Handle deleting a session
  const handleDeleteSession = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this chat? All messages will be lost.')) {
      return
    }

    try {
      await deleteSession(id)
      // If we deleted the current session, clear it
      if (sessionId === id) {
        setSessionId(null)
        setLocalSession(null)
      }
      hasAutoStartedRef.current = false
    } catch (error) {
      console.error('[ClaudeMdChatPanel] Failed to delete session:', error)
      alert('Failed to delete chat')
    }
  }, [sessionId, deleteSession])

  // Check if we have an active session
  const hasSession = !!sessionId && !!localSession
  const messages = hasSession ? localSession.messages : []

  // Get per-session streaming state
  const isAwaitingResponse = hasSession ? isSessionAwaitingResponse(sessionId) : false
  const isStreaming = hasSession ? isSessionStreaming(sessionId) : false
  const streamingContent = hasSession ? getSessionStreamingContent(sessionId) : ''

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4">
      {/* Session list sidebar */}
      <div className="w-full lg:w-64 flex-shrink-0 border rounded-lg bg-card max-h-48 lg:max-h-none overflow-y-auto">
        <PlanningSessionList
          sessions={contextSessions}
          currentSessionId={sessionId}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onNewSession={handleStartChat}
          projects={[]} // We don't show project names since we're already scoped to one project
        />
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col border rounded-lg bg-card min-w-0 min-h-0">
        {!hasSession ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="rounded-full bg-muted p-6 mb-4">
              <MessageSquare className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Start a CLAUDE.md chat</h2>
            <p className="text-muted-foreground max-w-sm mb-4">
              Get AI suggestions for improving your CLAUDE.md file, ask questions about project
              documentation, or iterate on specific sections.
            </p>
            <Button onClick={handleStartChat} disabled={initializing}>
              {initializing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  New Chat
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            {/* Session header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquare className="h-4 w-4 text-primary flex-shrink-0" />
                <h3 className="font-medium truncate">{localSession.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                {(isStreaming || isAwaitingResponse) && (
                  <Button variant="ghost" size="sm" onClick={handleCancelResponse}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {/* Chat messages */}
            <div className="flex-1 overflow-hidden">
              <PlanningChat
                key={`context-chat-${sessionId}`}
                messages={messages}
                isAwaitingResponse={isAwaitingResponse}
                isStreaming={isStreaming}
                streamingContent={streamingContent}
                currentActivity={sessionId ? getSessionActivity(sessionId) : null}
                onCreateTaskFromSection={onApplySuggestion}
              />
            </div>

            {/* Input */}
            <div className="border-t">
              <PlanningInput
                key={`context-${sessionId}`}
                onSend={handleSendMessage}
                onInterruptAndSend={interruptAndSend}
                onCancel={handleCancelResponse}
                isAwaitingResponse={isAwaitingResponse}
                isStreaming={isStreaming}
                disabled={!hasSession}
                projectId={projectId}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
