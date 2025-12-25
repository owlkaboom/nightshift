/**
 * NotesView - Main notes interface
 *
 * Displays a split-pane view with notes list on the left and editor on the right.
 * Auto-selects the first note on load. Similar to Obsidian's layout.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, RefreshCw, Pin, FileText, Archive, X, Save, Trash2, FolderPlus } from 'lucide-react'
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
import { useNoteStore, useProjectStore, useTaskStore, useNoteGroupStore } from '@/stores'
import { useKeyboardShortcuts, formatKbd, type KeyboardShortcut } from '@/hooks'
import {
  NoteSearch,
  ConvertToTaskDialog,
  DroppableNotesArea
} from '@/components/notes'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import type { Note } from '@shared/types'
import { extractExcerpt, countWords, extractTitleFromContent } from '@shared/types'
import { logger } from '@/lib/logger'

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
  const {
    groups,
    fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    toggleCollapsed
  } = useNoteGroupStore()

  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [noteToConvert, setNoteToConvert] = useState<Note | null>(null)
  const [showLoading, setShowLoading] = useState(true)

  // Selected note state
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [markdownContent, setMarkdownContent] = useState('')
  const [primaryProjectId, setPrimaryProjectId] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [userHasEdited, setUserHasEdited] = useState(false)
  // Track when we're loading content to prevent editor init from triggering onChange
  // Using ref instead of state to avoid stale closure issues in callbacks
  const isLoadingContentRef = useRef(false)

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
        fetchGroups()
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
  }, [fetchNotes, fetchPinnedNotes, fetchRecentNotes, fetchAllTags, fetchProjects, fetchGroups])

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

  // Don't auto-select notes - let user choose which note to view
  // This prevents content reset issues with the markdown editor

  // Update editor state when selected note changes
  useEffect(() => {
    if (!selectedNote) return

    logger.debug('[NotesView] Selected note changed:', {
      noteId: selectedNote.id,
      contentLength: selectedNote.content?.length || 0,
      contentPreview: selectedNote.content?.substring(0, 100)
    })

    // Set loading flag BEFORE any state updates to prevent race conditions
    // Using ref ensures the callback always reads the current value
    isLoadingContentRef.current = true

    // Reset user edit flag when switching notes
    setUserHasEdited(false)
    setHasUnsavedChanges(false)

    // Load markdown content directly
    setMarkdownContent(selectedNote.content || '')
    setPrimaryProjectId(selectedNote.primaryProjectId)
    setTags(selectedNote.tags)
    setWordCount(selectedNote.wordCount)

    // Reset loading flag after a delay to allow editor to sync
    // This needs to be long enough for the editor to process the content update
    const timer = setTimeout(() => {
      isLoadingContentRef.current = false
    }, 300) // Increased delay to ensure editor fully syncs

    return () => {
      clearTimeout(timer)
      // Also reset on cleanup to handle rapid note switching
      isLoadingContentRef.current = false
    }
  }, [selectedNote])

  // Track unsaved changes
  useEffect(() => {
    if (!selectedNote) return

    // Compare markdown content directly
    const savedContent = selectedNote.content || ''

    const hasChanges =
      markdownContent !== savedContent ||
      primaryProjectId !== selectedNote.primaryProjectId ||
      JSON.stringify(tags) !== JSON.stringify(selectedNote.tags)

    setHasUnsavedChanges(hasChanges)
  }, [selectedNote, markdownContent, primaryProjectId, tags])

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
      // Set loading flag before selecting the new note
      isLoadingContentRef.current = true
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
      // Set loading flag IMMEDIATELY before state update to prevent any
      // onChange events from being processed during the transition
      isLoadingContentRef.current = true
      setSelectedNote(note)
    },
    [hasUnsavedChanges]
  )

  // Handle deleting a note
  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      if (window.confirm('Are you sure you want to delete this note?')) {
        await deleteNote(noteId)
        // If we deleted the selected note, clear selection
        if (selectedNote?.id === noteId) {
          setSelectedNote(null)
        }
      }
    },
    [deleteNote, selectedNote]
  )

  // Editor handlers
  const handleContentChange = useCallback((newMarkdown: string, _newText: string) => {
    // Ignore onChange events during content loading (prevents race condition
    // where editor initializes with empty content before real content loads)
    // Using ref.current to always get the latest value, avoiding stale closure issues
    if (isLoadingContentRef.current) {
      logger.debug('[NotesView] Ignoring onChange during content load')
      return
    }

    setMarkdownContent(newMarkdown)
    // Mark that user has actually edited the content
    setUserHasEdited(true)
    // Count words directly from markdown
    setWordCount(countWords(newMarkdown))
  }, [])

  const handleAddTag = useCallback(() => {
    const trimmedTag = tagInput.trim().toLowerCase()
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag])
      setUserHasEdited(true)
    }
    setTagInput('')
  }, [tagInput, tags])

  const handleRemoveTag = useCallback((tag: string) => {
    setTags(tags.filter((t) => t !== tag))
    setUserHasEdited(true)
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
      // Extract title from first line of markdown content
      const title = extractTitleFromContent(markdownContent)

      const updates: Partial<Note> = {
        title: title || 'Untitled',
        content: markdownContent, // Store as markdown
        excerpt: extractExcerpt(markdownContent),
        primaryProjectId,
        tags,
        wordCount: countWords(markdownContent),
        status: selectedNote.status === 'draft' && markdownContent.length > 0 ? 'active' : selectedNote.status
      }

      await updateNote(selectedNote.id, updates)
      setHasUnsavedChanges(false)

      if (!isAutoSave) {
        logger.debug('Note saved manually')
      }
    } catch (error) {
      console.error('Failed to save note:', error)
    } finally {
      setSaving(false)
    }
  }, [selectedNote, markdownContent, primaryProjectId, tags, updateNote])

  // Auto-save with debouncing
  useEffect(() => {
    // Only auto-save if user has actually edited and there are unsaved changes
    if (!userHasEdited || !hasUnsavedChanges || !selectedNote || saving) {
      return
    }

    const timeout = setTimeout(() => {
      handleSave(true)
    }, 2000) // 2 seconds of inactivity

    // Cleanup timeout when dependencies change or on unmount
    return () => {
      clearTimeout(timeout)
    }
  }, [hasUnsavedChanges, userHasEdited, selectedNote, saving, handleSave])

  const handleTogglePin = useCallback(async () => {
    if (!selectedNote) return
    await togglePin(selectedNote.id)
  }, [selectedNote, togglePin])

  const handleArchive = useCallback(async () => {
    if (!selectedNote) return
    await archiveNote(selectedNote.id)
    // Clear selection after archiving
    setSelectedNote(null)
  }, [selectedNote, archiveNote])

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
      // Set loading flag before selecting the note
      isLoadingContentRef.current = true
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
    fetchGroups()
  }, [fetchNotes, fetchPinnedNotes, fetchRecentNotes, fetchAllTags, fetchGroups])

  // Group handlers
  const handleCreateGroup = useCallback(async () => {
    // Create group immediately with default values
    await createGroup({
      name: 'New Group',
      icon: 'Folder',
      color: '#8b5cf6' // Default violet color
    })
  }, [createGroup])

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    await deleteGroup(groupId)
    // Refresh notes to see updated groupId values for ungrouped notes
    await fetchNotes()
  }, [deleteGroup, fetchNotes])

  // Reorder handlers
  const { reorderGroups } = useNoteGroupStore()
  const handleReorderGroups = useCallback(async (groupOrders: Array<{ id: string; order: number }>) => {
    await reorderGroups(groupOrders)
  }, [reorderGroups])

  const handleReorderNotes = useCallback(async (noteOrders: Array<{ id: string; order: number; groupId: string | null }>) => {
    // Update each note's order and groupId optimistically
    // The updateNote function now handles optimistic updates, so we don't need to refresh
    for (const { id, order, groupId } of noteOrders) {
      await updateNote(id, { order, groupId })
    }
  }, [updateNote])

  // Handle tab change
  const handleTabChange = useCallback((tab: FilterTab) => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to switch tabs?')) {
        return
      }
    }
    setActiveTab(tab)
    setSelectedNote(null) // Clear selection when changing tabs
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
                  onClick={handleCreateGroup}
                  className="h-7 w-7"
                  title="Create group"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
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

        {/* Notes list with drag-and-drop */}
        <div className="flex-1 overflow-y-auto p-2">
          <DroppableNotesArea
            groups={groups}
            notes={displayedNotes}
            loading={showLoading}
            selectedNoteId={selectedNote?.id ?? null}
            onNoteClick={handleNoteClick}
            onTogglePin={togglePin}
            onArchive={archiveNote}
            onUnarchive={unarchiveNote}
            onDelete={handleDeleteNote}
            onToggleGroup={toggleCollapsed}
            onUpdateGroup={updateGroup}
            onDeleteGroup={handleDeleteGroup}
            onReorderNotes={handleReorderNotes}
            onReorderGroups={handleReorderGroups}
            activeTab={activeTab}
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
                    onValueChange={(value) => {
                      setPrimaryProjectId(value === 'none' ? null : value)
                      setUserHasEdited(true)
                    }}
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
                {/* Content editor - content prop updates trigger sync via useEffect in RichTextEditor */}
                <RichTextEditor
                  variant="full"
                  content={markdownContent}
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
                  {displayedNotes.length > 0
                    ? 'Select a note from the left to view and edit'
                    : 'Create a new note to get started'
                  }
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
