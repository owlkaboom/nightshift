/**
 * AcceptPlanDialog - Dialog for accepting a plan and creating an execution task
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
import { markdownToHtml } from '@/lib/markdown-to-html'
import { Loader2, FileText, Play } from 'lucide-react'
import type { TaskManifest } from '@shared/types'

interface AcceptPlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: TaskManifest
  planFilePath: string | null
  onAcceptAndExecute: (executionPrompt: string) => Promise<void>
  isSubmitting?: boolean
}

export function AcceptPlanDialog({
  open,
  onOpenChange,
  task,
  planFilePath,
  onAcceptAndExecute,
  isSubmitting = false
}: AcceptPlanDialogProps) {
  const [prompt, setPrompt] = useState('') // HTML content
  const [promptText, setPromptText] = useState('') // Plain text for validation
  const [isLoadingPlan, setIsLoadingPlan] = useState(false)

  // Load plan content when dialog opens
  useEffect(() => {
    async function loadPlan() {
      if (!open || !planFilePath) return

      setIsLoadingPlan(true)
      try {
        const content = await window.api.readPlanFile(planFilePath)

        // Generate a default execution prompt based on the plan
        if (content) {
          // Use first line of prompt as title for the execution prompt
          const taskTitle = task.prompt.split('\n')[0].slice(0, 100)
          const defaultPrompt = generateExecutionPrompt(taskTitle, content)
          // Convert markdown to HTML for RichTextEditor
          const htmlPrompt = markdownToHtml(defaultPrompt)
          setPrompt(htmlPrompt)
        }
      } catch (err) {
        console.error('Failed to load plan:', err)
      } finally {
        setIsLoadingPlan(false)
      }
    }

    loadPlan()
  }, [open, planFilePath, task.prompt])

  const handleSubmit = async () => {
    if (!promptText.trim() || isSubmitting) return
    await onAcceptAndExecute(prompt) // Send HTML content
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-blue-500" />
            Accept Plan & Create Execution Task
          </DialogTitle>
          <DialogDescription>
            Review the execution prompt that will be used to implement the plan.
            A new task will be created and added to the queue.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 py-4">
          {/* Plan file reference */}
          {planFilePath && (
            <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-md">
              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-sm text-blue-700 dark:text-blue-300 truncate">
                {planFilePath.split('/').pop()}
              </span>
            </div>
          )}

          {/* Execution prompt editor */}
          <div className="space-y-2">
            <label htmlFor="executionPrompt" className="text-sm font-medium">
              Execution Prompt
            </label>
            {isLoadingPlan ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <RichTextEditor
                variant="compact"
                content={prompt}
                onChange={(html, text) => {
                  setPrompt(html)
                  setPromptText(text)
                }}
                placeholder="Enter the prompt for executing this plan..."
                minHeight="250px"
                maxHeight="500px"
              />
            )}
            <p className="text-xs text-muted-foreground">
              This prompt will be used to create a new task that implements the approved plan.
              You can modify it to add specific instructions or constraints.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !promptText.trim() || isLoadingPlan}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Play className="mr-2 h-4 w-4" />
            Accept & Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Generate a default execution prompt based on the plan content
 */
function generateExecutionPrompt(taskTitle: string, planContent: string): string {
  // Create a prompt that references the plan and instructs execution
  return `Execute the following implementation plan for: ${taskTitle}

## Plan to Execute

${planContent}

## Instructions

Please implement this plan following the steps outlined above. Work through each step methodically and verify that each part works correctly before moving to the next step.

If you encounter any issues or need to deviate from the plan, explain the changes and why they were necessary.`
}
