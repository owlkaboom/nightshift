import type { Project } from '@shared/types'
import { Brain, Download, Loader2, Mic, Square, Wand2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { suggestSkills } from '@/lib/skill-suggestions'
import { useSkillStore } from '@/stores/skill-store'
import { useSessionStore } from '@/stores/session-store'
import { useAgentCacheStore } from '@/stores/agent-cache-store'
import { SkillSelector } from '@/components/skills/SkillSelector'
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
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { RichTextEditor } from '@/components/ui/rich-text-editor'

interface AddTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (data: {
    prompt: string
    projectId: string
    enabledSkills?: string[]
    agentId?: string | null
    model?: string | null
    thinkingMode?: boolean | null
  }) => Promise<void>
  projects: Project[]
  defaultProjectId?: string
  /** Default agent ID to use (from global config) */
  defaultAgentId?: string
  /** Default model to use */
  defaultModel?: string | null
}

export function AddTaskDialog({
  open,
  onOpenChange,
  onAdd,
  projects,
  defaultProjectId,
  defaultAgentId: _defaultAgentId,
  defaultModel: _defaultModel
}: AddTaskDialogProps) {
  const [prompt, setPrompt] = useState('') // HTML content
  const [promptText, setPromptText] = useState('') // Plain text for skill suggestions
  const [projectId, setProjectId] = useState(defaultProjectId || '')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Session store for sticky agent/model/project selection
  const { sessionAgentId, sessionModel, sessionProjectId, setSessionAgent, setSessionModel, setSessionProject } = useSessionStore()

  // Use cached agent data
  const { agents, getModelsForAgent } = useAgentCacheStore()

  // Agent and model selection
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(sessionAgentId)
  const [selectedModel, setSelectedModel] = useState<string | undefined>(sessionModel)

  // Get models for selected agent from cache
  const models = selectedAgentId ? getModelsForAgent(selectedAgentId) : []

  // Thinking mode (null = use global default, true/false = override)
  const [thinkingMode, setThinkingMode] = useState<boolean | null>(null)

  const { skills, fetchSkills } = useSkillStore()

  // Speech recognition for voice input
  const {
    status: speechStatus,
    isListening,
    isSupported: isSpeechSupported,
    isModelLoaded,
    modelLoadProgress,
    toggleListening,
    stopListening,
    clearTranscript,
    loadModel
  } = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    onInterimResult: (transcript) => {
      // Update prompt with interim results as user speaks (plain text for voice)
      setPrompt(`<p>${transcript}</p>`)
      setPromptText(transcript)
    },
    onResult: (transcript) => {
      // Final result when user stops speaking (plain text for voice)
      setPrompt(`<p>${transcript}</p>`)
      setPromptText(transcript)
    },
    onError: (error) => {
      setError(error)
    }
  })

  const isModelLoading = speechStatus === 'loading_model'
  const isProcessing = speechStatus === 'processing'

  // Handle mic button click - load model if needed, then toggle listening
  const handleMicClick = async () => {
    if (!isModelLoaded && !isModelLoading) {
      await loadModel()
    }
    toggleListening()
  }

  // Initialize project from session store when dialog opens
  useEffect(() => {
    if (open && sessionProjectId && !projectId) {
      setProjectId(sessionProjectId)
    }
  }, [open, sessionProjectId])

  // Fetch skills when dialog opens
  useEffect(() => {
    if (open && skills.length === 0) {
      fetchSkills()
    }
  }, [open, skills.length, fetchSkills])

  // Models are now loaded from cache automatically via getModelsForAgent

  // Auto-suggest skills when prompt changes (debounced)
  useEffect(() => {
    if (!promptText.trim()) {
      setSelectedSkills([])
      return
    }

    // Debounce the skill suggestion
    const timeoutId = setTimeout(() => {
      const enabledSkills = skills.filter((s) => s.enabled)
      const suggested = suggestSkills('', promptText, enabledSkills)
      setSelectedSkills(suggested)
    }, 500) // 500ms debounce

    return () => clearTimeout(timeoutId)
  }, [promptText, skills])

  // Manual auto-suggest skills (for the magic wand button)
  const handleAutoSuggestSkills = () => {
    const enabledSkills = skills.filter((s) => s.enabled)
    const suggested = suggestSkills('', promptText, enabledSkills)
    setSelectedSkills(suggested)
  }

  const reset = () => {
    setPrompt('')
    setPromptText('')
    // Keep project sticky - restore from session store if available
    setProjectId(sessionProjectId || defaultProjectId || '')
    setSelectedSkills([])
    // Keep agent/model sticky - restore from session store
    setSelectedAgentId(sessionAgentId)
    setSelectedModel(sessionModel)
    setThinkingMode(null)
    setError(null)
    setIsAdding(false)
    stopListening()
    clearTranscript()
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset()
    }
    onOpenChange(open)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!promptText.trim()) {
      setError('Prompt is required')
      return
    }

    if (!projectId) {
      setError('Please select a project')
      return
    }

    setIsAdding(true)
    setError(null)

    try {
      await onAdd({
        prompt: prompt, // Send HTML content
        projectId,
        enabledSkills: selectedSkills,
        agentId: selectedAgentId || null,
        model: selectedModel || null,
        thinkingMode
      })
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setIsAdding(false)
    }
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+Enter to submit form
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (!isAdding && promptText.trim() && projectId) {
          handleSubmit(e as any)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, isAdding, promptText, projectId, handleSubmit])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>
              Create a new AI-assisted coding task for Claude Code to execute.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Project Selector */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="project" className="text-right">
                Project *
              </Label>
              <div className="col-span-3">
                <Select
                  value={projectId}
                  onValueChange={(value) => {
                    setProjectId(value)
                    setSessionProject(value)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="prompt" className="text-right pt-2">
                Prompt *
              </Label>
              <div className="col-span-3 flex gap-2" data-feature="rich-text-editor">
                <RichTextEditor
                  variant="compact"
                  content={prompt}
                  onChange={(html, text) => {
                    setPrompt(html)
                    setPromptText(text)
                  }}
                  placeholder="Detailed instructions for the AI agent to follow..."
                  className={`flex-1 ${isListening ? 'ring-2 ring-red-500 ring-offset-2' : ''}`}
                  minHeight="150px"
                  maxHeight="300px"
                />
                {isSpeechSupported && (
                  <Button
                    type="button"
                    variant={isListening ? 'destructive' : 'outline'}
                    size="icon"
                    onClick={handleMicClick}
                    title={isListening ? 'Stop recording' : 'Start voice input'}
                    className="shrink-0 self-start"
                    disabled={isProcessing || isModelLoading}
                  >
                    {isModelLoading || isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isListening ? (
                      <Square className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
            {isModelLoading && (
              <div className="grid grid-cols-4 items-center gap-4">
                <div />
                <div className="col-span-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Download className="h-4 w-4 animate-pulse" />
                    Downloading speech model...
                  </div>
                  <Progress value={modelLoadProgress} className="h-1.5" />
                </div>
              </div>
            )}
            {isListening && (
              <div className="grid grid-cols-4 items-center gap-4">
                <div />
                <div className="col-span-3 flex items-center gap-2 text-sm text-red-500">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                  Listening... Speak your task prompt
                </div>
              </div>
            )}
            {isProcessing && (
              <div className="grid grid-cols-4 items-center gap-4">
                <div />
                <div className="col-span-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Transcribing...
                </div>
              </div>
            )}


            {/* Agent and Model Selection */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="agent" className="text-right">
                Agent
              </Label>
              <div className="col-span-3 grid grid-cols-2 gap-2">
                <Select
                  value={selectedAgentId}
                  onValueChange={(value) => {
                    setSelectedAgentId(value)
                    setSessionAgent(value)
                    // Clear model when agent changes (model list will be different)
                    setSelectedModel(undefined)
                  }}
                >
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
                  onValueChange={(value) => {
                    setSelectedModel(value)
                    setSessionModel(value)
                  }}
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Skills</Label>
              <div className="col-span-3 flex items-center gap-2">
                <SkillSelector
                  selectedSkillIds={selectedSkills}
                  onSelectionChange={setSelectedSkills}
                  hideLabel
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAutoSuggestSkills}
                  title="Auto-suggest skills based on prompt"
                  className="shrink-0"
                >
                  <Wand2 className="h-4 w-4" />
                </Button>
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
                  <SelectTrigger className="w-52">
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
                <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px] font-mono">⌘+Enter</kbd> to create
                {' · '}
                <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px] font-mono">Esc</kbd> to cancel
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isAdding}>
                  {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Task
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
