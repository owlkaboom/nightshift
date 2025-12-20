/**
 * Dialog for adding context attachments to planning sessions
 */

import { useState } from 'react'
import type { ContextAttachment, ContextAttachmentType } from '@shared/types'
import { createContextAttachment } from '@shared/types'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileText, Link, StickyNote, Folder } from 'lucide-react'

interface ContextAttachmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (attachment: ContextAttachment) => void
  projectId: string
}

export function ContextAttachmentDialog({
  open,
  onOpenChange,
  onAdd,
  projectId
}: ContextAttachmentDialogProps) {
  const [activeTab, setActiveTab] = useState<ContextAttachmentType>('file')
  const [label, setLabel] = useState('')
  const [reference, setReference] = useState('')
  const [selectedNoteId, setSelectedNoteId] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleAdd = async () => {
    if (!label.trim()) {
      return
    }

    let finalReference = reference
    if (activeTab === 'note') {
      finalReference = selectedNoteId
    } else if (activeTab === 'project') {
      finalReference = selectedProjectId
    }

    if (!finalReference.trim()) {
      return
    }

    const attachment = createContextAttachment(activeTab, label, finalReference)

    setIsLoading(true)
    try {
      // Load content before adding
      const loadedAttachment = await window.api.loadPlanningContextContent({
        attachment
      })

      onAdd(loadedAttachment)

      // Reset form
      setLabel('')
      setReference('')
      setSelectedNoteId('')
      setSelectedProjectId('')
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to load context attachment:', error)
      // Still add it, but with error
      onAdd({
        ...attachment,
        error: error instanceof Error ? error.message : 'Failed to load content'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectFile = async () => {
    const filePath = await window.api.selectFile([
      { name: 'All Files', extensions: ['*'] },
      { name: 'Text Files', extensions: ['txt', 'md', 'json', 'yaml', 'yml'] },
      {
        name: 'Code Files',
        extensions: [
          'ts',
          'tsx',
          'js',
          'jsx',
          'py',
          'java',
          'c',
          'cpp',
          'rs',
          'go'
        ]
      }
    ])

    if (filePath) {
      setReference(filePath)
      // Auto-fill label from filename if empty
      if (!label) {
        const fileName = filePath.split(/[/\\]/).pop() || filePath
        setLabel(fileName)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Context</DialogTitle>
          <DialogDescription>
            Add files, URLs, notes, or projects as context for the planning session
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ContextAttachmentType)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="file">
              <FileText className="mr-2 h-4 w-4" />
              File
            </TabsTrigger>
            <TabsTrigger value="url">
              <Link className="mr-2 h-4 w-4" />
              URL
            </TabsTrigger>
            <TabsTrigger value="note">
              <StickyNote className="mr-2 h-4 w-4" />
              Note
            </TabsTrigger>
            <TabsTrigger value="project">
              <Folder className="mr-2 h-4 w-4" />
              Project
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-label">Label</Label>
              <Input
                id="file-label"
                placeholder="e.g., API Documentation"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="file-path">File Path</Label>
              <div className="flex gap-2">
                <Input
                  id="file-path"
                  placeholder="/path/to/file.txt"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
                <Button type="button" variant="outline" onClick={handleSelectFile}>
                  Browse
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url-label">Label</Label>
              <Input
                id="url-label"
                placeholder="e.g., React Documentation"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com/docs"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </TabsContent>

          <TabsContent value="note" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="note-label">Label</Label>
              <Input
                id="note-label"
                placeholder="e.g., Architecture Notes"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-select">Note</Label>
              <NoteSelector
                value={selectedNoteId}
                onChange={(noteId, noteTitle) => {
                  setSelectedNoteId(noteId)
                  if (!label) {
                    setLabel(noteTitle)
                  }
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="project" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-label">Label</Label>
              <Input
                id="project-label"
                placeholder="e.g., Similar Project"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-select">Project</Label>
              <ProjectSelector
                value={selectedProjectId}
                currentProjectId={projectId}
                onChange={(pid, projectName) => {
                  setSelectedProjectId(pid)
                  if (!label) {
                    setLabel(projectName)
                  }
                }}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={isLoading || !label.trim()}>
            {isLoading ? 'Loading...' : 'Add Context'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Note selector component
 */
function NoteSelector({
  value,
  onChange
}: {
  value: string
  onChange: (noteId: string, noteTitle: string) => void
}) {
  const [notes, setNotes] = useState<Array<{ id: string; title: string }>>([])
  const [loading, setLoading] = useState(true)

  useState(() => {
    window.api.listNotes().then((allNotes) => {
      setNotes(allNotes.map((n) => ({ id: n.id, title: n.title })))
      setLoading(false)
    })
  })

  if (loading) {
    return <Input disabled placeholder="Loading notes..." />
  }

  return (
    <select
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      value={value}
      onChange={(e) => {
        const noteId = e.target.value
        const note = notes.find((n) => n.id === noteId)
        if (note) {
          onChange(noteId, note.title)
        }
      }}
    >
      <option value="">Select a note...</option>
      {notes.map((note) => (
        <option key={note.id} value={note.id}>
          {note.title}
        </option>
      ))}
    </select>
  )
}

/**
 * Project selector component
 */
function ProjectSelector({
  value,
  currentProjectId,
  onChange
}: {
  value: string
  currentProjectId: string
  onChange: (projectId: string, projectName: string) => void
}) {
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)

  useState(() => {
    window.api.listProjects().then((allProjects) => {
      // Filter out current project
      const filtered = allProjects
        .filter((p) => p.id !== currentProjectId)
        .map((p) => ({ id: p.id, name: p.name }))
      setProjects(filtered)
      setLoading(false)
    })
  })

  if (loading) {
    return <Input disabled placeholder="Loading projects..." />
  }

  return (
    <select
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      value={value}
      onChange={(e) => {
        const projectId = e.target.value
        const project = projects.find((p) => p.id === projectId)
        if (project) {
          onChange(projectId, project.name)
        }
      }}
    >
      <option value="">Select a project...</option>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </select>
  )
}
