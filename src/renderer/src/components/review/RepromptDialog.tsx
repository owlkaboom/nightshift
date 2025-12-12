/**
 * RepromptDialog - Dialog for modifying and re-running a task with a new prompt
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
import { Loader2, ChevronDown, ChevronRight, RefreshCw, Info } from 'lucide-react'
import type { TaskManifest } from '@shared/types'

interface RepromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: TaskManifest
  onReprompt: (newPrompt: string) => Promise<void>
  isSubmitting?: boolean
  /** Whether to show the "Retry with Context" option */
  showRetryWithContext?: boolean
}

export function RepromptDialog({
  open,
  onOpenChange,
  task,
  onReprompt,
  isSubmitting = false,
  showRetryWithContext = false
}: RepromptDialogProps) {
  const [prompt, setPrompt] = useState(task.prompt) // HTML content
  const [promptText, setPromptText] = useState('') // Plain text for validation
  const [showHistory, setShowHistory] = useState(false)
  const [isLoadingContext, setIsLoadingContext] = useState(false)
  const [contextSummary, setContextSummary] = useState<string | null>(null)

  // Pre-populate with current prompt when dialog opens
  useEffect(() => {
    if (open) {
      setPrompt(task.prompt)
      setShowHistory(false)
      setContextSummary(null)
    }
  }, [open, task.prompt])

  // Load retry context when requested
  const handleLoadRetryContext = async () => {
    setIsLoadingContext(true)
    try {
      const result = await window.api.generateRetryContext(
        task.projectId,
        task.id,
        task.currentIteration
      )
      if (result) {
        setPrompt(result.prompt)
        setContextSummary(result.summary)
      }
    } catch (error) {
      console.error('Failed to generate retry context:', error)
    } finally {
      setIsLoadingContext(false)
    }
  }

  const handleSubmit = async () => {
    if (!promptText.trim() || isSubmitting) return
    await onReprompt(prompt) // Send HTML content
  }

  const nextIteration = (task.currentIteration || 1) + 1
  const hasHistory = task.iterations && task.iterations.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Re-prompt Task</DialogTitle>
          <DialogDescription>
            Modify the prompt and queue the task for another iteration. This will be iteration{' '}
            {nextIteration}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 py-4">
          {/* Previous iterations history */}
          {hasHistory && (
            <div className="text-sm">
              <button
                type="button"
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowHistory(!showHistory)}
              >
                {showHistory ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Previous prompts ({task.iterations!.length} iterations)
              </button>

              {showHistory && (
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                  {task.iterations!.map((iter) => (
                    <div
                      key={iter.iteration}
                      className="p-2 bg-muted rounded-md border border-border"
                    >
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span className="font-medium">Iteration {iter.iteration}</span>
                        <span>
                          {iter.finalStatus === 'needs_review' ? 'Completed' : iter.finalStatus}
                        </span>
                      </div>
                      <pre className="whitespace-pre-wrap text-xs max-h-24 overflow-y-auto">
                        {iter.prompt}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Retry with context option for failed tasks */}
          {showRetryWithContext && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    This task was interrupted or failed. You can retry with context to help the AI continue from where it left off.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadRetryContext}
                    disabled={isLoadingContext || isSubmitting}
                    className="border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900"
                  >
                    {isLoadingContext ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    )}
                    Generate Retry with Context
                  </Button>
                  {contextSummary && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      {contextSummary}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Prompt editor */}
          <div className="space-y-2">
            <label htmlFor="prompt" className="text-sm font-medium">
              New Prompt
            </label>
            <RichTextEditor
              variant="compact"
              content={prompt}
              onChange={(html, text) => {
                setPrompt(html)
                setPromptText(text)
              }}
              placeholder="Enter the modified prompt..."
              minHeight="200px"
              maxHeight="400px"
            />
            <p className="text-xs text-muted-foreground">
              Tip: You can refine your instructions based on the previous results.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !promptText.trim()}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Queue Iteration {nextIteration}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
