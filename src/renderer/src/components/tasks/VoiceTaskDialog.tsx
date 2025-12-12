import type { Project } from '@shared/types'
import { Check, Download, Loader2, Mic, Square, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'
import { useSessionStore } from '../../stores/session-store'
import { useSkillStore } from '../../stores/skill-store'
import { suggestSkills } from '../../lib/skill-suggestions'
import { markdownToHtml, isMarkdown } from '../../lib/markdown-to-html'
import { Progress } from '../ui/progress'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'
import { Label } from '../ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select'
import { RichTextEditor } from '../ui/rich-text-editor'

type VoiceStep = 'prompt' | 'project' | 'confirm'

interface VoiceTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (data: {
    prompt: string
    projectId: string
    enabledSkills?: string[]
    agentId?: string | null
    model?: string | null
  }) => Promise<void>
  projects: Project[]
  defaultProjectId?: string
  defaultAgentId?: string
  defaultModel?: string
}

/**
 * Find a project by matching voice input against project names.
 * Uses fuzzy matching to handle voice recognition variations.
 */
function findProjectByVoice(voiceInput: string, projects: Project[]): Project | null {
  const input = voiceInput.toLowerCase().trim()
  if (!input) return null

  // First, try exact match
  const exactMatch = projects.find(p => p.name.toLowerCase() === input)
  if (exactMatch) return exactMatch

  // Then try startsWith match
  const startsMatch = projects.find(p => p.name.toLowerCase().startsWith(input))
  if (startsMatch) return startsMatch

  // Then try contains match
  const containsMatch = projects.find(p => p.name.toLowerCase().includes(input))
  if (containsMatch) return containsMatch

  // Finally, try fuzzy match: check if the input contains the project name
  const reverseMatch = projects.find(p => input.includes(p.name.toLowerCase()))
  if (reverseMatch) return reverseMatch

  // Try matching individual words
  const inputWords = input.split(/\s+/)
  for (const word of inputWords) {
    if (word.length < 3) continue // Skip short words
    const wordMatch = projects.find(p => p.name.toLowerCase().includes(word))
    if (wordMatch) return wordMatch
  }

  return null
}

export function VoiceTaskDialog({
  open,
  onOpenChange,
  onAdd,
  projects,
  defaultProjectId,
  defaultAgentId,
  defaultModel
}: VoiceTaskDialogProps) {
  // Session store for sticky project selection
  const { sessionProjectId, setSessionProject } = useSessionStore()

  const [step, setStep] = useState<VoiceStep>('prompt')
  const [prompt, setPrompt] = useState('') // HTML content
  const [promptText, setPromptText] = useState('') // Plain text for skill suggestions
  const [projectId, setProjectId] = useState(defaultProjectId || '')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoListening, setAutoListening] = useState(false)

  // Skill store
  const { skills, fetchSkills } = useSkillStore()

  const {
    status: speechStatus,
    isListening,
    transcript,
    isSupported: isSpeechSupported,
    isModelLoaded,
    modelLoadProgress,
    recordingDuration,
    audioLevel,
    startListening,
    stopListening,
    clearTranscript,
    loadModel,
    error: speechError
  } = useSpeechRecognition({
    continuous: true,
    interimResults: true
  })

  const isModelLoading = speechStatus === 'loading_model'
  const isProcessing = speechStatus === 'processing'

  // Format recording duration as MM:SS
  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Calculate max duration warning
  const maxDurationMs = 5 * 60 * 1000 // 5 minutes
  const isNearingMaxDuration = recordingDuration > maxDurationMs * 0.9 // 90% of max
  const durationPercentage = Math.min((recordingDuration / maxDurationMs) * 100, 100)

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

  // Auto-suggest skills when prompt changes (after moving from prompt step)
  useEffect(() => {
    if (step === 'project' && promptText.trim()) {
      const enabledSkills = skills.filter((s) => s.enabled)
      const suggested = suggestSkills('', promptText, enabledSkills)
      setSelectedSkills(suggested)
    }
  }, [step, promptText, skills])

  // Auto-start listening when dialog opens (after model is loaded)
  useEffect(() => {
    if (open && isSpeechSupported && isModelLoaded && step === 'prompt' && !autoListening) {
      setAutoListening(true)
      // Small delay to let dialog render
      const timer = setTimeout(() => {
        startListening()
      }, 300)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [open, isSpeechSupported, isModelLoaded, step, autoListening, startListening])

  // Load model when dialog opens if not already loaded
  useEffect(() => {
    if (open && !isModelLoaded && !isModelLoading) {
      loadModel()
    }
  }, [open, isModelLoaded, isModelLoading, loadModel])

  // Update the appropriate field based on current step
  useEffect(() => {
    if (!transcript) return

    if (step === 'prompt') {
      // Convert markdown in transcribed text to HTML
      const htmlContent = isMarkdown(transcript)
        ? markdownToHtml(transcript)
        : transcript
      setPrompt(htmlContent)
      setPromptText(transcript) // Keep original plain text for skill detection
    } else if (step === 'project') {
      // Try to match project from voice input
      const matchedProject = findProjectByVoice(transcript, projects)
      if (matchedProject) {
        setProjectId(matchedProject.id)
        setSessionProject(matchedProject.id)
      }
    }
  }, [transcript, step, projects, setSessionProject])


  // Show speech errors
  useEffect(() => {
    if (speechError) {
      setError(speechError)
    }
  }, [speechError])

  const reset = useCallback(() => {
    // Stop listening FIRST to prevent race conditions
    stopListening()
    clearTranscript()

    // Reset all local state
    setStep('prompt')
    setPrompt('')
    setPromptText('')
    // Keep project sticky - restore from session store if available
    setProjectId(sessionProjectId || defaultProjectId || '')
    setSelectedSkills([])
    setError(null)
    setIsAdding(false)
    setAutoListening(false)
  }, [sessionProjectId, defaultProjectId, stopListening, clearTranscript])

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      reset()
    }
    onOpenChange(open)
  }, [reset, onOpenChange])

  const handleNextStep = useCallback(async () => {
    stopListening()
    clearTranscript()

    if (step === 'prompt') {
      if (!promptText.trim()) {
        setError('Please speak or type your task prompt')
        return
      }
      setStep('project')
    } else if (step === 'project') {
      if (!projectId) {
        setError('Please select a project')
        return
      }
      setStep('confirm')
    }
    setError(null)
  }, [step, promptText, projectId, stopListening, clearTranscript])

  const handlePreviousStep = () => {
    stopListening()
    clearTranscript()
    setError(null)

    if (step === 'project') {
      setStep('prompt')
    } else if (step === 'confirm') {
      setStep('project')
    }
  }

  const handleSubmit = useCallback(async () => {
    if (!promptText.trim() || !projectId) {
      setError('Please complete all fields')
      return
    }

    setIsAdding(true)
    setError(null)

    try {
      await onAdd({
        prompt: prompt, // Send HTML content
        projectId,
        enabledSkills: selectedSkills,
        agentId: defaultAgentId,
        model: defaultModel
      })
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setIsAdding(false)
    }
  }, [prompt, promptText, projectId, selectedSkills, onAdd, handleOpenChange, defaultAgentId, defaultModel])

  const handleToggleListening = useCallback(async () => {
    if (isListening) {
      stopListening()
    } else {
      clearTranscript()
      await startListening()
    }
  }, [isListening, stopListening, clearTranscript, startListening])

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!open || isModelLoading) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const tagName = target?.tagName

      // Check if we're in an editable element (input, textarea, or contenteditable)
      const isInEditableElement =
        ['INPUT', 'TEXTAREA'].includes(tagName) ||
        target?.isContentEditable ||
        target?.closest('[contenteditable="true"]') ||
        target?.closest('.ProseMirror')

      // Handle spacebar to toggle recording (not in confirm step, not when in editable elements)
      if (e.code === 'Space' && step !== 'confirm' && !isInEditableElement) {
        e.preventDefault()
        handleToggleListening()
      }

      // Handle Meta+Enter to proceed to next step or submit
      if (e.code === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (step === 'confirm') {
          handleSubmit()
        } else {
          handleNextStep()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, step, isModelLoading, handleToggleListening, handleNextStep, handleSubmit])

  const selectedProject = projects.find(p => p.id === projectId)

  const getStepTitle = () => {
    switch (step) {
      case 'prompt': return 'Step 1: Describe Your Task'
      case 'project': return 'Step 2: Select Project'
      case 'confirm': return 'Step 3: Confirm Task'
    }
  }

  const getStepDescription = () => {
    switch (step) {
      case 'prompt': return 'Speak or type your task instructions. Click the microphone to start/stop recording.'
      case 'project': return 'Choose the project where this task will be executed.'
      case 'confirm': return 'Review your task details before creating.'
    }
  }

  // Local Whisper is always supported, but keep the check for safety
  if (!isSpeechSupported) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Voice Input Error</DialogTitle>
            <DialogDescription>
              Unable to initialize speech recognition. Please restart the application.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            Voice Task Creation
          </DialogTitle>
          <DialogDescription>{getStepTitle()}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {(['prompt', 'project', 'confirm'] as VoiceStep[]).map((s, idx) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === s
                      ? 'bg-primary text-primary-foreground'
                      : (['prompt', 'project', 'confirm'].indexOf(step) > idx)
                        ? 'bg-green-500 text-white'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {['prompt', 'project', 'confirm'].indexOf(step) > idx ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    idx + 1
                  )}
                </div>
                {idx < 2 && (
                  <div
                    className={`w-8 h-0.5 ${
                      ['prompt', 'project', 'confirm'].indexOf(step) > idx
                        ? 'bg-green-500'
                        : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground text-center mb-4">
            {getStepDescription()}
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
              {error}
            </div>
          )}

          {/* Model loading indicator */}
          {isModelLoading && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Download className="h-4 w-4 animate-pulse" />
                Downloading speech recognition model...
              </div>
              <Progress value={modelLoadProgress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                {Math.round(modelLoadProgress)}% - This is a one-time download
              </p>
            </div>
          )}

          {/* Voice indicator */}
          {step !== 'confirm' && !isModelLoading && (
            <div className="flex flex-col items-center gap-2 mb-4">
              <Button
                type="button"
                variant={isListening ? 'destructive' : 'outline'}
                size="lg"
                onClick={handleToggleListening}
                className="rounded-full w-16 h-16"
                disabled={isProcessing || isModelLoading}
              >
                {isProcessing ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : isListening ? (
                  <Square className="h-6 w-6" />
                ) : (
                  <Mic className="h-6 w-6" />
                )}
              </Button>
              <div className="flex flex-col gap-1 items-center">
                <p className="text-xs text-muted-foreground">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px] font-mono">Space</kbd> {isListening ? 'stop' : 'start'} recording
                  {' · '}
                  <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px] font-mono">⌘+Enter</kbd> next step
                </p>
                {!isListening && (
                  <p className="text-[10px] text-muted-foreground/70 text-center">
                    Auto-stops after 3s silence · Max 5 min duration
                  </p>
                )}
              </div>
            </div>
          )}

          {isListening && (
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-center gap-2 text-sm text-red-500">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
                Recording... {formatDuration(recordingDuration)}
              </div>

              {/* Audio level visualization */}
              <div className="px-8">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-100"
                    style={{ width: `${Math.min(audioLevel * 200, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center mt-1">
                  Audio Level
                </p>
              </div>

              {/* Duration progress bar (warning when nearing max) */}
              {recordingDuration > 60000 && (
                <div className="px-8">
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isNearingMaxDuration ? 'bg-orange-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${durationPercentage}%` }}
                    />
                  </div>
                  {isNearingMaxDuration && (
                    <p className="text-xs text-orange-500 text-center mt-1">
                      Approaching max duration (5:00)
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Transcribing...
            </div>
          )}

          {/* Step content */}
          {step === 'prompt' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="prompt">Task Prompt</Label>
                <div data-feature="rich-text-editor">
                  <RichTextEditor
                    variant="compact"
                    content={prompt}
                    onChange={(html, text) => {
                      setPrompt(html)
                      setPromptText(text)
                    }}
                    placeholder="Describe what you want the AI agent to do..."
                    className={`mt-1 ${isListening ? 'ring-2 ring-red-500 ring-offset-2' : ''}`}
                    minHeight="150px"
                    maxHeight="300px"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 'project' && (
            <div className="space-y-4">
              <div>
                <Label>Project</Label>
                <Select
                  value={projectId}
                  onValueChange={(value) => {
                    setProjectId(value)
                    setSessionProject(value)
                  }}
                >
                  <SelectTrigger className={`mt-1 ${isListening ? 'ring-2 ring-red-500 ring-offset-2' : ''}`}>
                    <SelectValue placeholder="Say or select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Say the project name to select it, or choose from the dropdown.
                </p>
              </div>
              {transcript && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Heard:</p>
                  <p className="text-sm">{transcript}</p>
                  {selectedProject && (
                    <p className="text-xs text-green-600 mt-1">
                      Matched: {selectedProject.name}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Project</p>
                  <p className="font-medium">{selectedProject?.name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Prompt</p>
                  <RichTextEditor
                    variant="compact"
                    content={prompt}
                    editable={false}
                    minHeight="100px"
                  />
                </div>
                {selectedSkills.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Auto-detected Skills</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {selectedSkills.map((skillId) => {
                        const skill = skills.find((s) => s.id === skillId)
                        return skill ? (
                          <span
                            key={skillId}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs"
                          >
                            <span>{skill.icon}</span>
                            <span>{skill.name}</span>
                          </span>
                        ) : null
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <div className="flex items-center justify-between w-full">
            <p className="text-xs text-muted-foreground">
              {step !== 'confirm' ? (
                <>
                  <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px] font-mono">⌘+Enter</kbd> next
                </>
              ) : (
                <>
                  <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px] font-mono">⌘+Enter</kbd> to create
                </>
              )}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>

              {step !== 'prompt' && (
                <Button type="button" variant="outline" onClick={handlePreviousStep}>
                  Back
                </Button>
              )}

              {step !== 'confirm' ? (
                <Button type="button" onClick={handleNextStep}>
                  Next
                </Button>
              ) : (
                <Button type="button" onClick={handleSubmit} disabled={isAdding}>
                  {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Task
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
