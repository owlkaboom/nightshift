/**
 * ClaudeMdChatPanel - Chat interface for iterating on CLAUDE.md with AI
 *
 * Provides a conversational interface to:
 * - Get suggestions for improving CLAUDE.md
 * - Ask questions about project documentation
 * - Iterate on specific sections
 * - Review and apply AI-suggested improvements
 */

import { useCallback, useEffect, useState, useRef } from 'react'
import { usePlanningStore } from '@/stores'
import { PlanningChat, PlanningInput } from '@/components/planning'
import { Button } from '@/components/ui/button'
import { MessageSquare, Loader2, XCircle, RotateCcw } from 'lucide-react'
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
    isSessionAwaitingResponse,
    isSessionStreaming,
    getSessionStreamingContent,
    getSessionActivity
  } = usePlanningStore()

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [localSession, setLocalSession] = useState<PlanningSession | null>(null)
  const [initializing, setInitializing] = useState(false)
  const hasAutoStartedRef = useRef(false)

  // Find or create a claude-md session for this project
  useEffect(() => {
    const existingSession = sessions.find(
      (s) => s.projectId === projectId && s.sessionType === 'claude-md'
    )

    if (existingSession) {
      setSessionId(existingSession.id)
      setLocalSession(existingSession)
    }
  }, [sessions, projectId])

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

      // Use initial prompt if provided, otherwise default message
      const message = initialPrompt || 'Hi! I want to improve my CLAUDE.md file. Can you review it and suggest improvements?'

      // Create a new planning session with claude-md type
      const session = await createSession({
        projectId,
        sessionType: 'claude-md',
        initialMessage: message
      })

      // Add CLAUDE.md as context attachment
      await window.api.addPlanningContextAttachment({
        sessionId: session.id,
        attachment: claudeMdAttachment
      })

      setSessionId(session.id)
      setLocalSession(session)

      // Notify parent that we've used the prompt
      if (initialPrompt && onPromptUsed) {
        onPromptUsed()
      }
    } catch (error) {
      console.error('[ClaudeMdChatPanel] Failed to create session:', error)
    } finally {
      setInitializing(false)
    }
  }, [projectId, claudeMdPath, claudeMdContent, initialPrompt, createSession, onPromptUsed])

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

  // Handle resetting the chat
  const handleResetChat = useCallback(async () => {
    if (!sessionId) return

    if (!confirm('Are you sure you want to reset this chat? All messages will be deleted.')) {
      return
    }

    try {
      await deleteSession(sessionId)
      setSessionId(null)
      setLocalSession(null)
      hasAutoStartedRef.current = false
    } catch (error) {
      console.error('[ClaudeMdChatPanel] Failed to reset chat:', error)
      alert('Failed to reset chat')
    }
  }, [sessionId, deleteSession])

  // Check if we have an active session
  const hasSession = !!sessionId && !!localSession
  const messages = hasSession ? localSession.messages : []

  // Get per-session streaming state
  const isAwaitingResponse = hasSession ? isSessionAwaitingResponse(sessionId) : false
  const isStreaming = hasSession ? isSessionStreaming(sessionId) : false
  const streamingContent = hasSession ? getSessionStreamingContent(sessionId) : ''

  if (!hasSession) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">AI Assistant for CLAUDE.md</h3>
            <p className="text-sm text-muted-foreground">
              Start a conversation with an AI assistant to get suggestions for improving your CLAUDE.md file,
              ask questions about project documentation, or iterate on specific sections.
            </p>
          </div>
          <Button onClick={handleStartChat} disabled={initializing}>
            {initializing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <MessageSquare className="mr-2 h-4 w-4" />
                Start Chat
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="font-medium">CLAUDE.md AI Assistant</h3>
        </div>
        <div className="flex items-center gap-2">
          {(isStreaming || isAwaitingResponse) && (
            <Button variant="ghost" size="sm" onClick={handleCancelResponse}>
              <XCircle className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleResetChat}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset Chat
          </Button>
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
    </div>
  )
}
