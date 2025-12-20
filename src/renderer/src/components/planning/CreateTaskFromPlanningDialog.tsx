/**
 * CreateTaskFromPlanningDialog - Create a task from planning session context
 *
 * Auto-extracts relevant information from the planning conversation
 * to pre-populate the task creation form.
 */

import type { PlanningSession, Project } from '@shared/types'
import { Brain, Loader2, MessageSquare, Sparkles, Wand2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { RichTextEditor } from '@/components/ui/rich-text-editor'

interface CreateTaskFromPlanningDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: PlanningSession | null
  project: Project | null
  /** Optional section content to use instead of full session */
  sectionContent?: string
  /** Optional plan file path to link to the task */
  planFilePath?: string
  onCreateTask: (data: {
    prompt: string
    projectId: string
    enabledSkills?: string[]
    agentId?: string | null
    model?: string | null
    thinkingMode?: boolean | null
    planFilePath?: string | null
  }) => Promise<void>
}

/**
 * Extract a suggested prompt from the planning session or section content
 */
function extractSuggestedPrompt(session: PlanningSession, sectionContent?: string): string {
  // If section content is provided, use it directly
  if (sectionContent) {
    const parts: string[] = []
    parts.push('## Task Description\n')
    parts.push(sectionContent.trim())
    parts.push('\n')
    parts.push('## Instructions\n')
    parts.push(
      'Implement the above requirements following best practices. Ensure all functionality is properly tested and follows project conventions.'
    )
    return parts.join('\n')
  }

  // Otherwise, extract from full session
  const parts: string[] = []

  // Add context about the planning session
  parts.push('## Context from Planning Session\n')

  // Include all user messages as context for what was discussed
  const userMessages = session.messages.filter((m) => m.role === 'user')

  if (userMessages.length > 0) {
    parts.push('### User Requirements\n')
    userMessages.forEach((msg, idx) => {
      const content = msg.content.trim()
      if (content.length > 0) {
        if (userMessages.length === 1) {
          parts.push(content)
        } else {
          parts.push(`**Message ${idx + 1}:**\n${content}`)
        }
        parts.push('')
      }
    })
  }

  // Include the latest assistant response as the plan/recommendations
  const assistantMessages = session.messages.filter((m) => m.role === 'assistant')
  if (assistantMessages.length > 0) {
    const lastAssistant = assistantMessages[assistantMessages.length - 1]
    parts.push('### Recommended Approach\n')
    parts.push(lastAssistant.content.trim())
    parts.push('')
  }

  // Add final plan items if they exist
  if (session.finalPlan.length > 0) {
    parts.push('### Plan Items\n')
    session.finalPlan.forEach((item, idx) => {
      parts.push(`${idx + 1}. **${item.title}**`)
      if (item.description) {
        parts.push(`   ${item.description}`)
      }
    })
    parts.push('')
  }

  // Add instruction section
  parts.push('## Task Instructions\n')
  parts.push(
    'Implement the above requirements following the recommended approach. Ensure all functionality is properly tested and follows project conventions.'
  )

  return parts.join('\n')
}


export function CreateTaskFromPlanningDialog({
  open,
  onOpenChange,
  session,
  project,
  sectionContent,
  planFilePath,
  onCreateTask
}: CreateTaskFromPlanningDialogProps) {
  const [prompt, setPrompt] = useState('') // HTML content
  const [promptText, setPromptText] = useState('') // Plain text for skill suggestions
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Session store for sticky agent/model selection
  const { sessionAgentId, sessionModel, setSessionAgent, setSessionModel } = useSessionStore()

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

  // Suggested values derived from session or section
  const suggestedPrompt = useMemo(
    () => (session ? extractSuggestedPrompt(session, sectionContent) : ''),
    [session, sectionContent]
  )

  // Initialize form with suggested values when dialog opens
  useEffect(() => {
    if (open && session) {
      // Pass the markdown directly - RichTextEditor will convert it to HTML
      setPrompt(suggestedPrompt)
      setPromptText(suggestedPrompt)
      setSelectedSkills([])
      // Keep agent/model sticky from session store
      setSelectedAgentId(sessionAgentId)
      setSelectedModel(sessionModel)
      setThinkingMode(null)
      setError(null)
    }
  }, [open, session, suggestedPrompt, sessionAgentId, sessionModel])

  // Fetch skills when dialog opens
  useEffect(() => {
    if (open && skills.length === 0) {
      fetchSkills()
    }
  }, [open, skills.length, fetchSkills])

  // Auto-suggest skills when prompt is initialized (after dialog opens)
  useEffect(() => {
    if (open && promptText && skills.length > 0) {
      // Auto-suggest on first load
      const timeoutId = setTimeout(() => {
        const enabledSkills = skills.filter((s) => s.enabled)
        const suggested = suggestSkills('', promptText, enabledSkills)
        setSelectedSkills(suggested)
      }, 300) // Small delay to let dialog render

      return () => clearTimeout(timeoutId)
    }
    return undefined
  }, [open, promptText, skills])

  // Models are now loaded from cache automatically via getModelsForAgent

  // Manual auto-suggest skills (for the magic wand button)
  const handleAutoSuggestSkills = useCallback(() => {
    const enabledSkills = skills.filter((s) => s.enabled)
    const suggested = suggestSkills('', promptText, enabledSkills)
    setSelectedSkills(suggested)
  }, [skills, promptText])

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setError(null)
      setIsCreating(false)
    }
    onOpenChange(newOpen)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!session || !project) return

    if (!promptText.trim()) {
      setError('Prompt is required')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      await onCreateTask({
        prompt: prompt, // Send HTML content
        projectId: project.id,
        enabledSkills: selectedSkills,
        agentId: selectedAgentId || null,
        model: selectedModel || null,
        thinkingMode,
        planFilePath: planFilePath || null
      })
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setIsCreating(false)
    }
  }

  // Calculate some stats about the session for display
  const sessionStats = useMemo(() => {
    if (!session) return null
    const userMsgCount = session.messages.filter((m) => m.role === 'user').length
    const assistantMsgCount = session.messages.filter((m) => m.role === 'assistant').length
    const planItemCount = session.finalPlan.length
    return { userMsgCount, assistantMsgCount, planItemCount }
  }, [session])

  if (!session || !project) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {sectionContent ? 'Create Task from Section' : 'Create Task from Planning'}
            </DialogTitle>
            <DialogDescription>
              {sectionContent
                ? 'Create a new task from the selected plan section. Review and edit the details before creating.'
                : 'Create a new task with context auto-extracted from your planning session. Review and edit the details before creating.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Session info banner */}
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{session.title}</span>
                <span className="text-muted-foreground">in</span>
                <span className="font-medium">{project.name}</span>
              </div>
              {sessionStats && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {sessionStats.userMsgCount} user message
                  {sessionStats.userMsgCount !== 1 ? 's' : ''},{' '}
                  {sessionStats.assistantMsgCount} AI response
                  {sessionStats.assistantMsgCount !== 1 ? 's' : ''}
                  {sessionStats.planItemCount > 0 && (
                    <>, {sessionStats.planItemCount} plan item
                      {sessionStats.planItemCount !== 1 ? 's' : ''}</>
                  )}
                </div>
              )}
            </div>

            {/* Prompt */}
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="task-prompt" className="text-right pt-2">
                Prompt *
              </Label>
              <RichTextEditor
                variant="compact"
                content={prompt}
                onChange={(html, text) => {
                  setPrompt(html)
                  setPromptText(text)
                }}
                placeholder="Detailed instructions extracted from the planning session..."
                className="col-span-3"
                minHeight="200px"
                maxHeight="300px"
              />
            </div>

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
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Skills */}
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

          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
