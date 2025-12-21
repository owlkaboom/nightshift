/**
 * ReplyDialog - Dialog for replying to a task (continuing conversation with --resume)
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Loader2 } from 'lucide-react'
import type { TaskManifest } from '@shared/types'

interface ReplyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: TaskManifest
  onReply: (replyMessage: string) => Promise<void>
  isSubmitting?: boolean
}

export function ReplyDialog({
  open,
  onOpenChange,
  task,
  onReply,
  isSubmitting = false
}: ReplyDialogProps) {
  const [replyMessage, setReplyMessage] = useState('') // HTML content
  const [replyText, setReplyText] = useState('') // Plain text for validation

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setReplyMessage('')
      setReplyText('')
    }
  }, [open])

  const handleSubmit = async () => {
    if (!replyText.trim() || isSubmitting) return
    await onReply(replyMessage) // Send HTML content
  }

  const nextIteration = (task.currentIteration || 1) + 1

  // Get the last message from the agent (from the most recent iteration)
  const lastIteration = task.iterations?.[task.iterations.length - 1]
  const agentContext = lastIteration?.errorMessage || 'The agent is waiting for your response.'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Reply to Task</DialogTitle>
          <DialogDescription>
            Continue the conversation with the agent. This will resume the session and start
            iteration {nextIteration}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 py-4">
          {/* Show context from last iteration */}
          <div className="p-3 bg-muted rounded-md border border-border">
            <div className="text-xs text-muted-foreground mb-1 font-medium">
              Previous iteration context:
            </div>
            <pre className="whitespace-pre-wrap text-sm max-h-32 overflow-y-auto">
              {agentContext}
            </pre>
          </div>

          {/* Reply message editor */}
          <div className="space-y-2">
            <label htmlFor="reply" className="text-sm font-medium">
              Your Reply
            </label>
            <RichTextEditor
              variant="compact"
              content={replyMessage}
              onChange={(html, text) => {
                setReplyMessage(html)
                setReplyText(text)
              }}
              placeholder="Type your reply to continue the conversation..."
              minHeight="200px"
              maxHeight="400px"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Tip: The agent will continue from where it left off using the same session.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !replyText.trim()}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Reply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
