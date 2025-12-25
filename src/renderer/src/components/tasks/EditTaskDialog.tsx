import type { TaskManifest } from '@shared/types'
import { Brain, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAgentCacheStore } from '@/stores/agent-cache-store'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { RichTextEditor } from '@/components/ui/rich-text-editor'

interface EditTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: TaskManifest | null
  projectName?: string
  onSave: (
    taskId: string,
    projectId: string,
    updates: {
      prompt: string
      agentId?: string
      model?: string
      thinkingMode?: boolean | null
    }
  ) => Promise<void>
}

export function EditTaskDialog({
  open,
  onOpenChange,
  task,
  projectName,
  onSave
}: EditTaskDialogProps) {
  const [prompt, setPrompt] = useState('') // HTML content
  const [promptText, setPromptText] = useState('') // Plain text for validation
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initializedRef = useRef(false)

  // Use cached agent data
  const { agents, getModelsForAgent } = useAgentCacheStore()

  // Agent and model selection
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>()
  const [selectedModel, setSelectedModel] = useState<string | undefined>()

  // Get models for selected agent from cache
  const models = selectedAgentId ? getModelsForAgent(selectedAgentId) : []

  // Thinking mode (null = use global default, true/false = override)
  const [thinkingMode, setThinkingMode] = useState<boolean | null>(null)

  // Models are now loaded from cache automatically via getModelsForAgent

  // Initialize form with task data when dialog opens or task changes
  useEffect(() => {
    if (open && task && !initializedRef.current) {
      logger.debug('[EditTaskDialog] Initializing with task:', {
        agentId: task.agentId,
        model: task.model,
        promptLength: task.prompt?.length
      })
      setPrompt(task.prompt)
      // CRITICAL FIX: Also initialize promptText so validation works
      // The RichTextEditor will call onChange with both html and text,
      // but we need to initialize promptText immediately for validation
      setPromptText(task.prompt || '')

      const agentId = task.agentId || undefined
      setSelectedAgentId(agentId)

      // If task has a model, use it; otherwise use agent's default model
      let modelToUse = task.model || undefined
      if (!modelToUse && agentId) {
        const agentModels = getModelsForAgent(agentId)
        const defaultModel = agentModels.find(m => m.isDefault)
        modelToUse = defaultModel?.id || agentModels[0]?.id
      }
      setSelectedModel(modelToUse)

      setThinkingMode(task.thinkingMode ?? null)
      setError(null)
      initializedRef.current = true
    }
  }, [open, task, getModelsForAgent])

  // Reset initialized flag when dialog closes
  useEffect(() => {
    if (!open) {
      initializedRef.current = false
    }
  }, [open])

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setError(null)
      setIsSaving(false)
    }
    onOpenChange(newOpen)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!task) return

    if (!promptText.trim()) {
      setError('Prompt is required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      logger.debug('[EditTaskDialog] Saving task with:', {
        agentId: selectedAgentId,
        model: selectedModel,
        thinkingMode
      })
      await onSave(task.id, task.projectId, {
        prompt: prompt, // Send HTML content
        agentId: selectedAgentId,
        model: selectedModel,
        thinkingMode
      })
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+Enter to submit form
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (!isSaving && promptText.trim() && task) {
          handleSubmit(e as any)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, isSaving, promptText, task, handleSubmit])

  if (!task) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>
              Update the task details. Queued and backlog tasks can be edited.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Project (read-only) */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-muted-foreground">Project</Label>
              <div className="col-span-3 text-sm">{projectName || 'Unknown Project'}</div>
            </div>

            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="edit-prompt" className="text-right pt-2">
                Prompt
              </Label>
              <RichTextEditor
                variant="compact"
                content={prompt}
                onChange={(html, text) => {
                  setPrompt(html)
                  setPromptText(text)
                }}
                placeholder="Detailed instructions for the AI agent to follow..."
                className="col-span-3"
                minHeight="250px"
                maxHeight="450px"
              />
            </div>

            {/* Agent and Model Selection */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="agent" className="text-right">
                Agent
              </Label>
              <div className="col-span-3 grid grid-cols-2 gap-2">
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Use Default Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedModel}
                  onValueChange={setSelectedModel}
                  disabled={!selectedAgentId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Use Default Model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span>{model.name}</span>
                          {model.isLegacy && (
                            <span className="text-xs text-muted-foreground">(legacy v{model.version})</span>
                          )}
                          {model.alias && !model.isLegacy && (
                            <span className="text-xs text-green-600 dark:text-green-400">(latest)</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Thinking Mode Toggle */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Thinking</Label>
              <div className="col-span-3 flex items-center gap-3">
                <Select
                  value={thinkingMode === null ? 'default' : thinkingMode ? 'on' : 'off'}
                  onValueChange={(value) => {
                    if (value === 'default') setThinkingMode(null)
                    else if (value === 'on') setThinkingMode(true)
                    else setThinkingMode(false)
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Use Global Default</SelectItem>
                    <SelectItem value="on">Enable for this task</SelectItem>
                    <SelectItem value="off">Disable for this task</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Brain className="h-4 w-4" />
                  <span>Extended thinking for complex reasoning</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <p className="text-xs text-muted-foreground">
                <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px] font-mono">⌘+Enter</kbd> to save
                {' · '}
                <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px] font-mono">Esc</kbd> to cancel
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
