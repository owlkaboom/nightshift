/**
 * PlanningInput - Message input for planning conversations
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Send, Square, Paperclip, Mic, Loader2 } from 'lucide-react'
import type { ContextAttachment } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ContextAttachmentDialog } from './ContextAttachmentDialog'
import { ContextAttachmentList } from './ContextAttachmentList'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { Progress } from '@/components/ui/progress'
import { kbd } from '@/hooks/useKeyboardShortcuts'

interface PlanningInputProps {
  /** Called when user sends a message */
  onSend: (content: string, contextAttachments?: ContextAttachment[]) => Promise<void>

  /** Called when user wants to cancel the current response */
  onCancel: () => Promise<void>

  /** Whether waiting for agent to start responding */
  isAwaitingResponse: boolean

  /** Whether a response is currently streaming */
  isStreaming: boolean

  /** Whether input is disabled */
  disabled?: boolean

  /** Project ID for context loading */
  projectId: string
}

export function PlanningInput({
  onSend,
  onCancel,
  isAwaitingResponse,
  isStreaming,
  disabled,
  projectId
}: PlanningInputProps) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [contextAttachments, setContextAttachments] = useState<ContextAttachment[]>([])
  const [showContextDialog, setShowContextDialog] = useState(false)

  // Consider input busy when awaiting response or streaming
  const isBusy = isAwaitingResponse || isStreaming
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Voice recognition
  const {
    status: speechStatus,
    isListening,
    transcript,
    isModelLoaded,
    modelLoadProgress,
    startListening,
    stopListening,
    clearTranscript,
    loadModel
  } = useSpeechRecognition({
    onResult: (text) => {
      // When transcription completes, append to message
      setMessage((prev) => {
        const trimmed = prev.trim()
        return trimmed ? `${trimmed} ${text}` : text
      })
      clearTranscript()
    }
  })

  const isModelLoading = speechStatus === 'loading_model'
  const isProcessing = speechStatus === 'processing'

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus()
    }
  }, [disabled])

  // Toggle voice listening
  const handleToggleVoice = useCallback(async () => {
    if (isListening) {
      stopListening()
    } else {
      if (!isModelLoaded) {
        await loadModel()
      }
      await startListening()
    }
  }, [isListening, stopListening, startListening, isModelLoaded, loadModel])

  // Get display message (combine typed message with interim transcript)
  const displayMessage =
    isListening && transcript ? message + (message ? ' ' : '') + transcript : message

  // Handle sending the message
  const handleSend = useCallback(async () => {
    const trimmed = message.trim()
    if (!trimmed || sending || isBusy || disabled) return

    setSending(true)
    try {
      await onSend(trimmed, contextAttachments.length > 0 ? contextAttachments : undefined)
      setMessage('')
      setContextAttachments([]) // Clear attachments after sending
    } finally {
      setSending(false)
    }
  }, [message, contextAttachments, sending, isBusy, disabled, onSend])

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd/Ctrl + Enter to send
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  // Handle cancel
  const handleCancel = useCallback(async () => {
    await onCancel()
  }, [onCancel])

  const canSend = message.trim().length > 0 && !sending && !isBusy && !disabled

  // Get placeholder text based on state
  const getPlaceholder = () => {
    if (isAwaitingResponse) return 'Awaiting response...'
    if (isStreaming) return 'Agent is typing...'
    return 'Describe what you want to build or ask follow-up questions...'
  }

  return (
    <div className="p-3 sm:p-4 border-t">
      {/* Model loading indicator */}
      {isModelLoading && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Downloading speech recognition model...
          </div>
          <Progress value={modelLoadProgress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {Math.round(modelLoadProgress)}% - This is a one-time download
          </p>
        </div>
      )}

      {/* Context attachments */}
      {contextAttachments.length > 0 && (
        <div className="mb-3 p-2 rounded-md bg-muted/50">
          <div className="text-xs text-muted-foreground mb-2">Context for this message:</div>
          <ContextAttachmentList
            attachments={contextAttachments}
            onRemove={(id) =>
              setContextAttachments((prev) => prev.filter((a) => a.id !== id))
            }
          />
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={displayMessage}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            disabled={disabled || isBusy || isListening}
            className={'min-h-[60px] sm:min-h-[80px] resize-none text-sm' + (isListening ? ' ring-2 ring-red-500 ring-offset-2' : '')}
            rows={3}
          />
          {isListening && (
            <div className="absolute top-2 right-2 flex items-center gap-1.5 text-xs text-red-500">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              Listening...
            </div>
          )}
          {isProcessing && (
            <div className="absolute top-2 right-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Transcribing...
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowContextDialog(true)}
            disabled={disabled || isBusy || isListening}
            title="Add context (file, URL, note, or project)"
            className="shrink-0"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            variant={isListening ? 'destructive' : 'outline'}
            size="icon"
            onClick={handleToggleVoice}
            disabled={disabled || isBusy || isModelLoading || isProcessing}
            title={isListening ? 'Stop voice input' : 'Start voice input'}
            className="shrink-0"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isListening ? (
              <Square className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
          {isBusy ? (
            <Button
              variant="destructive"
              size="icon"
              onClick={handleCancel}
              title="Cancel response"
              className="shrink-0"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!canSend || isListening}
              title={`Send message (${kbd.mod}+Enter)`}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2 hidden sm:block">
        Press <kbd className="px-1 py-0.5 rounded bg-muted text-xs">{kbd.mod}+Enter</kbd> to send
      </p>

      {/* Context attachment dialog */}
      <ContextAttachmentDialog
        open={showContextDialog}
        onOpenChange={setShowContextDialog}
        onAdd={(attachment) => {
          setContextAttachments((prev) => [...prev, attachment])
        }}
        projectId={projectId}
      />
    </div>
  )
}
