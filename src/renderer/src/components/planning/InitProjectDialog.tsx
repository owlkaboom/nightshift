/**
 * InitProjectDialog - Dialog for starting a project initialization planning session
 *
 * Allows users to describe their project idea and tech stack preferences
 * before starting a planning conversation with the AI.
 */

import { useState, useCallback } from 'react'
import { Loader2, FolderTree, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { Project } from '@shared/types'

interface InitProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStart: (data: {
    projectId: string
    projectDescription: string
    techStack?: string
    initialMessage?: string
  }) => Promise<void>
  projects: Project[]
  defaultProjectId?: string
}

const TECH_STACK_PRESETS = [
  { value: 'custom', label: 'Custom (specify below)' },
  { value: 'react-ts', label: 'React + TypeScript' },
  { value: 'next-ts', label: 'Next.js + TypeScript' },
  { value: 'node-ts', label: 'Node.js + TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'python-fastapi', label: 'Python + FastAPI' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'electron', label: 'Electron + React' }
]

export function InitProjectDialog({
  open,
  onOpenChange,
  onStart,
  projects,
  defaultProjectId
}: InitProjectDialogProps) {
  const [projectId, setProjectId] = useState(defaultProjectId || '')
  const [description, setDescription] = useState('')
  const [techStackPreset, setTechStackPreset] = useState('custom')
  const [customTechStack, setCustomTechStack] = useState('')
  const [initialQuestion, setInitialQuestion] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setProjectId(defaultProjectId || '')
    setDescription('')
    setTechStackPreset('custom')
    setCustomTechStack('')
    setInitialQuestion('')
    setError(null)
    setIsStarting(false)
  }, [defaultProjectId])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        reset()
      }
      onOpenChange(open)
    },
    [reset, onOpenChange]
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!projectId) {
        setError('Please select a project')
        return
      }

      if (!description.trim()) {
        setError('Please describe what you want to build')
        return
      }

      setIsStarting(true)
      setError(null)

      try {
        // Determine tech stack string
        let techStack: string | undefined
        if (techStackPreset === 'custom') {
          techStack = customTechStack.trim() || undefined
        } else {
          const preset = TECH_STACK_PRESETS.find((p) => p.value === techStackPreset)
          techStack = preset?.label
        }

        // Use initial question or generate a default one
        const initialMessage =
          initialQuestion.trim() ||
          "Let's plan this project. What directory structure and initial files would you recommend?"

        await onStart({
          projectId,
          projectDescription: description.trim(),
          techStack,
          initialMessage
        })
        handleOpenChange(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start planning session')
      } finally {
        setIsStarting(false)
      }
    },
    [
      projectId,
      description,
      techStackPreset,
      customTechStack,
      initialQuestion,
      onStart,
      handleOpenChange
    ]
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderTree className="h-5 w-5" />
              Initialize Project Structure
            </DialogTitle>
            <DialogDescription>
              Describe your project idea and let AI help you plan the directory structure and
              initial setup.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="project" className="text-right">
                Project *
              </Label>
              <div className="col-span-3">
                <Select value={projectId} onValueChange={setProjectId}>
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
              <Label htmlFor="description" className="text-right pt-2">
                What to build *
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what you want to build. For example: 'A CLI tool that converts markdown files to HTML with syntax highlighting and custom templates'"
                className="col-span-3 min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="techStack" className="text-right">
                Tech stack
              </Label>
              <div className="col-span-3">
                <Select value={techStackPreset} onValueChange={setTechStackPreset}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tech stack" />
                  </SelectTrigger>
                  <SelectContent>
                    {TECH_STACK_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {techStackPreset === 'custom' && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customTechStack" className="text-right">
                  Custom stack
                </Label>
                <Input
                  id="customTechStack"
                  value={customTechStack}
                  onChange={(e) => setCustomTechStack(e.target.value)}
                  placeholder="e.g., Vue 3, Vite, Pinia, TailwindCSS"
                  className="col-span-3"
                />
              </div>
            )}

            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="initialQuestion" className="text-right pt-2">
                First question
              </Label>
              <Textarea
                id="initialQuestion"
                value={initialQuestion}
                onChange={(e) => setInitialQuestion(e.target.value)}
                placeholder="Optional: Ask a specific question to start the conversation. Leave empty for default."
                className="col-span-3 min-h-[60px]"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isStarting}>
              {isStarting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              Start Planning
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
