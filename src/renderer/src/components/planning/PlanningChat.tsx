/**
 * PlanningChat - Scrollable message list for planning conversations
 */

import { useEffect, useRef, useState } from 'react'
import type { PlanningMessage, StreamingActivity } from '@shared/types'
import { PlanningMessage as MessageComponent } from './PlanningMessage'
import { Loader2 } from 'lucide-react'

interface PlanningChatProps {
  /** All messages in the conversation */
  messages: PlanningMessage[]

  /** Whether waiting for agent to start responding */
  isAwaitingResponse: boolean

  /** Whether a response is currently streaming */
  isStreaming: boolean

  /** Current streaming content (accumulated) */
  streamingContent: string

  /** Current agent activity (tool being used) */
  currentActivity?: StreamingActivity | null

  /** Callback when user wants to create a task from a message section */
  onCreateTaskFromSection?: (content: string) => void

  /** Callback when user wants to view a plan file */
  onViewPlanFile?: (filePath: string) => void

  /** Callback when user wants to create a task from a plan file path */
  onCreateTaskFromPlanFile?: (filePath: string) => void
}

export function PlanningChat({
  messages,
  isAwaitingResponse,
  isStreaming,
  streamingContent: _streamingContent,
  currentActivity,
  onCreateTaskFromSection,
  onViewPlanFile,
  onCreateTaskFromPlanFile
}: PlanningChatProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const prevMessagesLengthRef = useRef(messages.length)

  // Check if user has scrolled away from bottom
  const handleScroll = () => {
    if (!containerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    setShouldAutoScroll(isNearBottom)
  }

  // Auto-scroll to bottom only when:
  // 1. New messages are added (message count changes)
  // 2. Content is actively streaming AND user hasn't scrolled away
  useEffect(() => {
    const messageCountChanged = messages.length !== prevMessagesLengthRef.current
    prevMessagesLengthRef.current = messages.length

    // Always scroll on new messages, or when streaming and user is at bottom
    if (messageCountChanged || (isStreaming && shouldAutoScroll)) {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [messages.length, isStreaming, shouldAutoScroll])

  // Reset auto-scroll when awaiting response (user just sent a message)
  useEffect(() => {
    if (isAwaitingResponse) {
      setShouldAutoScroll(true)
    }
  }, [isAwaitingResponse])

  // Show messages, with streaming indicator for incomplete assistant message
  const displayMessages = [...messages]

  // If streaming and last message isn't the streaming one, show streaming indicator
  const lastMessage = displayMessages[displayMessages.length - 1]
  const showStreamingIndicator = isStreaming && (!lastMessage || lastMessage.role !== 'assistant')

  return (
    <div ref={containerRef} onScroll={handleScroll} className="h-full overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
      {displayMessages.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 text-sm">
          Start the conversation by describing what you want to build
        </div>
      ) : (
        displayMessages.map((message) => (
          <MessageComponent
            key={message.id}
            message={message}
            isStreaming={message.isStreaming || false}
            onCreateTaskFromSection={onCreateTaskFromSection}
            onViewPlanFile={onViewPlanFile}
            onCreateTaskFromPlanFile={onCreateTaskFromPlanFile}
          />
        ))
      )}

      {/* Activity indicator - shown when streaming and we have activity info */}
      {isStreaming && currentActivity && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/30 text-muted-foreground text-xs max-w-fit">
          <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          <span className="font-medium">{currentActivity.tool}</span>
          {currentActivity.target && (
            <span className="truncate max-w-[300px]">{currentActivity.target}</span>
          )}
        </div>
      )}

      {/* Awaiting response indicator - shown after user sends message, before agent starts streaming */}
      {isAwaitingResponse && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="flex space-x-1 shrink-0">
            <span
              className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"
              style={{ animationDelay: '200ms' }}
            />
            <span
              className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"
              style={{ animationDelay: '400ms' }}
            />
          </div>
          <span className="text-xs sm:text-sm">Awaiting response...</span>
        </div>
      )}

      {/* Streaming indicator - shown when agent is actively typing */}
      {showStreamingIndicator && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="flex space-x-1 shrink-0">
            <span
              className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
              style={{ animationDelay: '150ms' }}
            />
            <span
              className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
              style={{ animationDelay: '300ms' }}
            />
          </div>
          <span className="text-xs sm:text-sm">Agent is typing...</span>
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  )
}
