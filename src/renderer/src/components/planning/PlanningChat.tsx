/**
 * PlanningChat - Scrollable message list for planning conversations
 */

import { useEffect, useRef } from 'react'
import type { PlanningMessage } from '@shared/types'
import { PlanningMessage as MessageComponent } from './PlanningMessage'

interface PlanningChatProps {
  /** All messages in the conversation */
  messages: PlanningMessage[]

  /** Whether waiting for agent to start responding */
  isAwaitingResponse: boolean

  /** Whether a response is currently streaming */
  isStreaming: boolean

  /** Current streaming content (accumulated) */
  streamingContent: string

  /** Callback when user wants to create a task from a message section */
  onCreateTaskFromSection?: (content: string) => void

  /** Callback when user wants to view a plan file */
  onViewPlanFile?: (filePath: string) => void
}

export function PlanningChat({
  messages,
  isAwaitingResponse,
  isStreaming,
  streamingContent,
  onCreateTaskFromSection,
  onViewPlanFile
}: PlanningChatProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive or content streams
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingContent, isAwaitingResponse])

  // Show messages, with streaming indicator for incomplete assistant message
  const displayMessages = [...messages]

  // If streaming and last message isn't the streaming one, show streaming indicator
  const lastMessage = displayMessages[displayMessages.length - 1]
  const showStreamingIndicator = isStreaming && (!lastMessage || lastMessage.role !== 'assistant')

  return (
    <div ref={containerRef} className="h-full overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
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
          />
        ))
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
