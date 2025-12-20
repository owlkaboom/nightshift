/**
 * NotesView - Main notes interface
 *
 * Displays a split-pane view with notes list on the left and editor on the right.
 * Auto-selects the first note on load. Similar to Obsidian's layout.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, Pin, FileText, Archive, X, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useNoteStore, useProjectStore, useTaskStore } from '@/stores'
import { useKeyboardShortcuts, formatKbd, type KeyboardShortcut } from '@/hooks'
import {
  NoteList,
  NoteSearch,
  ConvertToTaskDialog
} from '@/components/notes'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import type { Note } from '@shared/types'
import { extractExcerpt, countWords, extractTitleFromContent } from '@shared/types'

type FilterTab = 'all' | 'pinned' | 'recent' | 'archived'

export function NotesView() {
  const {
    notes,
    pinnedNotes,
    recentNotes,
    loading,
    fetchNotes,
    fetchPinnedNotes,
    fetchRecentNotes,
    fetchAllTags,
    createNote,
    updateNote,
    deleteNote,
    togglePin,
    archiveNote,
    unarchiveNote,
    linkToTask
  } = useNoteStore()

  const { projects, fetchProjects } = useProjectStore()
  const { createTask } = useTaskStore()

  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [noteToConvert, setNoteToConvert] = useState<Note | null>(null)
  const [showLoading, setShowLoading] = useState(true)

  // Selected note state
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [htmlContent, setHtmlContent] = useState('')
  const [textContent, setTextContent] = useState('')
  const [primaryProjectId, setPrimaryProjectId] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  // Initial data fetch with minimum loading duration
  useEffect(() => {
    const startTime = Date.now()
    const minLoadingDuration = 400 // milliseconds

    const fetchData = async () => {
      await Promise.all([
        fetchNotes(),
        fetchPinnedNotes(),
        fetchRecentNotes(),
        fetchAllTags(),
        fetchProjects(),
              ])

      // Ensure minimum loading time to prevent flash
      const elapsed = Date.now() - startTime
      const remainingTime = Math.max(0, minLoadingDuration - elapsed)

      if (remainingTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingTime))
      }

      setShowLoading(false)
    }

    fetchData()
  }, [fetchNotes, fetchPinnedNotes, fetchRecentNotes, fetchAllTags, fetchProjects])

  // Get displayed notes based on active tab
  const displayedNotes = useMemo(() => {
    switch (activeTab) {
      case 'pinned':
        return pinnedNotes
      case 'recent':
        return recentNotes
      case 'archived':
        return notes.filter((n) => n.status === 'archived')
      default:
        return notes.filter((n) => n.status !== 'archived')
    }
  }, [activeTab, notes, pinnedNotes, recentNotes])

  // Auto-select first note when notes are loaded or tab changes
  useEffect(() => {
    if (!showLoading && displayedNotes.length > 0 && !selectedNote) {
      setSelectedNote(displayedNotes[0])
    }
  }, [showLoading, displayedNotes, selectedNote])

  // Update editor state when selected note changes
  useEffect(() => {
    if (selectedNote) {
      // Use HTML content if available, otherwise fall back to text content
      setHtmlContent(selectedNote.htmlContent || selectedNote.content || '')
      setTextContent(selectedNote.content || '')
      setPrimaryProjectId(selectedNote.primaryProjectId)
      setTags(selectedNote.tags)
      setWordCount(selectedNote.wordCount)
    }
  }, [selectedNote])

  // Track unsaved changes
  useEffect(() => {
    if (!selectedNote) return

    const hasChanges =
      htmlContent !== (selectedNote.htmlContent || selectedNote.content || '') ||
      primaryProjectId !== selectedNote.primaryProjectId ||
      JSON.stringify(tags) !== JSON.stringify(selectedNote.tags)

    setHasUnsavedChanges(hasChanges)
  }, [selectedNote, htmlContent, primaryProjectId, tags])

  // Auto-save with debouncing
  useEffect(() => {
    // Clear existing timeout
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout)
    }

    // Only auto-save if there are unsaved changes and a note is selected
    if (hasUnsavedChanges && selectedNote && !saving) {
      const timeout = setTimeout(() => {
        handleSave(true)
      }, 2000) // 2 seconds of inactivity

      setAutoSaveTimeout(timeout)
    }

    // Cleanup timeout on unmount
    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout)
      }
    }
  }, [hasUnsavedChanges, selectedNote, htmlContent, primaryProjectId, tags, saving])

  // Cleanup timeout when note changes
  useEffect(() => {
    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout)
        setAutoSaveTimeout(null)
      }
    }
  }, [selectedNote?.id])

  // Handle creating a new note
  const handleNewNote = useCallback(async () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to create a new note?')) {
        return
      }
    }

    try {
      const newNote = await createNote({
        title: 'Untitled',
        content: 'Untitled',
        tags: []
      })
      setSelectedNote(newNote)
    } catch (error) {
      console.error('Failed to create note:', error)
    }
  }, [createNote, hasUnsavedChanges])

  // Handle selecting a note
  const handleNoteClick = useCallback(
    (note: Note) => {
      if (hasUnsavedChanges) {
        if (!window.confirm('You have unsaved changes. Are you sure you want to switch notes?')) {
          return
        }
      }
      setSelectedNote(note)
    },
    [hasUnsavedChanges]
  )

  // Handle deleting a note
  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      if (window.confirm('Are you sure you want to delete this note?')) {
        await deleteNote(noteId)
        // If we deleted the selected note, select another one
        if (selectedNote?.id === noteId) {
          const remainingNotes = displayedNotes.filter(n => n.id !== noteId)
          setSelectedNote(remainingNotes.length > 0 ? remainingNotes[0] : null)
        }
      }
    },
    [deleteNote, selectedNote, displayedNotes]
  )

  // Editor handlers
  const handleContentChange = useCallback((newHtml: string, newText: string) => {
    setHtmlContent(newHtml)
    setTextContent(newText)
    setWordCount(countWords(newText))
  }, [])

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

  const handleSave = useCallback(async (isAutoSave = false) => {
    if (!selectedNote) return

    setSaving(true)
    try {
      // Extract title from first line of text content
      const title = extractTitleFromContent(textContent)

      const updates: Partial<Note> = {
        title: title || 'Untitled',
        content: textContent,
        htmlContent,
        excerpt: extractExcerpt(textContent),
        primaryProjectId,
        tags,
        wordCount,
        status: selectedNote.status === 'draft' && textContent.length > 0 ? 'active' : selectedNote.status
      }

      await updateNote(selectedNote.id, updates)
      setHasUnsavedChanges(false)

      if (!isAutoSave) {
        console.log('Note saved manually')
      }
    } catch (error) {
      console.error('Failed to save note:', error)
    } finally {
      setSaving(false)
    }
  }, [selectedNote, textContent, htmlContent, primaryProjectId, tags, wordCount, updateNote])

  const handleTogglePin = useCallback(async () => {
    if (!selectedNote) return
    await togglePin(selectedNote.id)
  }, [selectedNote, togglePin])

  const handleArchive = useCallback(async () => {
    if (!selectedNote) return
    await archiveNote(selectedNote.id)
    // Select another note after archiving
    const remainingNotes = displayedNotes.filter(n => n.id !== selectedNote.id)
    setSelectedNote(remainingNotes.length > 0 ? remainingNotes[0] : null)
  }, [selectedNote, archiveNote, displayedNotes])

  const handleConvertToTask = useCallback(
    async (data: { prompt: string; projectId: string }) => {
      if (!noteToConvert) return

      // Create the task
      const task = await createTask({
        prompt: data.prompt,
        projectId: data.projectId
      })

      // Link the note to the task
      await linkToTask(noteToConvert.id, task.id)

      // Update note status
      await updateNote(noteToConvert.id, { status: 'converted' })

      setNoteToConvert(null)
    },
    [noteToConvert, createTask, linkToTask, updateNote]
  )

  // Handle search
  const handleSearch = useCallback(
    async (query: string) => {
      const results = await window.api.searchNotes(query)
      return results
    },
    []
  )

  // Handle search result click
  const handleSearchResultClick = useCallback(
    (note: Note) => {
      if (hasUnsavedChanges) {
        if (!window.confirm('You have unsaved changes. Are you sure you want to switch notes?')) {
          return
        }
      }
      setSelectedNote(note)
    },
    [hasUnsavedChanges]
  )

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchNotes()
    fetchPinnedNotes()
    fetchRecentNotes()
    fetchAllTags()
  }, [fetchNotes, fetchPinnedNotes, fetchRecentNotes, fetchAllTags])

  // Handle tab change
  const handleTabChange = useCallback((tab: FilterTab) => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to switch tabs?')) {
        return
      }
    }
    setActiveTab(tab)
    setSelectedNote(null) // Will trigger auto-select of first note
  }, [hasUnsavedChanges])

  const getProjects = useCallback(async () => projects, [projects])
  const getGroups = useCallback(async () => [], [])

  // Keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = useMemo(
    () => [
      { key: 'n', meta: true, handler: handleNewNote, description: 'New note' },
      { key: 'r', meta: true, handler: handleRefresh, description: 'Refresh notes' },
      {
        key: 's',
        meta: true,
        handler: handleSave,
        description: 'Save note',
        ignoreInputs: false
      }
    ],
    [handleNewNote, handleRefresh, handleSave]
  )

  useKeyboardShortcuts(shortcuts)

  return (
    <div className="h-full flex flex-col">
      {/* Split-pane content */}
      <div className="flex-1 flex min-h-0 border-t">
        {/* Left sidebar - Notes list */}
        <div className="w-80 border-r flex flex-col bg-muted/30">
          {/* Sidebar header */}
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Notes</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={loading}
                className="h-7 w-7"
                title={`Refresh (${formatKbd('⌘R')})`}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNewNote}
                className="h-7 w-7"
                title={`New note (${formatKbd('⌘N')})`}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Search */}
          <NoteSearch
            onSearch={handleSearch}
            onResultClick={handleSearchResultClick}
            className="w-full"
          />

          {/* Filter tabs */}
          <div className="flex items-center gap-1">
            <Button
              variant={activeTab === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleTabChange('all')}
              className="h-7 text-xs flex-1"
            >
              All
            </Button>
            <Button
              variant={activeTab === 'pinned' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleTabChange('pinned')}
              className="h-7 text-xs flex-1"
            >
              Pinned
            </Button>
            <Button
              variant={activeTab === 'recent' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleTabChange('recent')}
              className="h-7 text-xs flex-1"
            >
              Recent
            </Button>
          </div>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto p-2">
          <NoteList
            notes={displayedNotes}
            loading={showLoading}
            layout="list"
            onNoteClick={handleNoteClick}
            onTogglePin={(noteId) => togglePin(noteId)}
            onArchive={(noteId) => archiveNote(noteId)}
            onUnarchive={(noteId) => unarchiveNote(noteId)}
            onDelete={handleDeleteNote}
            selectedNoteId={selectedNote?.id ?? null}
            emptyMessage={
              activeTab === 'pinned'
                ? 'No pinned notes'
                : activeTab === 'archived'
                  ? 'No archived notes'
                  : 'No notes yet. Create your first note!'
            }
          />
        </div>
      </div>

      {/* Right panel - Editor */}
      <div className="flex-1 flex flex-col">
        {selectedNote ? (
          <>
            {/* Editor header */}
            <div className="flex items-center justify-between gap-4 p-4 border-b">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Word count */}
                <p className="text-xs text-muted-foreground shrink-0">
                  {hasUnsavedChanges ? 'Unsaved changes • ' : ''}{wordCount} words
                </p>

                {/* Project selector */}
                <div className="flex items-center gap-2">
                  <Label htmlFor="project" className="text-xs text-muted-foreground">Project:</Label>
                  <Select
                    value={primaryProjectId ?? 'none'}
                    onValueChange={(value) => setPrimaryProjectId(value === 'none' ? null : value)}
                  >
                    <SelectTrigger className="h-7 text-xs w-auto min-w-[120px]">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-muted-foreground">None</span>
                      </SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tags */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Label htmlFor="tags" className="text-xs text-muted-foreground shrink-0">Tags:</Label>
                  <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1 h-6 text-xs">
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
                      placeholder="Add tag..."
                      className="flex-1 min-w-[80px] bg-transparent outline-none text-xs h-6"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleTogglePin}
                  title={selectedNote.isPinned ? 'Unpin' : 'Pin'}
                >
                  <Pin className={`h-4 w-4 ${selectedNote.isPinned ? 'fill-current' : ''}`} />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleArchive}
                  title="Archive"
                >
                  <Archive className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteNote(selectedNote.id)}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>

                {/* Save status indicator */}
                {saving && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Auto-saving...
                  </div>
                )}
                {!saving && hasUnsavedChanges && (
                  <div className="text-xs text-muted-foreground">
                    Unsaved
                  </div>
                )}
                {!saving && !hasUnsavedChanges && (
                  <div className="text-xs text-muted-foreground">
                    Saved
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSave(false)}
                  disabled={saving || !hasUnsavedChanges}
                  title={`Save now (${formatKbd('⌘S')})`}
                >
                  <Save className="h-3.5 w-3.5 mr-2" />
                  Save
                </Button>
              </div>
            </div>

            {/* Editor content */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-5xl mx-auto py-8">
                {/* Content editor */}
                <RichTextEditor
                  variant="full"
                  content={htmlContent}
                  onChange={handleContentChange}
                  placeholder="Start typing your note... Use @ for projects"
                  getProjects={getProjects}
                  getGroups={getGroups}
                  autoFocus
                  className="min-h-[600px] shadow-sm border"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <div>
                <h3 className="text-lg font-semibold text-muted-foreground">No note selected</h3>
                <p className="text-sm text-muted-foreground">
                  Select a note from the list or create a new one
                </p>
              </div>
              <Button onClick={handleNewNote}>
                <Plus className="h-4 w-4 mr-2" />
                Create Note
              </Button>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Convert to task dialog */}
      <ConvertToTaskDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        note={noteToConvert}
        projects={projects}
        onConvert={handleConvertToTask}
      />
    </div>
  )
}
