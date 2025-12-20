/**
 * Dialog for converting a note to a task
 */

import { useState, useCallback, useEffect } from 'react'
import type { Note, Project } from '@shared/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { FolderGit2, ListTodo } from 'lucide-react'
import { useSkillStore } from '@/stores/skill-store'
import { suggestSkills } from '@/lib/skill-suggestions'

interface ConvertToTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  note: Note | null
  projects: Project[]
  onConvert: (data: {
    prompt: string
    projectId: string
    enabledSkills?: string[]
  }) => Promise<void>
}

export function ConvertToTaskDialog({
  open,
  onOpenChange,
  note,
  projects,
  onConvert
}: ConvertToTaskDialogProps) {
  const [prompt, setPrompt] = useState('') // HTML content
  const [promptText, setPromptText] = useState('') // Plain text for skill suggestions
  const [projectId, setProjectId] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [converting, setConverting] = useState(false)

  // Skill store
  const { skills, fetchSkills } = useSkillStore()

  // Fetch skills when dialog opens
  useEffect(() => {
    if (open && skills.length === 0) {
      fetchSkills()
    }
  }, [open, skills.length, fetchSkills])

  // Auto-suggest skills when prompt changes (debounced)
  useEffect(() => {
    if (!open || !promptText.trim()) {
      setSelectedSkills([])
      return
    }

    const timeoutId = setTimeout(() => {
      const enabledSkills = skills.filter((s) => s.enabled)
      const suggested = suggestSkills('', promptText, enabledSkills)
      setSelectedSkills(suggested)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [open, promptText, skills])

  // Initialize form when dialog opens
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen && note) {
      // Use note content as the task prompt, prefixed with note title for context
      const noteTitle = note.title ? `${note.title}\n\n` : ''
      const textContent = noteTitle + (note.content || note.excerpt)
      // Pass content directly - RichTextEditor will handle conversion
      setPrompt(textContent)
      setPromptText(textContent)
      // Pre-select the primary project if set
      setProjectId(note.primaryProjectId || '')
    } else {
      // Reset on close
      setPrompt('')
      setPromptText('')
      setProjectId('')
      setSelectedSkills([])
    }
    onOpenChange(newOpen)
  }, [note, onOpenChange])

  const handleConvert = useCallback(async () => {
    if (!projectId) return

    setConverting(true)
    try {
      await onConvert({
        prompt, // Send HTML content
        projectId,
        enabledSkills: selectedSkills
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to convert note to task:', error)
    } finally {
      setConverting(false)
    }
  }, [prompt, projectId, selectedSkills, onConvert, onOpenChange])

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+Enter to submit form
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (!converting && projectId && promptText.trim()) {
          handleConvert()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, converting, projectId, promptText, handleConvert])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            Convert Note to Task
          </DialogTitle>
          <DialogDescription>
            Create a new task from this note. The note content will be used as the task prompt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Project selector */}
          <div className="space-y-2">
            <Label htmlFor="project">Project *</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <div className="flex items-center gap-2">
                      <FolderGit2 className="h-4 w-4" />
                      {project.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projects.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No projects available. Create a project first.
              </p>
            )}
          </div>

          {/* Task prompt/description */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Task Prompt</Label>
            <RichTextEditor
              variant="compact"
              content={prompt}
              onChange={(html, text) => {
                setPrompt(html)
                setPromptText(text)
              }}
              placeholder="Task description/prompt for the AI agent"
              minHeight="150px"
              maxHeight="300px"
            />
            <p className="text-xs text-muted-foreground">
              This will be sent to the AI agent as the task instructions.
            </p>
          </div>

          {/* Auto-detected skills display */}
          {selectedSkills.length > 0 && (
            <div className="space-y-2">
              <Label>Auto-detected Skills</Label>
              <div className="flex flex-wrap gap-1.5 p-3 bg-muted/50 rounded-lg">
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
              <p className="text-xs text-muted-foreground">
                These skills will be automatically applied to help guide the AI.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <div className="flex items-center justify-between w-full">
            <p className="text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px] font-mono">⌘+Enter</kbd> to create
              {' · '}
              <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px] font-mono">Esc</kbd> to cancel
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConvert}
                disabled={converting || !projectId || !prompt.trim()}
              >
                {converting ? 'Converting...' : 'Create Task'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
