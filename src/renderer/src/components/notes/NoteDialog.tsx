/**
 * Dialog for creating and editing notes
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Note, CreateNoteData } from '@shared/types'
import { extractExcerpt, countWords, extractTitleFromContent, NOTE_ICONS } from '@shared/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { IconPicker } from '@/components/ui/icon-picker'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { X, Tag, FolderGit2, StickyNote } from 'lucide-react'
import { useKeyboardShortcuts, type KeyboardShortcut } from '@/hooks'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

interface NoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  note?: Note | null
  onSave: (data: CreateNoteData | Partial<Note>) => Promise<void>
  projects?: Array<{ id: string; name: string }>
  groups?: Array<{ id: string; name: string; color?: string }>
  noteTags?: Array<{ id: string; name: string; color?: string | null }>
}

export function NoteDialog({
  open,
  onOpenChange,
  note,
  onSave,
  projects = [],
  groups = [],
  noteTags = []
}: NoteDialogProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [htmlContent, setHtmlContent] = useState('')
  const [primaryProjectId, setPrimaryProjectId] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [iconType, setIconType] = useState<'lucide' | 'custom'>('lucide')
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null)
  const [customIconUrl, setCustomIconUrl] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [wordCount, setWordCount] = useState(0)

  // Reset form when note changes or dialog opens
  useEffect(() => {
    if (open) {
      if (note) {
        setTitle(note.title)
        setContent(note.content)
        setHtmlContent(note.htmlContent)
        setPrimaryProjectId(note.primaryProjectId)
        setTags(note.tags)
        setWordCount(note.wordCount)

        // Set icon state
        if (note.icon) {
          if (NOTE_ICONS.includes(note.icon as (typeof NOTE_ICONS)[number])) {
            setIconType('lucide')
            setSelectedIcon(note.icon)
            setCustomIconUrl('')
          } else {
            setIconType('custom')
            setSelectedIcon(null)
            setCustomIconUrl(note.icon)
          }
        } else {
          setIconType('lucide')
          setSelectedIcon(null)
          setCustomIconUrl('')
        }
      } else {
        setTitle('')
        setContent('')
        setHtmlContent('')
        setPrimaryProjectId(null)
        setTags([])
        setWordCount(0)
        setIconType('lucide')
        setSelectedIcon(null)
        setCustomIconUrl('')
      }
      setTagInput('')
    }
  }, [open, note])

  const handleContentChange = useCallback((newContent: string, newHtml: string) => {
    setContent(newContent)
    setHtmlContent(newHtml)
    setWordCount(countWords(newContent))

    // Auto-update title if it's empty or was auto-derived
    if (!title || title === extractTitleFromContent(content)) {
      setTitle(extractTitleFromContent(newContent))
    }
  }, [content, title])

  const handleAddTag = useCallback(() => {
    const trimmedTag = tagInput.trim().toLowerCase()
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag])
    }
    setTagInput('')
  }, [tagInput, tags])

  const handleRemoveTag = useCallback((tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }, [tags])

  const handleTagKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1))
    }
  }, [handleAddTag, tagInput, tags])

  const handleSelectImage = async () => {
    const path = await window.api.selectFile([
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'] }
    ])
    if (path) {
      setCustomIconUrl(`file://${path}`)
    }
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const icon = iconType === 'lucide' ? selectedIcon : customIconUrl || null
      const data: Partial<Note> = {
        title: title || 'Untitled Note',
        content,
        htmlContent,
        excerpt: extractExcerpt(content),
        primaryProjectId,
        tags,
        icon,
        wordCount,
        status: note?.status === 'draft' && content.length > 0 ? 'active' : note?.status ?? 'draft'
      }

      await onSave(note ? { ...data, id: note.id } : data)
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save note:', error)
    } finally {
      setSaving(false)
    }
  }, [title, content, htmlContent, primaryProjectId, tags, iconType, selectedIcon, customIconUrl, wordCount, note, onSave, onOpenChange])

  const getProjects = useCallback(async () => projects, [projects])
  const getGroups = useCallback(async () => groups, [groups])
  const getTags = useCallback(
    async () => noteTags.map((tag) => ({ ...tag, color: tag.color || undefined })),
    [noteTags]
  )

  // Keyboard shortcuts for the dialog
  const shortcuts: KeyboardShortcut[] = useMemo(
    () => [
      {
        key: 's',
        meta: true,
        handler: handleSave,
        description: 'Save note',
        ignoreInputs: false
      }
    ],
    [handleSave]
  )

  useKeyboardShortcuts(shortcuts, { enabled: open })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {note ? 'Edit Note' : 'New Note'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4 px-1 -mx-1">
          {/* Title input */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title (auto-generated from content)"
            />
          </div>

          {/* Primary project selector */}
          <div className="space-y-2">
            <Label htmlFor="project">Primary Project (optional)</Label>
            <Select
              value={primaryProjectId ?? 'none'}
              onValueChange={(value) => setPrimaryProjectId(value === 'none' ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">No project</span>
                </SelectItem>
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
          </div>

          {/* Tags input */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[42px]">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  <Tag className="h-3 w-3" />
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <input
                id="tags"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={handleAddTag}
                placeholder={tags.length === 0 ? 'Add tags...' : ''}
                className="flex-1 min-w-[100px] bg-transparent outline-none text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Press Enter to add tags
            </p>
          </div>

          {/* Icon Picker */}
          <IconPicker
            availableIcons={NOTE_ICONS}
            selectedIcon={selectedIcon}
            customIconUrl={customIconUrl}
            iconType={iconType}
            defaultIcon={StickyNote}
            onSelectIcon={setSelectedIcon}
            onCustomIconChange={setCustomIconUrl}
            onIconTypeChange={setIconType}
            onSelectImageFile={handleSelectImage}
          />

          {/* Content editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Content</Label>
              <span className="text-xs text-muted-foreground">
                {wordCount} words
              </span>
            </div>
            <RichTextEditor
              variant="full"
              content={content}
              onChange={handleContentChange}
              placeholder="Start typing your note... Use @ for projects and # for tags"
              getProjects={getProjects}
              getTags={noteTags.length > 0 ? getTags : undefined}
              getGroups={noteTags.length === 0 ? getGroups : undefined}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : note ? 'Save Changes' : 'Create Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
