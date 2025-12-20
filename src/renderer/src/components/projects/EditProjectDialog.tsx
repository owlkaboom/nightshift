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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Wand2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { IconPicker } from '@/components/ui/icon-picker'
import * as LucideIcons from 'lucide-react'
import type { Project } from '@shared/types'
import { PROJECT_ICONS } from '@shared/types'

interface EditProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project | null
  onSave: (id: string, updates: Partial<Project>) => Promise<void>
}

type IconType = 'lucide' | 'custom'

export function EditProjectDialog({ open, onOpenChange, project, onSave }: EditProjectDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [iconType, setIconType] = useState<IconType>('lucide')
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null)
  const [customIconUrl, setCustomIconUrl] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when project changes
  useEffect(() => {
    if (project) {
      setName(project.name)
      setDescription(project.description || '')
      if (project.icon) {
        // Check if it's a Lucide icon name or a custom URL/path
        if (PROJECT_ICONS.includes(project.icon as (typeof PROJECT_ICONS)[number])) {
          setIconType('lucide')
          setSelectedIcon(project.icon)
          setCustomIconUrl('')
        } else {
          setIconType('custom')
          setSelectedIcon(null)
          setCustomIconUrl(project.icon)
        }
      } else {
        setIconType('lucide')
        setSelectedIcon(null)
        setCustomIconUrl('')
      }
      setError(null)
    }
  }, [project])

  const handleSave = async () => {
    if (!project || !name.trim()) return

    setIsSaving(true)
    setError(null)

    try {
      const icon = iconType === 'lucide' ? selectedIcon : customIconUrl || null
      await onSave(project.id, {
        name: name.trim(),
        description: description.trim() || null,
        icon
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project')
    } finally {
      setIsSaving(false)
    }
  }

  const handleGenerateDescription = async () => {
    if (!project) return
    setIsGeneratingDescription(true)
    try {
      const generatedDescription = await window.api.generateProjectDescription(project.id)
      setDescription(generatedDescription)
    } catch (err) {
      console.error('Failed to generate description:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate description')
    } finally {
      setIsGeneratingDescription(false)
    }
  }

  const handleSelectImage = async () => {
    const path = await window.api.selectFile([
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'] }
    ])
    if (path) {
      // Convert to file:// URL for local files
      setCustomIconUrl(`file://${path}`)
    }
  }

  const getIconComponent = (iconName: string) => {
    const Icon = LucideIcons[iconName as keyof typeof LucideIcons] as LucideIcons.LucideIcon
    return Icon || LucideIcons.Folder
  }

  const getCurrentIcon = () => {
    if (iconType === 'custom' && customIconUrl) {
      return (
        <img
          src={customIconUrl}
          alt="Custom icon"
          className="h-5 w-5 object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )
    }
    if (iconType === 'lucide' && selectedIcon) {
      const Icon = getIconComponent(selectedIcon)
      return <Icon className="h-5 w-5" />
    }
    // Default based on project type
    const DefaultIcon = project?.gitUrl ? LucideIcons.FolderGit2 : LucideIcons.Folder
    return <DefaultIcon className="h-5 w-5" />
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>Update the project name and icon.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-y-auto flex-1 px-1">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="project-description">Description (optional)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGenerateDescription}
                disabled={isGeneratingDescription}
                title="Generate description from project content"
              >
                {isGeneratingDescription ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-1" />
                )}
                Generate
              </Button>
            </div>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this project's purpose..."
              className="min-h-[80px]"
            />
          </div>

          {/* Icon Preview */}
          <div className="space-y-2">
            <Label>Icon Preview</Label>
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {getCurrentIcon()}
              </div>
              <span className="font-medium">{name || 'Project Name'}</span>
            </div>
          </div>

          {/* Icon Picker */}
          <IconPicker
            availableIcons={PROJECT_ICONS}
            selectedIcon={selectedIcon}
            customIconUrl={customIconUrl}
            iconType={iconType}
            defaultIcon={project?.gitUrl ? LucideIcons.FolderGit2 : LucideIcons.Folder}
            onSelectIcon={setSelectedIcon}
            onCustomIconChange={setCustomIconUrl}
            onIconTypeChange={setIconType}
            onSelectImageFile={handleSelectImage}
          />

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
