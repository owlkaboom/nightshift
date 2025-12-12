/**
 * PlanFileViewer - Dialog to view plan markdown files
 *
 * Displays plan files referenced in planning session messages.
 */

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { FileText, AlertCircle, ListPlus } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { useKeyboardShortcuts, type KeyboardShortcut } from '@/hooks'

interface PlanFileViewerProps {
  /** Whether the dialog is open */
  open: boolean

  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void

  /** File path to display */
  filePath: string | null

  /** Project ID for resolving the file path */
  projectId: string | null

  /** Callback when user wants to create a task from this plan file */
  onCreateTask?: (content: string, filePath: string) => void
}

export function PlanFileViewer({ open, onOpenChange, filePath, projectId, onCreateTask }: PlanFileViewerProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !filePath || !projectId) {
      setContent(null)
      setError(null)
      return
    }

    const loadFile = async () => {
      setLoading(true)
      setError(null)
      try {
        const fileContent = await window.api.readPlanningFile(projectId, filePath)
        setContent(fileContent)
      } catch (err) {
        console.error('Failed to load plan file:', err)
        setError(err instanceof Error ? err.message : 'Failed to load file')
      } finally {
        setLoading(false)
      }
    }

    loadFile()
  }, [open, filePath, projectId])

  // Handle creating task from plan file
  const handleCreateTask = () => {
    if (onCreateTask && content && !loading && !error) {
      onCreateTask(content, filePath || '')
    }
  }

  // Keyboard shortcut for creating task (Cmd/Ctrl+T)
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 't',
      meta: true,
      handler: handleCreateTask,
      description: 'Create task from plan file'
    }
  ]

  useKeyboardShortcuts(shortcuts, { enabled: open && !!content && !loading && !error && !!onCreateTask })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {filePath || 'Plan File'}
          </DialogTitle>
          <DialogDescription>
            {projectId ? `Project plan file` : 'Plan file content'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 mt-4">
          <div className="pr-4">
              {loading && (
                <div className="flex items-center justify-center p-8">
                  <div className="text-muted-foreground">Loading...</div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              {content && !loading && (
                <div className="p-4">
                  <pre className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded-md">
                    {content}
                  </pre>
                </div>
              )}
          </div>
        </ScrollArea>

        {onCreateTask && content && !loading && !error && (
          <DialogFooter className="pt-4 border-t">
            <div className="flex items-center justify-between w-full">
              <p className="text-xs text-muted-foreground">
                <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px] font-mono">⌘+T</kbd> to create task
                {' · '}
                <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px] font-mono">Esc</kbd> to close
              </p>
              <Button
                onClick={handleCreateTask}
                className="gap-2"
              >
                <ListPlus className="h-4 w-4" />
                Create Task from Plan
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
